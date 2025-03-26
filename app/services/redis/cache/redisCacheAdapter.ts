/**
 * Адаптер для работы с Redis-кэшем
 */

import { RedisCache } from '../types/redisTypes';
import { redisConnectionManager } from '../connection/redisConnectionManager';
import { TIMEOUTS } from '../utils/constants';

/**
 * Реализует интерфейс RedisCache для взаимодействия с Redis
 */
export class RedisCacheAdapter implements RedisCache {
  /**
   * Проверяет доступность Redis
   */
  public async ping(): Promise<boolean> {
    const client = redisConnectionManager.getClient();
    
    if (!client) {
      return false;
    }
    
    try {
      // Добавляем таймаут для ping операции
      const pingPromise = client.ping();
      const result = await Promise.race([
        pingPromise,
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Redis ping timeout')), TIMEOUTS.PING)
        )
      ]);
      
      return result === 'PONG';
    } catch (error) {
      console.warn('[RedisCache] Ошибка при выполнении ping:', error);
      return false;
    }
  }
  
  /**
   * Устанавливает значение в Redis
   * @param key Ключ
   * @param value Значение
   * @param ttl Время жизни в секундах (опционально)
   */
  public async set(key: string, value: string, ttl?: number): Promise<boolean> {
    const client = redisConnectionManager.getClient();
    
    if (!client) {
      return false;
    }
    
    try {
      if (ttl) {
        await client.set(key, value, 'EX', ttl);
      } else {
        await client.set(key, value);
      }
      
      return true;
    } catch (error) {
      console.error('[RedisCache] Ошибка при установке значения:', error);
      return false;
    }
  }
  
  /**
   * Получает значение из Redis
   * @param key Ключ
   */
  public async get<T = any>(key: string): Promise<T | null> {
    const client = redisConnectionManager.getClient();
    
    if (!client) {
      return null;
    }
    
    try {
      const value = await client.get(key);
      
      if (value === null) {
        return null;
      }
      
      try {
        // Пытаемся распарсить JSON
        return JSON.parse(value) as T;
      } catch {
        // Если не получается распарсить, возвращаем как строку
        return value as unknown as T;
      }
    } catch (error) {
      console.error('[RedisCache] Ошибка при получении значения:', error);
      return null;
    }
  }
  
  /**
   * Удаляет значение из Redis
   * @param key Ключ
   */
  public async del(key: string): Promise<boolean> {
    const client = redisConnectionManager.getClient();
    
    if (!client) {
      return false;
    }
    
    try {
      await client.del(key);
      return true;
    } catch (error) {
      console.error('[RedisCache] Ошибка при удалении значения:', error);
      return false;
    }
  }
  
  /**
   * Проверяет существование ключа в Redis
   * @param key Ключ
   */
  public async exists(key: string): Promise<boolean> {
    const client = redisConnectionManager.getClient();
    
    if (!client) {
      return false;
    }
    
    try {
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('[RedisCache] Ошибка при проверке существования ключа:', error);
      return false;
    }
  }
  
  /**
   * Получает время жизни ключа в Redis (в секундах)
   * @param key Ключ
   */
  public async ttl(key: string): Promise<number> {
    const client = redisConnectionManager.getClient();
    
    if (!client) {
      return -2; // -2 означает, что ключ не существует
    }
    
    try {
      const result = await client.ttl(key);
      return result;
    } catch (error) {
      console.error('[RedisCache] Ошибка при получении TTL:', error);
      return -2;
    }
  }
  
  /**
   * Устанавливает время жизни ключа в Redis
   * @param key Ключ
   * @param ttl Время жизни в секундах
   */
  public async expire(key: string, ttl: number): Promise<boolean> {
    const client = redisConnectionManager.getClient();
    
    if (!client) {
      return false;
    }
    
    try {
      const result = await client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      console.error('[RedisCache] Ошибка при установке TTL:', error);
      return false;
    }
  }
  
  /**
   * Получает список ключей по шаблону
   * @param pattern Шаблон
   */
  public async keys(pattern: string): Promise<string[]> {
    const client = redisConnectionManager.getClient();
    
    if (!client) {
      return [];
    }
    
    try {
      const keys = await client.keys(pattern);
      return keys;
    } catch (error) {
      console.error('[RedisCache] Ошибка при получении ключей:', error);
      return [];
    }
  }
  
  /**
   * Очищает все данные в Redis
   */
  public async flushall(): Promise<boolean> {
    const client = redisConnectionManager.getClient();
    
    if (!client) {
      return false;
    }
    
    try {
      await client.flushall();
      return true;
    } catch (error) {
      console.error('[RedisCache] Ошибка при очистке данных:', error);
      return false;
    }
  }
  
  /**
   * Блокирует ключ на определенное время (реализация распределенной блокировки)
   * @param lockKey Ключ блокировки
   * @param value Значение (обычно идентификатор владельца блокировки)
   * @param ttl Время жизни блокировки в секундах
   */
  public async acquireLock(lockKey: string, value: string, ttl: number = 5): Promise<boolean> {
    const client = redisConnectionManager.getClient();
    
    if (!client) {
      return false;
    }
    
    try {
      // Используем Lua-скрипт для сохранения блокировки с проверкой существования
      const luaScript = `
        if redis.call('exists', KEYS[1]) == 0 then
          redis.call('set', KEYS[1], ARGV[1])
          redis.call('expire', KEYS[1], ARGV[2])
          return 1
        else
          return 0
        end
      `;
      
      const result = await client.eval(
        luaScript, 
        1, // количество ключей
        lockKey, // KEYS[1]
        value, // ARGV[1]
        ttl.toString() // ARGV[2]
      );
      
      return result === 1;
    } catch (error) {
      console.error('[RedisCache] Ошибка при создании блокировки:', error);
      return false;
    }
  }
  
  /**
   * Освобождает блокировку
   * @param lockKey Ключ блокировки
   * @param value Значение (должно совпадать с тем, что было установлено при блокировке)
   */
  public async releaseLock(lockKey: string, value: string): Promise<boolean> {
    const client = redisConnectionManager.getClient();
    
    if (!client) {
      return false;
    }
    
    try {
      // Получаем текущее значение
      const currentValue = await client.get(lockKey);
      
      // Проверяем, что блокировка принадлежит нам
      if (currentValue === value) {
        await client.del(lockKey);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[RedisCache] Ошибка при освобождении блокировки:', error);
      return false;
    }
  }
}

// Экспортируем singleton
export const redisCacheAdapter = new RedisCacheAdapter(); 