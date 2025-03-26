/**
 * Модуль для работы с Redis
 */

// Добавлю импорт redisService в начало файла
import { redisService } from './core/redisService';

// Основные сервисы
export { redisService };
export { RedisService } from './core/redisService';
export { RedisServiceFactory, getRedisService } from './core/redisServiceFactory';

// Компоненты кэширования
export { redisCacheAdapter } from './cache/redisCacheAdapter';
export { memoryCacheManager } from './cache/memoryCacheManager';

// Компоненты соединения
export { redisConnectionManager } from './connection/redisConnectionManager';

// Компоненты синхронизации
export { gameStateSynchronizer } from './sync/gameStateSynchronizer';

// Типы и константы
export * from './types/redisTypes';
export * from './utils/constants';

/**
 * Интерфейс для информации о сохранении клиента
 */
export interface ClientSaveInfo {
  client_id: string;
  timestamp: number;
  save_count?: number;
  concurrent_count?: number;
  last_ip?: string;
  last_source?: string;
}

/**
 * Интерфейс для события безопасности
 */
export interface SecurityEvent {
  type: string;
  userId: string;
  clientId: string;
  clientIp: string;
  timestamp: number;
  targetId?: string;
  details?: Record<string, any>;
}

/**
 * Класс для работы с Redis
 */
class RedisService {
  // ... existing code ...

  /**
   * Увеличивает счетчик с указанным TTL
   * @param key Ключ счетчика
   * @param ttlSeconds Время жизни счетчика в секундах
   * @returns Новое значение счетчика
   */
  async incrementCounter(key: string, ttlSeconds: number = 60): Promise<number> {
    try {
      const redis = await redisService.getClient();
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
      const redis = await redisService.getClient();
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
   * Получает информацию о последнем сохранении от клиента
   * @param userId ID пользователя
   * @returns Информация о клиенте или null
   */
  async getClientSaveInfo(userId: string): Promise<ClientSaveInfo | null> {
    try {
      const redis = await redisService.getClient();
      if (!redis) return null;
      
      const key = `client_info:${userId}`;
      const data = await redis.get(key);
      
      if (!data) return null;
      
      return JSON.parse(data) as ClientSaveInfo;
    } catch (error) {
      console.error('[Redis] Error getting client save info', error);
      return null;
    }
  }

  /**
   * Обновляет информацию о клиенте после сохранения
   * @param userId ID пользователя
   * @param clientId ID клиента
   * @param options Опции обновления
   * @returns true если информация обновлена успешно
   */
  async updateClientSaveInfo(userId: string, clientId: string, options: {
    increment_concurrent?: boolean;
    source?: string;
    ip?: string;
  } = {}): Promise<boolean> {
    try {
      const redis = await redisService.getClient();
      if (!redis) return false;
      
      const key = `client_info:${userId}`;
      const currentData = await redis.get(key);
      
      let clientInfo: ClientSaveInfo;
      
      if (currentData) {
        clientInfo = JSON.parse(currentData) as ClientSaveInfo;
        clientInfo.timestamp = Date.now();
        clientInfo.save_count = (clientInfo.save_count || 0) + 1;
        
        // Если сохранение с другого клиента, увеличиваем счетчик конкурентных сохранений
        if (options.increment_concurrent && clientInfo.client_id !== clientId) {
          clientInfo.concurrent_count = (clientInfo.concurrent_count || 0) + 1;
        }
        
        clientInfo.client_id = clientId;
        if (options.ip) clientInfo.last_ip = options.ip;
        if (options.source) clientInfo.last_source = options.source;
      } else {
        clientInfo = {
          client_id: clientId,
          timestamp: Date.now(),
          save_count: 1,
          concurrent_count: 0
        };
        
        if (options.ip) clientInfo.last_ip = options.ip;
        if (options.source) clientInfo.last_source = options.source;
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
   * Добавляет пользователя в список для наблюдения
   * @param userId ID пользователя
   * @param data Дополнительные данные
   * @returns true если пользователь добавлен в список
   */
  async addToWatchlist(userId: string, data: Record<string, any>): Promise<boolean> {
    try {
      const redis = await redisService.getClient();
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
  
  // ... existing code ...
} 