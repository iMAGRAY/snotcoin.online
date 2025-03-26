/**
 * Основной сервис для работы с Redis
 */

import { redisConnectionManager } from '../connection/redisConnectionManager';
import { redisCacheAdapter } from '../cache/redisCacheAdapter';
import { memoryCacheManager } from '../cache/memoryCacheManager';
import { gameStateSynchronizer } from '../sync/gameStateSynchronizer';
import { RedisServiceResult, GameStateOptions, CacheStats, ClientSaveInfo } from '../types/redisTypes';
import { SecurityEvent } from '../../../types/redisTypes';
import { ExtendedGameState } from '../../../types/gameTypes';
import { CRITICAL_TTL, DEFAULT_TTL } from '../utils/constants';

/**
 * Тип для опций обновления информации о клиенте
 */
interface UpdateClientSaveInfoOptions {
  increment_concurrent?: boolean;
  ip?: string;
  source?: string;
}

/**
 * Класс основного сервиса для работы с Redis
 */
export class RedisService {
  // Приватное свойство для клиента Redis
  private client: any = null;
  
  /**
   * Инициализирует соединение с Redis
   */
  public async initialize(): Promise<boolean> {
    try {
      return await redisConnectionManager.initialize();
    } catch (error) {
      console.error('[RedisService] Ошибка инициализации:', error);
      return false;
    }
  }
  
  /**
   * Проверяет доступность Redis
   */
  public async isAvailable(): Promise<boolean> {
    try {
      return await redisCacheAdapter.ping();
    } catch (error) {
      console.error('[RedisService] Ошибка проверки доступности:', error);
      return false;
    }
  }
  
