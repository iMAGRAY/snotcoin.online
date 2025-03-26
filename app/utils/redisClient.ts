/**
 * Клиент Redis для кэширования состояний игры
 * Обеспечивает сжатие данных и эффективное хранение
 */

// Импортируем Redis только на стороне сервера
let Redis: any;
// Проверяем, что код выполняется на сервере
const isBrowser = typeof window !== 'undefined';

if (!isBrowser) {
  try {
    // Динамический импорт на стороне сервера
    Redis = require('ioredis').default;
    console.log('[RedisCache] Successfully imported ioredis');
  } catch (error) {
    console.error('[RedisCache] Error importing ioredis:', error);
    // Создаем заглушку в случае ошибки импорта
    Redis = class MockRedisServer {
      constructor() {
        console.warn('[RedisCache] Using mock Redis on server due to import error');
      }
      on() { return this; }
      ping() { return Promise.resolve(false); }
      set() { return Promise.resolve('OK'); }
      get() { return Promise.resolve(null); }
      hset() { return Promise.resolve(1); }
      expire() { return Promise.resolve(1); }
      quit() { return Promise.resolve('OK'); }
    };
  }
} else {
  // Заглушка для клиентской части
  Redis = class MockRedis {
    constructor() {
      console.warn('[RedisCache] Redis is not available in browser context');
    }
    on() { return this; }
    ping() { return Promise.resolve(false); }
    set() { return Promise.resolve('OK'); }
    get() { return Promise.resolve(null); }
    hset() { return Promise.resolve(1); }
    expire() { return Promise.resolve(1); }
    quit() { return Promise.resolve('OK'); }
  };
}

import { v4 as uuidv4 } from 'uuid';
import { REDIS_CONFIG, RedisPrefix, CacheTTL } from '../config/redis';
import { ExtendedGameState } from '../types/gameTypes';
import { DeltaGameState, CompressedGameState, StructuredGameSave } from '../types/saveTypes';
import { compressGameState, decompressGameState } from './dataCompression';

// Максимальное количество подключений к Redis
const MAX_CONNECTION_ATTEMPTS = 3;

// Время ожидания перед повторным подключением (в миллисекундах)
const RECONNECT_DELAY = 5000;

/**
 * Результат операции Redis
 */
export interface RedisCacheResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warning?: string;
  source?: 'redis' | 'fallback' | 'database' | 'none' | 'error';
  metadata?: {
    size?: number;
    compressionRatio?: number;
    timestamp?: number;
    duration?: number; // время выполнения операции в мс
  };
}

/**
 * Класс для работы с Redis
 */
export class RedisCache {
  private client: any = null;
  private isConnected: boolean = false;
  private isInitializing: boolean = false;
  private connectionAttempts: number = 0;
  private fallbackCache: Map<string, { data: any; expiry: number }> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  
  /**
   * Создает новый экземпляр RedisCache
   */
  constructor() {
    this.initializeClient();
  }
  
  /**
   * Очищает ресурсы при уничтожении объекта
   */
  public destroy(): void {
    try {
      // Очищаем интервал пингования
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      
      // Закрываем соединение с Redis
      if (this.client) {
        this.client.quit().catch((error: Error) => {
          console.warn('[RedisCache] Error while closing Redis connection', error);
        });
        this.client = null;
      }
      
      this.isConnected = false;
      this.isInitializing = false;
      
      console.log('[RedisCache] Resources cleaned up');
    } catch (error) {
      console.error('[RedisCache] Error during cleanup:', error);
    }
  }
  
