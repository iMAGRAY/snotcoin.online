/**
 * Сервис Redis для оптимизации сохранения состояний игры
 * Обеспечивает кэширование и обмен данными между серверами
 */

import { 
  RedisCache, 
  RedisCacheResult 
} from '../utils/redisClient';
import { CacheTTL, RedisPrefix } from '../config/redis';
import { ExtendedGameState } from '../types/gameTypes';
import { DeltaGameState } from '../types/saveTypes';
import { createDelta, applyDelta, isDeltaEfficient } from '../utils/deltaCompression';
import { validateAndRepairGameState } from '../utils/dataIntegrity';

// Таймаут для операций Redis (миллисекунды)
const REDIS_OPERATION_TIMEOUT = 2000;

/**
 * Результат операции сервиса Redis
 */
interface RedisServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  source?: 'redis' | 'database' | 'memory';
  metrics?: {
    duration: number;
    cacheHit?: boolean;
    size?: number;
    compressionRatio?: number;
  };
}

/**
 * Сервис Redis для работы с данными игры
 */
export class RedisService {
  private cache: RedisCache;
  private memoryCache: Map<string, { data: any; expiry: number }> = new Map();
  private isInitialized: boolean = false;
  private _cleanupInterval: NodeJS.Timeout | null = null;
  private _initializationPromise: Promise<void> | null = null;
  private _isConnecting: boolean = false;
  private _connectionAttempts: number = 0;
  private readonly MAX_CONNECTION_ATTEMPTS = 5;
  private readonly CONNECTION_RETRY_DELAY = 2000; // 2 секунды
  
  /**
   * Создает экземпляр RedisService
   */
  constructor() {
    // Проверка на браузерное окружение
    const isBrowser = typeof window !== 'undefined';
    
    // Инициализируем временный кэш
    this.cache = this.createFallbackCache();
    
    // Инициализируем RedisCache только на сервере
    if (!isBrowser) {
      this._initializationPromise = this.initializeRedis();
    } else {
      // В браузере создаем заглушку
      console.log('[RedisService] Running in browser environment, using mock Redis client');
      this.cache = this.createBrowserMockCache();
      this.isInitialized = true;
      this._initializationPromise = Promise.resolve();
    }
    
    // Запускаем очистку памяти каждые 15 минут
    if (!isBrowser) {
      this.startMemoryCacheCleanup();
    }
  }
  
