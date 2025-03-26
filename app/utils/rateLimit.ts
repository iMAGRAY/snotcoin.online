/**
 * Модуль для ограничения частоты запросов (rate limiting)
 * Использует Redis для хранения состояния между запросами, что эффективно
 * при работе с несколькими экземплярами сервера
 */

import { redisService } from '../services/redis';
import { logger } from '../lib/logger';

/**
 * Результат проверки ограничения запросов
 */
export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  count: number;
  limit: number;
}

/**
 * Обертка для системы ограничения запросов (Rate limiting)
 */
export const rateLimit = {
  /**
   * Проверяет ограничение запросов
   * @param key Ключ для ограничения (обычно IP-адрес)
   * @param action Тип действия
   * @param limit Максимальное количество запросов
   * @param windowMs Временное окно в миллисекундах
   * @returns Результат проверки
   */
  async check(key: string, action: string, limit: number, windowMs: number = 60000): Promise<RateLimitResult> {
    try {
      const counterKey = `ratelimit:${action}:${key}`;
      const ttlSeconds = Math.ceil(windowMs / 1000);
      
      // Увеличиваем счетчик в Redis
      const count = await redisService.incrementCounter(counterKey, ttlSeconds);
      
      // Получаем оставшееся время до сброса ограничения
      const ttl = await redisService.getTTL(counterKey);
      
      return {
        success: count <= limit,
        remaining: Math.max(0, limit - count),
        reset: Date.now() + (ttl * 1000),
        count,
        limit
      };
    } catch (error) {
      logger.error('Ошибка проверки ограничения запросов', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      // В случае ошибки разрешаем запрос
      return {
        success: true,
        remaining: 1,
        reset: Date.now() + 60000,
        count: 0,
        limit
      };
    }
  },
  
  /**
   * Добавляет подозрительный IP в список наблюдения
   * @param ip IP-адрес
   * @param reason Причина добавления
   * @param metadata Дополнительные данные
   */
  async addToWatchlist(ip: string, reason: string, metadata: Record<string, any> = {}): Promise<boolean> {
    try {
      await redisService.addToWatchlist(ip, {
        type: 'rate_limit_violation',
        reason,
        timestamp: Date.now(),
        ...metadata
      });
      return true;
    } catch (error) {
      logger.error('Ошибка добавления IP в список наблюдения', {
        error: error instanceof Error ? error.message : String(error),
        ip
      });
      return false;
    }
  },
  
  /**
   * Блокирует IP на указанное время
   * @param ip IP-адрес для блокировки
   * @param seconds Время блокировки в секундах
   * @param reason Причина блокировки
   */
  async blockIP(ip: string, seconds: number = 3600, reason: string = 'rate_limit_violation'): Promise<boolean> {
    try {
      const blockKey = `block:ip:${ip}`;
      await redisService.getClient().then(client => {
        if (client) {
          client.set(blockKey, reason);
          client.expire(blockKey, seconds);
        }
      });
      
      logger.warn(`IP ${ip} заблокирован на ${seconds} секунд по причине: ${reason}`);
      return true;
    } catch (error) {
      logger.error('Ошибка блокировки IP', {
        error: error instanceof Error ? error.message : String(error),
        ip
      });
      return false;
    }
  },
  
  /**
   * Проверяет, заблокирован ли IP
   * @param ip IP-адрес для проверки
   * @returns true если IP заблокирован
   */
  async isBlocked(ip: string): Promise<boolean> {
    try {
      const blockKey = `block:ip:${ip}`;
      const client = await redisService.getClient();
      if (!client) return false;
      
      const blocked = await client.exists(blockKey);
      return blocked > 0;
    } catch (error) {
      logger.error('Ошибка проверки блокировки IP', {
        error: error instanceof Error ? error.message : String(error),
        ip
      });
      return false;
    }
  }
}; 