  /**
   * Сохраняет состояние игры
   * @param userId ID пользователя
   * @param gameState Состояние игры
   * @param options Опции сохранения
   */
  public async saveGameState(
    userId: string,
    gameState: ExtendedGameState,
    options: GameStateOptions = {}
  ): Promise<RedisServiceResult<boolean>> {
    // Если состояние игры не определено, возвращаем ошибку
    if (!gameState) {
      return {
        success: false,
        error: 'Состояние игры не определено'
      };
    }
    
    try {
      const isCritical = options.isCritical ?? false;
      const ttl = options.ttl ?? (isCritical ? CRITICAL_TTL : DEFAULT_TTL);
      
      return await gameStateSynchronizer.saveGameState(userId, gameState, isCritical);
    } catch (error) {
      console.error('[RedisService] Ошибка сохранения состояния игры:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Загружает состояние игры
   * @param userId ID пользователя
   */
  public async loadGameState(userId: string): Promise<RedisServiceResult<ExtendedGameState>> {
    try {
      return await gameStateSynchronizer.loadGameState(userId);
    } catch (error) {
      console.error('[RedisService] Ошибка загрузки состояния игры:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Удаляет состояние игры
   * @param userId ID пользователя
   */
  public async deleteGameState(userId: string): Promise<RedisServiceResult<boolean>> {
    try {
      return await gameStateSynchronizer.deleteGameState(userId);
    } catch (error) {
      console.error('[RedisService] Ошибка удаления состояния игры:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Принудительно синхронизирует состояние игры с базой данных
   * @param userId ID пользователя
   */
  public async syncGameStateToDB(userId: string): Promise<RedisServiceResult<boolean>> {
    try {
      return await gameStateSynchronizer.syncToDB(userId, true);
    } catch (error) {
      console.error('[RedisService] Ошибка синхронизации с БД:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Очищает кэш для пользователя
   * @param userId ID пользователя
   */
  public clearUserCache(userId: string): void {
    try {
      memoryCacheManager.clearForUser(userId);
    } catch (error) {
      console.error('[RedisService] Ошибка очистки кэша пользователя:', error);
    }
  }
  
  /**
   * Получает статистику кэша
   */
  public async getCacheStats(): Promise<CacheStats> {
    try {
      const memoryStats = memoryCacheManager.getStats();
      const redisAvailable = await this.isAvailable();
      
      return {
        ...memoryStats,
        isAvailable: redisAvailable
      };
    } catch (error) {
      console.error('[RedisService] Ошибка получения статистики кэша:', error);
      
      return {
        isAvailable: false,
        memoryCacheSize: 0,
        itemCount: 0,
        memoryUsage: 0,
        totalOperations: 0,
        hitRatio: 0,
        errorRate: 1,
        lastError: error instanceof Error ? error.message : String(error),
        lastErrorTime: Date.now()
      };
    }
  }
  
  /**
   * Закрывает соединение с Redis
   */
  public async disconnect(): Promise<void> {
    try {
      // Останавливаем очистку кэша в памяти
      memoryCacheManager.stopCacheCleanup();
      
      // Отключаемся от Redis
      await redisConnectionManager.disconnect();
    } catch (error) {
      console.error('[RedisService] Ошибка отключения:', error);
    }
  }

  /**
   * Получает информацию о сохранении клиента
   * @param userId ID пользователя
   */
  public async getClientSaveInfo(userId: string): Promise<ClientSaveInfo | null> {
    try {
      const redis = await this.getClient();
      if (!redis) return null;
      
      const key = `client_info:${userId}`;
      const data = await redis.get(key);
      
      if (!data) return null;
      
      return JSON.parse(data) as ClientSaveInfo;
    } catch (error) {
      console.error('[RedisService] Ошибка получения информации о сохранении клиента:', error);
      return null;
    }
  }

  /**
   * Обновляет информацию о клиенте после сохранения
   */
  async updateClientSaveInfo(userId: string, clientId: string, options: {
    increment_concurrent?: boolean;
    source?: string;
    ip?: string;
  } = {}): Promise<boolean> {
    try {
      const redis = await this.getClient();
      if (!redis) return false;
      
      const key = `client_info:${userId}`;
      const currentData = await redis.get(key);
      
      let clientInfo: ClientSaveInfo;
      
      if (currentData) {
        clientInfo = JSON.parse(currentData) as ClientSaveInfo;
        clientInfo.timestamp = Date.now();
        
        if (clientInfo.save_count !== undefined) {
          clientInfo.save_count++;
        } else {
          clientInfo.save_count = 1;
        }
        
        // Если сохранение с другого клиента, увеличиваем счетчик конкурентных сохранений
        if (options.increment_concurrent && clientInfo.client_id !== clientId) {
          if (clientInfo.concurrent_count !== undefined) {
            clientInfo.concurrent_count++;
          } else {
            clientInfo.concurrent_count = 1;
          }
        }
        
        clientInfo.client_id = clientId;
        if (options.ip) clientInfo.last_ip = options.ip;
        if (options.source) clientInfo.last_source = options.source;
      } else {
        clientInfo = {
          client_id: clientId,
          timestamp: Date.now(),
          save_count: 1,
          concurrent_count: 0,
          last_ip: options.ip,
          last_source: options.source,
        };
      }
      
      await redis.set(key, JSON.stringify(clientInfo));
      await redis.expire(key, 60 * 60 * 24); // 24 часа
      
      return true;
    } catch (error) {
      console.error('[Redis] Error updating client save info', error);
      return false;
    }
  }

  /**
   * Получает клиент Redis
   * @returns Клиент Redis или null
   */
  async getClient() {
    try {
      if (this.client) return this.client;
      
      // Получаем соединение через менеджер соединений
      this.client = await redisConnectionManager.getClient();
      return this.client;
    } catch (error) {
      console.error('[Redis] Error getting Redis client', error);
      return null;
    }
  }

  /**
   * Увеличивает счетчик с указанным TTL
   * @param key Ключ счетчика
   * @param ttlSeconds Время жизни счетчика в секундах
   * @returns Новое значение счетчика
   */
  async incrementCounter(key: string, ttlSeconds: number = 60): Promise<number> {
    try {
      const redis = await this.getClient();
      if (!redis) return 0;
      
      const value = await redis.incr(key);
      await redis.expire(key, ttlSeconds);
      
      return value;
    } catch (error) {
      console.error('[Redis] Error incrementing counter', error);
      return 0;
    }
  }

  /**
   * Добавляет запись о событии безопасности
   * @param event Информация о событии безопасности
   * @returns true если запись добавлена успешно
   */
  async logSecurityEvent(event: SecurityEvent): Promise<boolean> {
    try {
      const redis = await this.getClient();
      if (!redis) return false;
      
      // Основной лог
      const key = `security:events`;
      await redis.lpush(key, JSON.stringify({
        ...event,
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
      }));
      await redis.ltrim(key, 0, 999); // Ограничиваем размер лога
      
      // Счетчик событий по пользователю
      const userKey = `security:user:${event.userId}`;
      await redis.hincrby(userKey, event.type, 1);
      await redis.expire(userKey, 60 * 60 * 24 * 30); // 30 дней
      
      // Счетчик событий по IP
      const ipKey = `security:ip:${event.clientIp}`;
      await redis.hincrby(ipKey, event.type, 1);
      await redis.expire(ipKey, 60 * 60 * 24 * 7); // 7 дней
      
      return true;
    } catch (error) {
      console.error('[Redis] Error logging security event', error);
      return false;
    }
  }

  /**
   * Добавляет пользователя в список для наблюдения
   * @param userId ID пользователя
   * @param data Дополнительные данные
   * @returns true если пользователь добавлен в список
   */
  async addToWatchlist(userId: string, data: Record<string, any>): Promise<boolean> {
    try {
      const redis = await this.getClient();
      if (!redis) return false;
      
      const key = 'watchlist';
      const entry = {
        userId,
        ...data,
        added_at: Date.now()
      };
      
      await redis.hset(key, userId, JSON.stringify(entry));
      
      return true;
    } catch (error) {
      console.error('[Redis] Error adding user to watchlist', error);
      return false;
    }
  }

  /**
   * Получает время жизни (TTL) для ключа в Redis
   * @param key Ключ для проверки TTL
   * @returns Время жизни в секундах или -1 если ключ не существует, -2 если ключ не имеет TTL
   */
  async getTTL(key: string): Promise<number> {
    try {
      const redis = await this.getClient();
      if (!redis) return -1;
      
      const ttl = await redis.ttl(key);
      return ttl;
    } catch (error) {
      console.error(`Ошибка при получении TTL для ключа ${key}:`, error);
      return -2;
    }
  }
}

// Экспортируем singleton
export const redisService = new RedisService(); 