  /**
   * Инициализирует клиент Redis
   */
  private async initializeClient(): Promise<void> {
    if (this.isInitializing) {
      console.log('[RedisCache] Уже идет инициализация клиента');
      return;
    }

    this.isInitializing = true;
    console.log('[RedisCache] Начинаем инициализацию Redis клиента');

    // Таймер для защиты от зависания
    const initTimeout = setTimeout(() => {
      if (this.isInitializing) {
        console.error('[RedisCache] Инициализация зависла, сбрасываем флаг');
        this.isInitializing = false;
      }
    }, 30000); // 30 сек максимум на инициализацию

    try {
      // Проверяем, не запущены ли мы в браузере
      if (typeof window !== 'undefined') {
        console.log('[RedisCache] Работаем в браузере, используем заглушку');
        this.isConnected = true;
        this.isInitializing = false;
        clearTimeout(initTimeout);
        return;
      }

      // Импортируем Redis только на сервере
      const Redis = (await import('ioredis')).default;
      
      // Создаем клиент с конфигурацией
      const redisConfig = {
        ...REDIS_CONFIG,
        tls: REDIS_CONFIG.tls ? {
          rejectUnauthorized: false
        } : undefined,
        // Добавляем улучшенную стратегию переподключения
        retryStrategy: (times: number) => {
          // Экспоненциальная задержка с верхним пределом
          const delay = Math.min(Math.pow(2, times) * 500, 10000);
          console.log(`[RedisCache] Повторное подключение ${times}, задержка: ${delay}мс`);
          return delay;
        },
        // Увеличиваем таймаут подключения
        connectTimeout: 10000,
        // Максимальное число повторов из конфига
        maxRetriesPerRequest: REDIS_CONFIG.maxReconnectAttempts
      };
      
      this.client = new Redis(redisConfig);
      
      // Устанавливаем обработчики событий
      this.client.on('connect', () => {
        console.log('[RedisCache] Успешно подключились к Redis');
        this.isConnected = true;
        this.connectionAttempts = 0;
        this.startPingInterval();
      });

      this.client.on('error', (error: Error) => {
        console.error('[RedisCache] Ошибка Redis:', error);
        this.isConnected = false;
        this.handleConnectionError();
      });

      this.client.on('close', () => {
        console.log('[RedisCache] Соединение с Redis закрыто');
        this.isConnected = false;
        this.handleConnectionError();
      });

      this.client.on('reconnecting', () => {
        console.log('[RedisCache] Переподключение к Redis...');
        this.isConnected = false;
      });

      // Ждем подключения с таймаутом
      await Promise.race([
        new Promise((resolve) => this.client.once('connect', resolve)),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis connection timeout')), 15000)
        )
      ]);

      // Добавляем паузу и повторную проверку соединения
      await new Promise(resolve => setTimeout(resolve, 1000));
      const pingResult = await this.ping();
      if (pingResult) {
        console.log('[RedisCache] Соединение с Redis подтверждено через ping');
      } else {
        console.warn('[RedisCache] Соединение установлено, но ping не подтвержден, может потребоваться дополнительное время');
      }

      console.log('[RedisCache] Redis клиент успешно инициализирован');
    } catch (error) {
      console.error('[RedisCache] Ошибка инициализации Redis:', error);
      this.isConnected = false;
      this.handleConnectionError();
    } finally {
      clearTimeout(initTimeout);
      this.isInitializing = false;
    }
  }

  private handleConnectionError(): void {
    if (this.connectionAttempts < REDIS_CONFIG.maxReconnectAttempts!) {
      this.connectionAttempts++;
      const delay = REDIS_CONFIG.retryStrategy?.(this.connectionAttempts) || 
                   Math.min(this.connectionAttempts * 1000, 5000);
      
      console.log(`[RedisCache] Попытка переподключения ${this.connectionAttempts} через ${delay}мс`);
      
      setTimeout(() => {
        this.initializeClient().catch(error => {
          console.error('[RedisCache] Ошибка при переподключении:', error);
        });
      }, delay);
    } else {
      console.error('[RedisCache] Превышено максимальное количество попыток подключения');
      this.isConnected = false;
    }
  }

  private startPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(async () => {
      try {
        const isAlive = await this.ping();
        if (!isAlive) {
          console.warn('[RedisCache] Redis не ответил на ping, переподключаемся...');
          this.handleConnectionError();
        }
      } catch (error) {
        console.error('[RedisCache] Ошибка при проверке соединения:', error);
        this.handleConnectionError();
      }
    }, 30000); // Проверяем каждые 30 секунд
  }
  
  /**
   * Проверяет доступность Redis
   * @returns Promise<boolean> Доступен ли Redis
   */
  public async ping(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      
      // Добавляем таймаут и несколько попыток для ping
      const pingWithTimeout = async (timeout: number): Promise<boolean> => {
        return Promise.race([
          this.client.ping().then((result: string) => result === 'PONG'),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeout))
        ]);
      };
      
      // Пробуем выполнить ping с несколькими попытками
      for (let attempt = 0; attempt < 3; attempt++) {
        const result = await pingWithTimeout(1000); // 1 секунда таймаута на ping
        if (result) {
          return true;
        }
        
        // Небольшая пауза между попытками
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      return false;
    } catch (error) {
      console.error('[RedisCache] Ping failed:', error);
      return false;
    }
  }
  
  /**
   * Сохраняет состояние игры в Redis
   * @param userId ID пользователя
   * @param state Состояние игры
   * @param ttl Время жизни в секундах
   * @returns Promise<RedisCacheResult<boolean>> Результат операции
   */
  public async saveGameState(
    userId: string,
    state: ExtendedGameState,
    ttl: number = CacheTTL.FULL_STATE
  ): Promise<RedisCacheResult<boolean>> {
    const startTime = Date.now();
    
    // Проверяем входные данные
    if (!userId || !state) {
      return {
        success: false,
        error: 'Invalid arguments: userId and state are required',
        source: 'error',
        metadata: {
          timestamp: Date.now(),
          duration: 0
        }
      };
    }
    
    // Сохраняем в резервный кэш сразу (это быстрее и не зависит от Redis)
    const fallbackResult = this.saveFallbackCache(
      `${RedisPrefix.GAME_STATE}${userId}`,
      state,
      ttl
    );
    
    try {
      // Если Redis недоступен, используем только fallback
      if (!this.isConnected || !this.client) {
        console.log(`[RedisCache] Redis not connected, using fallback cache for ${userId}`);
        return {
          success: true,
          source: 'fallback',
          metadata: {
            timestamp: Date.now(),
            duration: Date.now() - startTime
          }
        };
      }
      
      // Сжимаем данные перед сохранением
      const compressOptions = {
        removeTempData: true,
        includeIntegrityInfo: true
      };
      
      let compressedState: CompressedGameState | null;
      try {
        compressedState = compressGameState(state, userId, compressOptions);
        
        if (!compressedState) {
          throw new Error('Failed to compress game state');
        }
      } catch (compressionError) {
        console.error(`[RedisCache] Error compressing game state:`, compressionError);
        return {
          success: false,
          error: `Compression error: ${compressionError instanceof Error ? compressionError.message : String(compressionError)}`,
          source: 'error',
          metadata: {
            timestamp: Date.now(),
            duration: Date.now() - startTime
          }
        };
      }
      
      const key = `${RedisPrefix.GAME_STATE}:${userId}`;
      const serializedState = JSON.stringify(compressedState);
      
      // Создаем таймаут для операции
      const timeoutPromise = new Promise<RedisCacheResult<boolean>>((_, reject) => {
        setTimeout(() => reject(new Error('Redis operation timeout')), 
          REDIS_CONFIG.operationTimeout || 5000);
      });
      
      // Выполняем операцию Redis
      const redisOperation = async (): Promise<RedisCacheResult<boolean>> => {
        try {
          // Установка ключа и времени жизни
          if (!this.client) {
            throw new Error('Redis client is not initialized');
          }
          
          // Проверка пинга перед операцией для раннего обнаружения проблем
          try {
            const pingResult = await this.ping();
            if (!pingResult) {
              throw new Error('Redis ping failed before operation');
            }
          } catch (pingError) {
            console.warn(`[RedisCache] Ping failed before saveGameState:`, pingError);
            throw new Error(`Redis not responding: ${pingError instanceof Error ? pingError.message : String(pingError)}`);
          }
          
          // Используем pipeline для атомарной операции
          const pipeline = this.client.pipeline();
          pipeline.set(key, serializedState);
          pipeline.expire(key, ttl);
          
          const results = await pipeline.exec();
          
          if (!results || results.some((result: [Error | null, any]) => result[0] !== null)) {
            const errors = results 
              ? results.filter((r: [Error | null, any]) => r[0] !== null).map((r: [Error | null, any]) => r[0]) 
              : ['Unknown error'];
            throw new Error(`Redis pipeline error: ${errors.join(', ')}`);
          }
          
          // Расчет коэффициента сжатия 
          const originalSize = JSON.stringify(state).length;
          const compressedSize = serializedState.length;
          const ratio = originalSize > 0 ? (originalSize - compressedSize) / originalSize : 0;
          
          console.log(`[RedisCache] Successfully saved game state for ${userId}, compression ratio: ${(ratio * 100).toFixed(1)}%`);
          
          return {
            success: true,
            source: 'redis',
            metadata: {
              size: compressedState._compressedSize,
              compressionRatio: ratio,
              timestamp: Date.now(),
              duration: Date.now() - startTime
            }
          };
        } catch (error) {
          // Повторно проверяем состояние соединения
          this.isConnected = await this.ping();
          
          throw error;
        }
      };
      
      // Запускаем операцию с таймаутом
      try {
        return await Promise.race([redisOperation(), timeoutPromise]);
      } catch (error) {
        console.error(`[RedisCache] Failed to save game state to Redis for ${userId}:`, error);
        
        // Проверяем, не потеряно ли соединение
        this.isConnected = await this.ping();
        
        // Fallback уже выполнен в начале функции, просто возвращаем результат с предупреждением
        return {
          success: true, // все равно успех, так как данные сохранены в fallback
          source: 'fallback',
          warning: `Redis error: ${error instanceof Error ? error.message : String(error)}`,
          metadata: {
            timestamp: Date.now(),
            duration: Date.now() - startTime
          }
        };
      }
    } catch (error) {
      console.error(`[RedisCache] Failed to save game state for ${userId}:`, error);
      
      // Уже сохранено в резервный кэш в начале функции
      return {
        success: true, // все равно успех, так как данные сохранены в fallback
        source: 'fallback',
        warning: `Redis error: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          timestamp: Date.now(),
          duration: Date.now() - startTime
        }
      };
    }
  }
  
  /**
   * Загружает состояние игры из Redis
   * @param userId ID пользователя
   * @returns Promise<RedisCacheResult<ExtendedGameState>> Результат операции с данными игры
   */
  public async loadGameState(
    userId: string
  ): Promise<RedisCacheResult<ExtendedGameState>> {
    const startTime = Date.now();
    
    if (!userId) {
      return {
        success: false,
        error: 'Invalid argument: userId is required',
        source: 'error',
        metadata: {
          timestamp: Date.now(),
          duration: 0
        }
      };
    }
    
    // Сначала проверяем локальный кэш для быстрого доступа
    const key = `${RedisPrefix.GAME_STATE}:${userId}`;
    const localResult = this.loadFromFallbackCache<ExtendedGameState>(key);
    
    if (localResult.success) {
      console.log(`[RedisCache] Game state for ${userId} loaded from fallback cache`);
      return {
        ...localResult,
        metadata: {
          ...localResult.metadata,
          duration: Date.now() - startTime
        }
      };
    }
    
    try {
      // Если Redis недоступен, сразу возвращаем ошибку
      if (!this.isConnected || !this.client) {
        console.warn(`[RedisCache] Redis not connected, cannot load state for ${userId}`);
        return {
          success: false,
          error: 'Redis not connected',
          source: 'none',
          metadata: {
            timestamp: Date.now(),
            duration: Date.now() - startTime
          }
        };
      }
      
      // Создаем таймаут для операции
      const timeoutPromise = new Promise<RedisCacheResult<ExtendedGameState>>((_, reject) => {
        setTimeout(() => reject(new Error('Redis operation timeout')), 
          REDIS_CONFIG.operationTimeout || 5000);
      });
      
      // Выполняем операцию Redis
      const redisOperation = async (): Promise<RedisCacheResult<ExtendedGameState>> => {
        if (!this.client) {
          throw new Error('Redis client is not initialized');
        }
        
        // Получаем данные из Redis
        const serializedState = await this.client.get(key);
        
        if (!serializedState) {
          return {
            success: false,
            error: 'Game state not found in Redis',
            source: 'none',
            metadata: {
              timestamp: Date.now(),
              duration: Date.now() - startTime
            }
          };
        }
        
        // Парсим данные
        try {
          const compressedState = JSON.parse(serializedState) as CompressedGameState;
          
          // Распаковываем данные
          const decompressedState = decompressGameState(compressedState);
          
          if (!decompressedState) {
            throw new Error('Failed to decompress game state');
          }
          
          // Проверяем тип данных и применяем явное приведение типа через unknown
          const gameState = decompressedState as unknown as ExtendedGameState;
          
          // Сохраняем в локальный кэш для будущих запросов
          this.saveFallbackCache(key, gameState, CacheTTL.FULL_STATE);
          
          console.log(`[RedisCache] Successfully loaded game state for ${userId} from Redis`);
          
          return {
            success: true,
            data: gameState,
            source: 'redis',
            metadata: {
              timestamp: Date.now(),
              duration: Date.now() - startTime
            }
          };
        } catch (parseError) {
          console.error(`[RedisCache] Error parsing game state for ${userId}:`, parseError);
          
          // Пытаемся получить данные из структурированного сохранения
          try {
            // Проверяем, может ли это быть структурированным сохранением
            const structuredSave = JSON.parse(serializedState) as StructuredGameSave;
            
            // Проверяем основные поля, необходимые для валидного StructuredGameSave
            if (structuredSave && typeof structuredSave === 'object' && structuredSave.critical) {
              try {
                // Используем нашу специальную функцию для преобразования с необходимыми полями
                const gameState = this.convertStructuredSaveToGameState(structuredSave);
                
                // Сохраняем в локальный кэш
                this.saveFallbackCache(key, gameState, CacheTTL.FULL_STATE);
                
                console.log(`[RedisCache] Converted structured save to game state for ${userId}`);
                
                // Возвращаем преобразованное состояние
                return {
                  success: true,
                  data: gameState,
                  source: 'redis',
                  warning: 'Used structured save conversion',
                  metadata: {
                    timestamp: Date.now(),
                    duration: Date.now() - startTime
                  }
                };
              } catch (conversionError) {
                console.error(`[RedisCache] Error during structured save conversion:`, conversionError);
                throw new Error(`Structured save conversion failed: ${conversionError instanceof Error ? conversionError.message : String(conversionError)}`);
              }
            }
            
            throw new Error('Invalid data format - not a valid compressed or structured game state');
          } catch (structuredParseError) {
            console.error(`[RedisCache] Error parsing structured save:`, structuredParseError);
            throw new Error(`Data parsing error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          }
        }
      };
      
      // Запускаем операцию с таймаутом
      try {
        return await Promise.race([redisOperation(), timeoutPromise]);
      } catch (error) {
        console.error(`[RedisCache] Error loading game state from Redis for ${userId}:`, error);
        
        // Проверяем статус соединения
        this.isConnected = await this.ping();
        
        return {
          success: false,
          error: `Redis operation failed: ${error instanceof Error ? error.message : String(error)}`,
          source: 'error',
          metadata: {
            timestamp: Date.now(),
            duration: Date.now() - startTime
          }
        };
      }
      
    } catch (error) {
      console.error(`[RedisCache] Unhandled error loading game state for ${userId}:`, error);
      
      return {
        success: false,
        error: `Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
        source: 'error',
        metadata: {
          timestamp: Date.now(),
          duration: Date.now() - startTime
        }
      };
    }
  }
  
  /**
   * Сохраняет дельту изменений в Redis
   * @param userId ID пользователя
   * @param delta Дельта изменений
   * @param ttl Время жизни в секундах
   * @returns Promise<RedisCacheResult<boolean>> Результат операции
   */
  public async saveDelta(
    userId: string,
    delta: DeltaGameState,
    ttl: number = CacheTTL.DELTAS
  ): Promise<RedisCacheResult<boolean>> {
    if (!userId || !delta) {
      return {
        success: false,
        error: 'Invalid arguments: userId and delta are required'
      };
    }
    
    try {
      if (!this.isConnected || !this.client) {
        return this.saveFallbackCache(
          `${RedisPrefix.DELTA}:${userId}:${delta._id}`,
          delta,
          ttl
        );
      }
      
      // Сохраняем дельту
      const deltaKey = `${RedisPrefix.DELTA}:${userId}:${delta._id}`;
      const serializedDelta = JSON.stringify(delta);
      
      const saveResult = await this.client.set(deltaKey, serializedDelta);
      if (saveResult !== 'OK') {
        throw new Error(`Redis set operation failed: ${saveResult}`);
      }
      
      await this.client.expire(deltaKey, ttl);
      
      // Добавляем в список дельт
      const listKey = `${RedisPrefix.DELTA_LIST}:${userId}`;
      await this.client.lpush(listKey, delta._id);
      await this.client.expire(listKey, CacheTTL.DELTA_LIST);
      
      // Ограничиваем длину списка
      await this.client.ltrim(listKey, 0, 99);
      
      return {
        success: true,
        metadata: {
          size: serializedDelta.length,
          timestamp: Date.now()
        }
      };
    } catch (error) {
      console.error(`[RedisCache] Failed to save delta for ${userId}:`, error);
      
      // При ошибке сохраняем в резервный кэш
      return this.saveFallbackCache(
        `${RedisPrefix.DELTA}:${userId}:${delta._id}`,
        delta,
        ttl
      );
    }
  }
  
  /**
   * Загружает последние дельты для пользователя
   * @param userId ID пользователя
   * @param limit Максимальное количество дельт
   * @returns Promise<RedisCacheResult<DeltaGameState[]>> Результат операции
   */
  public async loadRecentDeltas(
    userId: string,
    limit: number = 10
  ): Promise<RedisCacheResult<DeltaGameState[]>> {
    if (!userId) {
      return {
        success: false,
        error: 'Invalid argument: userId is required'
      };
    }
    
    try {
      if (!this.isConnected || !this.client) {
        return {
          success: false,
          error: 'Redis not connected'
        };
      }
      
      // Получаем список ID дельт
      const listKey = `${RedisPrefix.DELTA_LIST}:${userId}`;
      const deltaIds = await this.client.lrange(listKey, 0, limit - 1);
      
      if (!deltaIds || deltaIds.length === 0) {
        return {
          success: true,
          data: [],
          metadata: {
            timestamp: Date.now()
          }
        };
      }
      
      // Загружаем дельты
      const deltas: DeltaGameState[] = [];
      
      for (const deltaId of deltaIds) {
        const deltaKey = `${RedisPrefix.DELTA}:${userId}:${deltaId}`;
        const deltaJson = await this.client.get(deltaKey);
        
        if (deltaJson) {
          try {
            const delta = JSON.parse(deltaJson) as DeltaGameState;
            deltas.push(delta);
          } catch (parseError) {
            console.error(`[RedisCache] Failed to parse delta ${deltaId}:`, parseError);
          }
        }
      }
      
      return {
        success: true,
        data: deltas,
        metadata: {
          timestamp: Date.now()
        }
      };
    } catch (error) {
      console.error(`[RedisCache] Failed to load deltas for ${userId}:`, error);
      
      return {
        success: false,
        error: String(error)
      };
    }
  }
  
  /**
   * Преобразует структурированное сохранение в ExtendedGameState
   * @param save Структурированное сохранение
   * @returns ExtendedGameState Состояние игры
   */
  private convertStructuredSaveToGameState(save: StructuredGameSave): ExtendedGameState {
    if (!save || !save.critical) {
      throw new Error('Invalid structured save: missing critical data');
    }
    
    // Если у нас есть полные данные, собираем все вместе
    const gameState: ExtendedGameState = {
      // Существующие поля
      inventory: save.critical.inventory,
      container: save.critical.container,
      upgrades: save.critical.upgrades,
      items: save.regular?.items || [],
      achievements: save.regular?.achievements || { unlockedAchievements: [] },
      stats: save.regular?.stats || {
        clickCount: 0,
        playTime: 0,
        startDate: new Date().toISOString(),
        highestLevel: 1,
        totalSnot: 0,
        totalSnotCoins: 0,
        consecutiveLoginDays: 0
      },
      settings: save.extended?.settings || {
        language: 'en',
        theme: 'light',
        notifications: true,
        tutorialCompleted: false,
        musicEnabled: true,
        soundEnabled: true,
        notificationsEnabled: true
      },
      soundSettings: save.extended?.soundSettings || {
        musicVolume: 0.5,
        soundVolume: 0.5,
        notificationVolume: 0.5,
        clickVolume: 0.5,
        effectsVolume: 0.5,
        backgroundMusicVolume: 0.3,
        isMuted: false,
        isEffectsMuted: false,
        isBackgroundMusicMuted: false
      },
      
      // Добавляем недостающие поля
      activeTab: 'laboratory',
      hideInterface: false,
      isPlaying: false,
      isLoading: false,
      gameStarted: true,
      highestLevel: save.regular?.stats?.highestLevel || 1,
      containerLevel: save.critical.upgrades.containerLevel || 1,
      fillingSpeed: save.critical.inventory.fillingSpeed || 1,
      containerSnot: save.critical.inventory.containerSnot || 0,
      consecutiveLoginDays: save.regular?.stats?.consecutiveLoginDays || 0,
      user: null,
      validationStatus: "pending",
      
      // Метаданные
      _userId: save.integrity.userId,
      _saveVersion: typeof save.integrity.saveVersion === 'string'
        ? parseInt(save.integrity.saveVersion, 10)
        : save.integrity.saveVersion,
      _lastModified: Date.now(),
      _decompressedAt: new Date().toISOString()
    };
    
    return gameState;
  }
  
  /**
   * Сохраняет данные в резервный кэш
   * @param key Ключ
   * @param data Данные
   * @param ttl Время жизни в секундах
   * @returns RedisCacheResult<boolean> Результат операции
   */
  private saveFallbackCache(
    key: string,
    data: any,
    ttl: number
  ): RedisCacheResult<boolean> {
    try {
      // Вычисляем время истечения срока действия
      const expiry = Date.now() + ttl * 1000;
      
      // Клонируем данные для безопасности
      const clonedData = JSON.parse(JSON.stringify(data));
      
      // Сохраняем в кэш
      this.fallbackCache.set(key, {
        data: clonedData,
        expiry
      });
      
      // Запланируем удаление из кэша
      setTimeout(() => {
        const cached = this.fallbackCache.get(key);
        if (cached && cached.expiry === expiry) {
          this.fallbackCache.delete(key);
        }
      }, ttl * 1000);
      
      return {
        success: true,
        metadata: {
          timestamp: Date.now()
        }
      };
    } catch (error) {
      console.error(`[RedisCache] Failed to save to fallback cache:`, error);
      
      return {
        success: false,
        error: String(error)
      };
    }
  }
  
  /**
   * Загружает данные из резервного кэша
   * @param key Ключ
   * @returns RedisCacheResult<T> Результат операции
   */
  private loadFromFallbackCache<T>(key: string): RedisCacheResult<T> {
    try {
      const cached = this.fallbackCache.get(key);
      
      if (!cached || cached.expiry < Date.now()) {
        if (cached) {
          this.fallbackCache.delete(key);
        }
        
        return {
          success: false,
          error: 'Data not found in fallback cache or expired'
        };
      }
      
      return {
        success: true,
        data: JSON.parse(JSON.stringify(cached.data)) as T,
        metadata: {
          timestamp: Date.now()
        }
      };
    } catch (error) {
      console.error(`[RedisCache] Failed to load from fallback cache:`, error);
      
      return {
        success: false,
        error: String(error)
      };
    }
  }
  
  /**
   * Очищает резервный кэш для пользователя
   * @param userId ID пользователя
   */
  private clearFallbackCache(userId: string): void {
    if (!userId) return;
    
    // Удаляем все ключи, содержащие userId
    const keys = Array.from(this.fallbackCache.keys());
    for (const key of keys) {
      if (key.includes(userId)) {
        this.fallbackCache.delete(key);
      }
    }
  }

  /**
   * Проверяет подключение к Redis
   * @returns Promise<boolean> Результат проверки
   */
  public async testConnection(): Promise<boolean> {
    try {
      if (!this.client) {
        console.log('[RedisCache] Клиент Redis не инициализирован');
        return false;
      }

      const result = await this.client.ping();
      console.log('[RedisCache] Результат ping:', result);
      return result === 'PONG';
    } catch (error) {
      console.error('[RedisCache] Ошибка при проверке подключения:', error);
      return false;
    }
  }
} 