  /**
   * Инициализирует Redis
   */
  private async initializeRedis(): Promise<void> {
    if (this._isConnecting) {
      console.log('[RedisService] Redis connection already in progress');
      return;
    }
    
    this._isConnecting = true;
    
    try {
      console.log('[RedisService] Initializing RedisCache...');
      this.cache = new RedisCache();
      
      // Даем Redis время на инициализацию
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Проверяем статус соединения с повторными попытками
      let isAvailable = false;
      while (this._connectionAttempts < this.MAX_CONNECTION_ATTEMPTS) {
        // Даем Redis немного времени между попытками установить соединение
        if (this._connectionAttempts > 0) {
          console.log(`[RedisService] Redis connection attempt ${this._connectionAttempts} failed, retrying in ${this.CONNECTION_RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.CONNECTION_RETRY_DELAY));
        }
        
        isAvailable = await this.isRedisAvailable();
        
        if (isAvailable) {
          console.log('[RedisService] Redis connection confirmed and available');
          this.isInitialized = true;
          break;
        }
        
        this._connectionAttempts++;
      }
      
      if (!isAvailable) {
        console.warn('[RedisService] Redis not available after multiple attempts, using in-memory cache only');
        
        // Если Redis был включен в конфигурации, но соединение не удалось,
        // выводим расширенную информацию
        console.info('[RedisService] Redis status details:', {
          enabled: process.env.REDIS_ENABLED,
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || '6379',
          attempts: this._connectionAttempts
        });
        console.info('[RedisService] To run Redis locally, you can:');
        console.info(' - Install Redis: https://redis.io/download');
        console.info(' - Use Docker: docker run --name redis -p 6379:6379 -d redis');
        console.info(' - Or set REDIS_ENABLED=false in .env.local to disable Redis');
        
        // Здесь можно инициализировать дополнительные фоновые процессы для in-memory
        this.startMemoryCacheCleanup();
      }
    } catch (err) {
      console.error('[RedisService] Error initializing RedisCache:', err);
      // Обеспечиваем запасной вариант в случае сбоя инициализации
      this.cache = this.createFallbackCache();
    } finally {
      this._isConnecting = false;
    }
  }
  
  /**
   * Ожидает инициализации Redis
   */
  private async waitForInitialization(): Promise<void> {
    if (!this._initializationPromise) {
      this._initializationPromise = this.initializeRedis();
    }
    
    try {
      await this._initializationPromise;
      
      // Дополнительная проверка доступности Redis
      if (!this.isInitialized) {
        const isAvailable = await this.isRedisAvailable();
        if (isAvailable) {
          this.isInitialized = true;
          console.log('[RedisService] Redis connection confirmed after wait');
        }
      }
    } catch (error) {
      console.error('[RedisService] Error waiting for Redis initialization:', error);
      throw error;
    }
  }
  
  /**
   * Создает запасной кэш для случаев, когда RedisCache не может быть инициализирован
   */
  private createFallbackCache(): RedisCache {
    return {
      ping: async () => false,
      saveGameState: async (userId: string, state: ExtendedGameState, ttl?: number) => {
        try {
          // Сохраняем в памяти
          const key = `game:state:${userId}`;
          const expiry = Date.now() + (ttl || 3600) * 1000;
          this.memoryCache.set(key, { data: state, expiry });
          
          return {
            success: true,
            source: 'memory',
            metadata: { timestamp: Date.now() }
          };
        } catch (error) {
          console.error('[RedisService] Error in fallback saveGameState:', error);
          return {
            success: false,
            error: String(error),
            source: 'error'
          };
        }
      },
      loadGameState: async (userId: string) => {
        try {
          // Загружаем из памяти
          const key = `game:state:${userId}`;
          const cached = this.memoryCache.get(key);
          
          if (!cached || cached.expiry < Date.now()) {
            if (cached) this.memoryCache.delete(key);
            return {
              success: false,
              error: 'Data not found or expired',
              source: 'none'
            };
          }
          
          return {
            success: true,
            data: cached.data,
            source: 'memory',
            metadata: { timestamp: Date.now() }
          };
        } catch (error) {
          console.error('[RedisService] Error in fallback loadGameState:', error);
          return {
            success: false,
            error: String(error),
            source: 'error'
          };
        }
      },
      saveDelta: async () => ({ success: false, error: 'Not implemented in fallback', source: 'none' }),
      loadRecentDeltas: async () => ({ success: false, error: 'Not implemented in fallback', source: 'none', data: [] })
    } as unknown as RedisCache;
  }
  
  /**
   * Создает заглушку для использования в браузере
   */
  private createBrowserMockCache(): RedisCache {
    return {
      ping: async () => {
        console.log('[RedisService] Browser mock: ping called');
        return true; // В браузере всегда возвращаем успех
      },
      saveGameState: async (userId: string, state: ExtendedGameState) => {
        console.log('[RedisService] Browser mock: saveGameState called for', userId);
        // Сохраняем в локальной памяти
        try {
          // Возвращаем успешный результат
          return {
            success: true,
            source: 'browser-memory',
            metadata: { timestamp: Date.now() }
          };
        } catch (error) {
          return {
            success: false,
            error: String(error),
            source: 'browser-memory'
          };
        }
      },
      loadGameState: async (userId: string) => {
        console.log('[RedisService] Browser mock: loadGameState called for', userId);
        return {
          success: true,
          data: null,
          source: 'browser-memory'
        };
      },
      saveDelta: async () => {
        console.log('[RedisService] Browser mock: saveDelta called');
        return { 
          success: true,
          source: 'browser-memory'
        };
      },
      loadRecentDeltas: async () => {
        console.log('[RedisService] Browser mock: loadRecentDeltas called');
        return { 
          success: true,
          source: 'browser-memory',
          data: []
        };
      }
    } as unknown as RedisCache;
  }
  
  /**
   * Запускает периодическую очистку кэша памяти
   */
  private startMemoryCacheCleanup(): void {
    const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 минут
    
    const cleanup = () => {
      const now = Date.now();
      let removedCount = 0;
      
      try {
        // Проходим по всем записям и удаляем устаревшие
        // Используем Array.from для безопасной итерации
        Array.from(this.memoryCache.entries()).forEach(([key, entry]) => {
          if (entry.expiry < now) {
            this.memoryCache.delete(key);
            removedCount++;
          }
        });
        
        if (removedCount > 0) {
          console.log(`[RedisService] Memory cache cleanup: removed ${removedCount} expired entries. Current size: ${this.memoryCache.size}`);
        }
      } catch (error) {
        console.error('[RedisService] Error during memory cache cleanup:', error);
      }
    };
    
    // Запускаем очистку периодически
    this._cleanupInterval = setInterval(cleanup, CLEANUP_INTERVAL);
    
    // Выполняем первую очистку сразу
    cleanup();
  }
  
  /**
   * Проверяет доступность Redis
   * @returns Promise<boolean>
   */
  public async isRedisAvailable(): Promise<boolean> {
    try {
      if (!this.cache) {
        console.warn('[RedisService] Redis client not initialized');
        return false;
      }
      
      // Пробуем ping с несколькими попытками для надежности
      let pingResult = false;
      
      // До 3-х попыток с маленькими интервалами
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          console.log(`[RedisService] Retry Redis ping attempt ${attempt+1}/3`);
          // Короткий интервал между попытками
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        pingResult = await this.cache.ping();
        
        if (pingResult) {
          console.log('[RedisService] Redis successfully pinged');
          break;
        } else {
          console.warn(`[RedisService] Redis ping attempt ${attempt+1} failed or returned false`);
        }
      }
      
      return pingResult;
    } catch (error) {
      console.error('[RedisService] Error checking Redis availability:', error);
      return false;
    }
  }
  
  /**
   * Сохраняет состояние игры
   * @param userId ID пользователя
   * @param state Состояние игры
   * @param options Время жизни в секундах или флаг критичности (true = критичное сохранение)
   */
  async saveGameState(
    userId: string, 
    state: ExtendedGameState, 
    options?: number | boolean
  ): Promise<RedisServiceResult<boolean>> {
    try {
      await this.waitForInitialization();
      
      // Определяем, является ли сохранение критическим и устанавливаем TTL
      let isCritical = false;
      let ttl: number | undefined = undefined;
      
      if (typeof options === 'boolean') {
        isCritical = options;
      } else if (typeof options === 'number') {
        ttl = options;
      }
      
      return await this._saveGameStateInternal(userId, state, isCritical, ttl);
    } catch (error) {
      console.error('[RedisService] Error saving game state:', error);
      return {
        success: false,
        error: String(error),
        source: 'memory'
      };
    }
  }
  
  /**
   * Внутренняя реализация сохранения состояния
   */
  private async _saveGameStateInternal(
    userId: string, 
    state: ExtendedGameState,
    isCritical: boolean = false,
    ttl?: number
  ): Promise<RedisServiceResult<boolean>> {
    const startTime = Date.now();
    
    try {
      // Проверяем, есть ли предыдущее состояние в кэше
      const previousState = await this.loadGameState(userId);
      
      // Если есть предыдущее состояние, создаем дельту
      if (previousState.success && previousState.data) {
        const baseVersion = previousState.data._saveVersion || 1;
        
        try {
          // Создаем дельту между состояниями
          const delta = createDelta(
            previousState.data,
            state,
            userId,
            baseVersion
          );
          
          // Если дельта создана и эффективна, сохраняем дельту вместо полного состояния
          if (delta && isDeltaEfficient(state, delta)) {
            console.log(`[RedisService] Saving delta for ${userId}, ${delta._changeCount} changes`);
            
            // Сохраняем дельту в Redis
            const deltaResult = await this.cache.saveDelta(
              userId,
              delta,
              isCritical ? CacheTTL.CRITICAL : CacheTTL.DELTAS
            );
            
            if (deltaResult.success) {
              // Обновляем состояние в кэше памяти для быстрого доступа
              this.updateMemoryCache(userId, state, CacheTTL.FULL_STATE);
              
              return {
                success: true,
                source: 'redis',
                metrics: {
                  duration: Date.now() - startTime,
                  cacheHit: false,
                  size: JSON.stringify(delta).length
                }
              };
            }
          }
        } catch (deltaError) {
          console.error(`[RedisService] Error creating delta for ${userId}:`, deltaError);
          // В случае ошибки с дельтой, продолжаем сохранять полное состояние
        }
      }
      
      // Если дельта не создана или не эффективна, сохраняем полное состояние
      console.log(`[RedisService] Saving full state for ${userId}`);
      
      // Сохраняем состояние в Redis
      const result = await this.cache.saveGameState(
        userId,
        state,
        isCritical ? CacheTTL.CRITICAL : CacheTTL.FULL_STATE
      );
      
      // Обновляем состояние в кэше памяти для быстрого доступа
      this.updateMemoryCache(userId, state, CacheTTL.FULL_STATE);
      
      return {
        success: result.success,
        error: result.error,
        source: 'redis',
        metrics: {
          duration: Date.now() - startTime,
          cacheHit: false,
          size: result.metadata?.size,
          compressionRatio: result.metadata?.compressionRatio
        }
      };
    } catch (error) {
      console.error(`[RedisService] Error in _saveGameStateInternal for ${userId}:`, error);
      throw error; // Пробрасываем ошибку вверх для обработки в saveGameState
    }
  }
  
  /**
   * Загружает состояние игры
   */
  async loadGameState(userId: string): Promise<RedisServiceResult<ExtendedGameState>> {
    try {
      await this.waitForInitialization();
      return await this._loadGameStateInternal(userId);
    } catch (error) {
      console.error('[RedisService] Error loading game state:', error);
      return {
        success: false,
        error: String(error),
        source: 'memory'
      };
    }
  }
  
  /**
   * Внутренняя реализация загрузки состояния
   */
  private async _loadGameStateInternal(userId: string): Promise<RedisServiceResult<ExtendedGameState>> {
    const startTime = Date.now();
    
    // Сначала проверяем кэш в памяти для быстрого доступа
    const memoryData = this.getFromMemoryCache<ExtendedGameState>(userId);
    
    if (memoryData) {
      console.log(`[RedisService] Loaded state from memory cache for ${userId}`);
      
      return {
        success: true,
        data: memoryData,
        source: 'memory',
        metrics: {
          duration: Date.now() - startTime,
          cacheHit: true
        }
      };
    }
    
    // Загружаем состояние из Redis
    const result = await this.cache.loadGameState(userId);
    
    if (result.success && result.data) {
      // Проверяем и восстанавливаем данные при необходимости
      const validatedState = validateAndRepairGameState(result.data);
      
      // Обновляем кэш в памяти
      this.updateMemoryCache(userId, validatedState, CacheTTL.FULL_STATE);
      
      return {
        success: true,
        data: validatedState,
        source: 'redis',
        metrics: {
          duration: Date.now() - startTime,
          cacheHit: true,
          size: result.metadata?.size,
          compressionRatio: result.metadata?.compressionRatio
        }
      };
    }
    
    return {
      success: false,
      error: result.error || 'Data not found',
      source: 'redis',
      metrics: {
        duration: Date.now() - startTime,
        cacheHit: false
      }
    };
  }
  
  /**
   * Синхронизирует состояние игры с учетом дельт
   * @param userId ID пользователя
   * @param baseState Базовое состояние для синхронизации
   * @returns Promise<RedisServiceResult<ExtendedGameState>> Результат операции
   */
  public async syncGameState(
    userId: string,
    baseState: ExtendedGameState
  ): Promise<RedisServiceResult<ExtendedGameState>> {
    if (!userId || !baseState) {
      return {
        success: false,
        error: 'Invalid arguments: userId and baseState are required',
        source: 'memory'
      };
    }
    
    const startTime = Date.now();
    
    try {
      // Таймаут для операции
      const operationPromise = this._syncGameStateInternal(userId, baseState);
      const timeoutPromise = new Promise<RedisServiceResult<ExtendedGameState>>((_, reject) => 
        setTimeout(() => reject(new Error('Redis operation timeout')), REDIS_OPERATION_TIMEOUT)
      );
      
      // Ждем первый разрешенный промис
      return await Promise.race([operationPromise, timeoutPromise]);
    } catch (error) {
      console.error(`[RedisService] Error syncing state for ${userId}:`, error);
      
      return {
        success: true,
        data: baseState, // Возвращаем базовое состояние без изменений
        source: 'memory',
        metrics: {
          duration: Date.now() - startTime,
          cacheHit: false
        }
      };
    }
  }
  
  /**
   * Внутренняя реализация синхронизации состояния
   */
  private async _syncGameStateInternal(
    userId: string,
    baseState: ExtendedGameState
  ): Promise<RedisServiceResult<ExtendedGameState>> {
    const startTime = Date.now();
    
    try {
      // Загружаем последние дельты
      const deltasResult = await this.cache.loadRecentDeltas(userId, 10);
      
      // Если дельт нет, возвращаем исходное состояние
      if (!deltasResult.success || !deltasResult.data || deltasResult.data.length === 0) {
        return {
          success: true,
          data: baseState,
          source: 'memory',
          metrics: {
            duration: Date.now() - startTime,
            cacheHit: false
          }
        };
      }
      
      // Сортируем дельты по версии
      const deltas = deltasResult.data
        .filter((d: DeltaGameState) => d._baseVersion >= (baseState._saveVersion || 0))
        .sort((a: DeltaGameState, b: DeltaGameState) => a._baseVersion - b._baseVersion);
      
      if (deltas.length === 0) {
        return {
          success: true,
          data: baseState,
          source: 'memory',
          metrics: {
            duration: Date.now() - startTime,
            cacheHit: false
          }
        };
      }
      
      console.log(`[RedisService] Applying ${deltas.length} deltas for ${userId}`);
      
      // Применяем дельты последовательно
      let currentState = { ...baseState };
      
      for (const delta of deltas) {
        try {
          const newState = applyDelta(currentState, delta);
          
          if (newState) {
            currentState = newState;
          } else {
            console.warn(`[RedisService] Failed to apply delta version ${delta._baseVersion} for ${userId}`);
          }
        } catch (deltaError) {
          console.error(`[RedisService] Error applying delta:`, deltaError);
        }
      }
      
      // Проверяем и восстанавливаем данные
      const validatedState = validateAndRepairGameState(currentState);
      
      // Обновляем кэш в памяти
      this.updateMemoryCache(userId, validatedState, CacheTTL.FULL_STATE);
      
      return {
        success: true,
        data: validatedState,
        source: 'redis',
        metrics: {
          duration: Date.now() - startTime,
          cacheHit: true
        }
      };
    } catch (error) {
      console.error(`[RedisService] Error in _syncGameStateInternal for ${userId}:`, error);
      throw error; // Пробрасываем ошибку вверх для обработки в syncGameState
    }
  }
  
  /**
   * Получает информацию о кэше для пользователя
   * @param userId ID пользователя
   * @returns Promise<RedisServiceResult<any>> Результат операции
   */
  public async getCacheInfo(userId: string): Promise<RedisServiceResult<any>> {
    if (!userId) {
      return {
        success: false,
        error: 'Invalid argument: userId is required',
        source: 'memory'
      };
    }
    
    const startTime = Date.now();
    
    try {
      const isRedisAvailable = await this.isRedisAvailable();
      
      if (!isRedisAvailable) {
        return {
          success: true,
          data: {
            inMemoryCache: this.memoryCache.has(`user:${userId}`),
            redisAvailable: false
          },
          source: 'memory',
          metrics: {
            duration: Date.now() - startTime
          }
        };
      }
      
      // Получаем метаданные из Redis
      const metaKey = `${RedisPrefix.META}:${userId}`;
      const metaData = await this.cache['client']?.hgetall(metaKey);
      
      return {
        success: true,
        data: {
          inMemoryCache: this.memoryCache.has(`user:${userId}`),
          redisAvailable: true,
          metaData: metaData || {}
        },
        source: 'redis',
        metrics: {
          duration: Date.now() - startTime
        }
      };
    } catch (error) {
      console.error(`[RedisService] Error getting cache info for ${userId}:`, error);
      
      return {
        success: false,
        error: String(error),
        metrics: {
          duration: Date.now() - startTime
        }
      };
    }
  }
  
  /**
   * Очищает кэш для пользователя
   * @param userId ID пользователя
   * @returns Promise<RedisServiceResult<boolean>> Результат операции
   */
  public async clearCache(userId: string): Promise<RedisServiceResult<boolean>> {
    if (!userId) {
      return {
        success: false,
        error: 'Invalid argument: userId is required'
      };
    }
    
    const startTime = Date.now();
    
    try {
      // Очищаем кэш в памяти
      this.clearMemoryCache(userId);
      
      // Если Redis не доступен, просто очищаем кэш в памяти
      const isRedisAvailable = await this.isRedisAvailable();
      
      if (!isRedisAvailable) {
        return {
          success: true,
          source: 'memory',
          metrics: {
            duration: Date.now() - startTime
          }
        };
      }
      
      // Очищаем данные в Redis
      const keys = [
        `${RedisPrefix.GAME_STATE}:${userId}`,
        `${RedisPrefix.META}:${userId}`,
        `${RedisPrefix.DELTA_LIST}:${userId}`
      ];
      
      for (const key of keys) {
        await this.cache['client']?.del(key);
      }
      
      // Получаем и удаляем дельты
      const deltaPattern = `${RedisPrefix.DELTA}:${userId}:*`;
      const deltaKeys = await this.cache['client']?.keys(deltaPattern);
      
      if (deltaKeys && deltaKeys.length > 0) {
        await this.cache['client']?.del(...deltaKeys);
      }
      
      return {
        success: true,
        source: 'redis',
        metrics: {
          duration: Date.now() - startTime
        }
      };
    } catch (error) {
      console.error(`[RedisService] Error clearing cache for ${userId}:`, error);
      
      return {
        success: false,
        error: String(error),
        metrics: {
          duration: Date.now() - startTime
        }
      };
    }
  }
  
  /**
   * Обновляет кэш в памяти
   * @param userId ID пользователя
   * @param state Состояние игры
   * @param ttl Время жизни в секундах
   */
  private updateMemoryCache(userId: string, state: ExtendedGameState, ttl: number): void {
    if (!userId || !state) return;
    
    try {
      // Очищаем кэш для экономии памяти, если много пользователей
      this.cleanMemoryCache();
      
      const key = `user:${userId}`;
      const expiry = Date.now() + ttl * 1000;
      
      // Клонируем состояние для безопасности
      const clonedState = JSON.parse(JSON.stringify(state));
      
      this.memoryCache.set(key, {
        data: clonedState,
        expiry
      });
      
      // Логируем только при первом сохранении
      if (!this.memoryCache.has(key)) {
        console.log(`[RedisService] State saved to memory cache for ${userId}`);
      }
    } catch (error) {
      console.error(`[RedisService] Error updating memory cache for ${userId}:`, error);
    }
  }
  
  /**
   * Получает данные из кэша в памяти
   * @param userId ID пользователя
   * @returns T | null Данные или null, если не найдены
   */
  private getFromMemoryCache<T>(userId: string): T | null {
    if (!userId) return null;
    
    try {
      const key = `user:${userId}`;
      const cached = this.memoryCache.get(key);
      
      if (!cached || cached.expiry < Date.now()) {
        if (cached) {
          this.memoryCache.delete(key);
        }
        return null;
      }
      
      // Клонируем данные для безопасности
      return JSON.parse(JSON.stringify(cached.data)) as T;
    } catch (error) {
      console.error(`[RedisService] Error getting from memory cache for ${userId}:`, error);
      return null;
    }
  }
  
  /**
   * Очищает кэш в памяти для конкретного пользователя
   * @param userId ID пользователя
   */
  private clearMemoryCache(userId?: string): void {
    try {
      if (userId) {
        // Очищаем данные конкретного пользователя
        const key = `user:${userId}`;
        this.memoryCache.delete(key);
      } else {
        // Очищаем устаревшие данные
        const now = Date.now();
        
        // Безопасная итерация по Map с проверкой наличия свойств
        // Преобразуем в массив для избежания проблем с итерацией и модификацией
        const entries = Array.from(this.memoryCache.entries());
        for (const [key, value] of entries) {
          if (value && value.expiry && value.expiry < now) {
            this.memoryCache.delete(key);
          }
        }
        
        // Ограничиваем размер кэша
        if (this.memoryCache.size > 1000) {
          // Удаляем самые старые записи
          const sortedEntries = Array.from(this.memoryCache.entries())
            .filter(entry => entry && entry[1] && typeof entry[1].expiry === 'number')
            .sort((a, b) => a[1].expiry - b[1].expiry);
          
          // Оставляем только 500 самых новых записей
          const deleteCount = Math.max(0, sortedEntries.length - 500);
          for (let i = 0; i < deleteCount; i++) {
            if (sortedEntries[i] && sortedEntries[i][0]) {
              this.memoryCache.delete(sortedEntries[i][0]);
            }
          }
        }
      }
    } catch (error) {
      console.error('[RedisService] Error cleaning memory cache:', error);
    }
  }
  
  /**
   * Очищает все устаревшие данные из кэша в памяти
   */
  private cleanMemoryCache(): void {
    try {
      // Очищаем устаревшие данные
      const now = Date.now();
      
      // Безопасная итерация по Map с проверкой наличия свойств
      // Преобразуем в массив для избежания проблем с итерацией и модификацией
      const entries = Array.from(this.memoryCache.entries());
      
      // Счетчик удаленных записей
      let removedCount = 0;
      
      // Удаляем устаревшие записи
      for (const [key, value] of entries) {
        if (value && value.expiry && value.expiry < now) {
          this.memoryCache.delete(key);
          removedCount++;
        }
      }
      
      // Ограничиваем размер кэша
      if (this.memoryCache.size > 1000) {
        // Получаем и сортируем записи (только валидные записи с expiry)
        const sortedEntries = entries
          .filter(entry => entry && entry[1] && typeof entry[1].expiry === 'number')
          .sort((a, b) => {
            if (a && a[1] && b && b[1] && typeof a[1].expiry === 'number' && typeof b[1].expiry === 'number') {
              return a[1].expiry - b[1].expiry;
            }
            return 0; // Если что-то из проверяемых значений отсутствует, сохраняем порядок
          });
        
        // Оставляем только 500 самых новых записей
        const deleteCount = Math.max(0, sortedEntries.length - 500);
        
        // Удаляем самые старые записи
        for (let i = 0; i < deleteCount; i++) {
          const entry = sortedEntries[i];
          if (entry && entry[0]) {
            this.memoryCache.delete(entry[0]);
            removedCount++;
          }
        }
      }
      
      // Логируем, только если было что-то удалено
      if (removedCount > 0) {
        console.log(`[RedisService] Memory cache cleanup: removed ${removedCount} entries. Current size: ${this.memoryCache.size}`);
      }
    } catch (error) {
      console.error('[RedisService] Error cleaning memory cache:', error);
    }
  }
  
  /**
   * Очищает ресурсы и освобождает память
   */
  public cleanup(): void {
    try {
      console.log('[RedisService] Cleaning up resources...');
      
      // Останавливаем очистку кэша в памяти
      if (this._cleanupInterval) {
        clearInterval(this._cleanupInterval);
        this._cleanupInterval = null;
      }
      
      // Очищаем кэш в памяти
      this.memoryCache.clear();
      
      // Уничтожаем Redis-клиент если он существует
      if (this.cache && typeof this.cache.destroy === 'function') {
        this.cache.destroy();
      }
      
      console.log('[RedisService] Resources cleaned up successfully');
    } catch (error) {
      console.error('[RedisService] Error cleaning up resources:', error);
    }
  }
}

// Создаем и экспортируем синглтон сервиса
export const redisService = new RedisService(); 