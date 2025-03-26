/**
 * Адаптер для работы с Redis-кэшем
 */

import { Redis } from 'ioredis';
import { RedisCache } from '../types/redisTypes';
import { redisConnectionManager } from '../connection/redisConnectionManager';
import { TIMEOUTS, DEFAULT_TTL } from '../utils/constants';

/**
 * Реализует интерфейс RedisCache для взаимодействия с Redis
 */
export class RedisCacheAdapter implements RedisCache {
  /**
   * Проверяет доступность Redis
   */
  public async ping(): Promise<boolean> {
    try {
      const client = await redisConnectionManager.getClient();
      if (!client) {
        return false;
      }
      
      const pong = await client.ping();
      return pong === 'PONG';
    } catch (error) {
      console.error('[RedisCache] Ошибка при проверке соединения:', error);
      return false;
    }
  }
  
  /**
   * Устанавливает значение в Redis
   * @param key Ключ
   * @param value Значение
   * @param ttl Время жизни в секундах (опционально)
   */
  public async set<T>(key: string, value: T, ttl: number = DEFAULT_TTL): Promise<boolean> {
    try {
      const client = await redisConnectionManager.getClient();
      if (!client) {
        console.error('[RedisCache] Не удалось получить клиент Redis');
        return false;
      }
      
      const serializedValue = JSON.stringify(value);
      await client.set(key, serializedValue, 'EX', ttl);
      
      return true;
    } catch (error) {
      console.error('[RedisCache] Ошибка при сохранении данных:', error);
      return false;
    }
  }
  
  /**
   * Получает значение из Redis
   * @param key Ключ
   */
  public async get<T>(key: string): Promise<T | null> {
    try {
      const client = await redisConnectionManager.getClient();
      if (!client) {
        console.error('[RedisCache] Не удалось получить клиент Redis');
        return null;
      }
      
      const data = await client.get(key);
      if (!data) {
        return null;
      }
      
      try {
        return JSON.parse(data) as T;
      } catch (parseError) {
        console.error('[RedisCache] Ошибка при парсинге данных:', parseError);
        return null;
      }
    } catch (error) {
      console.error('[RedisCache] Ошибка при получении данных:', error);
      return null;
    }
  }
  
  /**
   * Удаляет значение из Redis
   * @param key Ключ
   */
  public async del(key: string): Promise<boolean> {
    try {
      const client = await redisConnectionManager.getClient();
      if (!client) {
        console.error('[RedisCache] Не удалось получить клиент Redis');
        return false;
      }
      
      await client.del(key);
      return true;
    } catch (error) {
      console.error('[RedisCache] Ошибка при удалении данных:', error);
      return false;
    }
  }
  
  /**
   * Проверяет существование ключа в Redis
   * @param key Ключ
   */
  public async exists(key: string): Promise<boolean> {
    try {
      const client = await redisConnectionManager.getClient();
      if (!client) {
        console.error('[RedisCache] Не удалось получить клиент Redis');
        return false;
      }
      
      const exists = await client.exists(key);
      return exists > 0;
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
    try {
      const client = await redisConnectionManager.getClient();
      if (!client) {
        console.error('[RedisCache] Не удалось получить клиент Redis');
        return -2;
      }
      
      return await client.ttl(key);
    } catch (error) {
      console.error('[RedisCache] Ошибка при получении TTL:', error);
      return -2;
    }
  }
  
  /**
   * Устанавливает время жизни для ключа
   * @param key Ключ
   * @param seconds Время жизни в секундах
   */
  public async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const client = await redisConnectionManager.getClient();
      if (!client) {
        console.error('[RedisCache] Не удалось получить клиент Redis');
        return false;
      }
      
      const result = await client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      console.error('[RedisCache] Ошибка при установке времени жизни:', error);
      return false;
    }
  }
  
  /**
   * Получает все ключи по шаблону
   * @param pattern Шаблон ключей
   */
  public async keys(pattern: string): Promise<string[]> {
    try {
      const client = await redisConnectionManager.getClient();
      if (!client) {
        console.error('[RedisCache] Не удалось получить клиент Redis');
        return [];
      }
      
      return await client.keys(pattern);
    } catch (error) {
      console.error('[RedisCache] Ошибка при получении ключей:', error);
      return [];
    }
  }
  
  /**
   * Очищает все данные в Redis
   */
  public async flushall(): Promise<boolean> {
    try {
      const client = await redisConnectionManager.getClient();
      if (!client) {
        console.error('[RedisCache] Не удалось получить клиент Redis');
        return false;
      }
      
      await client.flushall();
      return true;
    } catch (error) {
      console.error('[RedisCache] Ошибка при очистке Redis:', error);
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
    try {
      const client = await redisConnectionManager.getClient();
      if (!client) {
        console.error('[RedisCache] Не удалось получить клиент Redis');
        return false;
      }
      
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
    try {
      const client = await redisConnectionManager.getClient();
      if (!client) {
        console.error('[RedisCache] Не удалось получить клиент Redis');
        return false;
      }
      
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

  /**
   * Выполняет произвольный сценарий Lua
   * @param script Сценарий Lua
   * @param keys Ключи
   * @param args Аргументы
   */
  public async eval(script: string, keys: string[], args: string[]): Promise<any> {
    try {
      const client = await redisConnectionManager.getClient();
      if (!client) {
        console.error('[RedisCache] Не удалось получить клиент Redis');
        return null;
      }
      
      return await client.eval(script, keys.length, ...keys, ...args);
    } catch (error) {
      console.error('[RedisCache] Ошибка при выполнении сценария Lua:', error);
      return null;
    }
  }
}

// Экспортируем singleton
export const redisCacheAdapter = new RedisCacheAdapter(); 