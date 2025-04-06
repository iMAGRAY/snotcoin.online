/**
 * Фабрика для создания экземпляров RedisService
 */

import { RedisService } from './redisService';
import { RedisSettings } from '../types/redisTypes';

/**
 * Фабрика для создания настраиваемых экземпляров RedisService
 */
export class RedisServiceFactory {
  /**
   * Создает экземпляр RedisService с настройками по умолчанию
   */
  public static createDefault(): RedisService {
    return new RedisService();
  }
  
  /**
   * Создает экземпляр RedisService с пользовательскими настройками
   * @param settings Настройки подключения к Redis
   */
  public static createWithSettings(settings: RedisSettings): RedisService {
    // Проверяем обязательные настройки
    if (!settings.host || !settings.port) {
      throw new Error('Настройки Redis должны включать хост и порт');
    }
    
    // Настраиваем переменные окружения для экземпляра
    process.env.REDIS_HOST = settings.host;
    process.env.REDIS_PORT = String(settings.port);
    
    if (settings.password) {
      process.env.REDIS_PASSWORD = settings.password;
    }
    
    // Создаем экземпляр сервиса
    return new RedisService();
  }
  
  /**
   * Создает тестовый экземпляр RedisService с моком
   */
  public static createForTesting(): RedisService {
    // Устанавливаем переменные окружения для тестового экземпляра
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.REDIS_PASSWORD = '';
    
    // Создаем экземпляр сервиса (в реальности здесь можно было бы заменить
    // реальный Redis на мок-объект для тестирования без реального Redis)
    return new RedisService();
  }
}

/**
 * Получает экземпляр RedisService, подходящий для текущего окружения
 */
export function getRedisService(): RedisService {
  // Проверяем, находимся ли мы в тестовом окружении
  const isTestEnv = process.env.NODE_ENV === 'test';
  
  if (isTestEnv) {
    return RedisServiceFactory.createForTesting();
  }
  
  // Для всех остальных окружений используем настройки из переменных окружения
  return RedisServiceFactory.createDefault();
} 