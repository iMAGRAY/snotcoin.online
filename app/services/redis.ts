/**
 * Сервис для работы с Redis
 */

import { createClient } from 'redis';
import { apiLogger as logger } from '../lib/logger';
import { ENV } from '../lib/env';
import { Redis } from 'ioredis';

// Типы для Redis сервиса
export interface ServiceResponse {
  success: boolean;
  error?: string;
  data?: any;
  source?: string;
}

// Конфигурация Redis
const REDIS_URL = ENV.REDIS_URL;
const REDIS_PREFIX = 'snotcoin:';
const REDIS_ENABLED = ENV.REDIS_ENABLED;
const MAX_CONNECTION_ATTEMPTS = 3;

// Переменные для отслеживания состояния Redis
let redisClient: any = null;
let redisConnectionFailed = false;
let connectionAttempts = 0;

// Глобальная переменная для отслеживания доступности Redis
let isRedisAvailable = false;
let isConnectionFailed = false;
let connectionFailureTime = 0;
const RECONNECT_TIMEOUT = 5 * 60 * 1000; // 5 минут между попытками подключения

/**
 * Получает Redis клиент, создавая его при необходимости
 */
export async function getRedisClient(): Promise<Redis | null> {
  // Если Redis уже инициализирован и доступен, возвращаем его
  if (redisClient && isRedisAvailable) {
    return redisClient;
  }
  
  // Если соединение ранее не удалось и не прошел таймаут переподключения,
  // возвращаем null без новых попыток
  if (isConnectionFailed && (Date.now() - connectionFailureTime) < RECONNECT_TIMEOUT) {
    return null;
  }
  
  // Пытаемся инициализировать новое соединение
  return initRedisClient();
}

/**
 * Инициализирует Redis клиент
 */
export async function initRedisClient(): Promise<Redis | null> {
  // Сбрасываем флаги при инициализации
  isConnectionFailed = false;
  
  if (redisClient && isRedisAvailable) {
    return redisClient;
  }
  
  console.log("[Redis] Автоматическая инициализация соединения при запросе клиента");
  console.log("[Redis] Установка соединения с Redis...");
  
  const MAX_RETRIES = 3;
  connectionAttempts = 0;
  
  while (connectionAttempts < MAX_RETRIES) {
    connectionAttempts++;
    console.log(`[Redis] Попытка ${connectionAttempts} из ${MAX_RETRIES}`);
    
    try {
      const options: any = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: parseInt(process.env.REDIS_DB || '0'),
        connectTimeout: 5000, // 5 секунд
        maxRetriesPerRequest: 1
      };
      
      // Добавляем пароль только если он указан
      if (process.env.REDIS_PASSWORD) {
        options.password = process.env.REDIS_PASSWORD;
      }
      
      const newClient = new Redis(options);
      
      await newClient.ping();
      console.log("[Redis] Соединение установлено успешно!");
      
      // Успешное подключение - устанавливаем флаги
      redisClient = newClient;
      redisConnectionFailed = false;
      isRedisAvailable = true;
      isConnectionFailed = false;
      
      // Настраиваем обработчик для автоматического переподключения при разрыве соединения
      newClient.on('error', (error) => {
        console.error("[Redis] Ошибка соединения:", error);
        handleConnectionError(error);
      });
      
      newClient.on('connect', () => {
        console.log("[Redis] Соединение восстановлено");
        setRedisAvailable(true);
      });
      
      return newClient;
    } catch (error) {
      console.error("[Redis] Ошибка соединения:", error);
      
      if (connectionAttempts < MAX_RETRIES) {
        console.log("[Redis] Попытка переподключения...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log("[Redis] Достигнуто максимальное количество попыток соединения");
        redisConnectionFailed = true;
        handleConnectionError(error as Error);
        return null;
      }
    }
  }
  
  return null;
}

/**
 * Проверяет, доступен ли Redis
 */
export const isRedisServiceAvailable = (): boolean => {
  // Если соединение не удалось ранее, и не прошло время таймаута переподключения,
  // считаем Redis недоступным без новых попыток соединения
  if (isConnectionFailed && (Date.now() - connectionFailureTime) < RECONNECT_TIMEOUT) {
    return false;
  }
  
  return isRedisAvailable;
};

/**
 * Обрабатывает ошибку соединения с Redis
 */
export const handleConnectionError = (error: Error): void => {
  console.error('[Redis] Ошибка соединения:', error);
  isRedisAvailable = false;
  isConnectionFailed = true;
  connectionFailureTime = Date.now();
};

/**
 * Устанавливает статус Redis как доступный
 */
export const setRedisAvailable = (available: boolean = true): void => {
  isRedisAvailable = available;
  if (available) {
    isConnectionFailed = false;
  }
};

/**
 * Сервис для работы с Redis
 */
export const redisService = {
  /**
   * Проверяет, доступен ли Redis
   */
  async isAvailable(): Promise<boolean> {
    if (!REDIS_ENABLED || redisConnectionFailed) {
      return false;
    }
    
    try {
      const client = await getRedisClient();
      return client !== null;
    } catch (error) {
      return false;
    }
  },
  
  /**
   * Получает статус Redis
   */
  getStatus(): { enabled: boolean, connected: boolean, connectionFailed: boolean, attempts: number } {
    return {
      enabled: REDIS_ENABLED,
      connected: redisClient !== null,
      connectionFailed: redisConnectionFailed,
      attempts: connectionAttempts
    };
  },
  
  /**
   * Сбрасывает состояние подключения
   */
  resetConnectionState() {
    redisConnectionFailed = false;
    connectionAttempts = 0;
    if (redisClient) {
      try {
        redisClient.quit();
      } catch (error) {
        console.error('[Redis] Ошибка при закрытии соединения:', error);
      }
      redisClient = null;
    }
  },
  
  /**
   * Сохраняет состояние игры в Redis
   */
  async saveGameState(
    userId: string, 
    gameState: any, 
    options: { 
      isCritical?: boolean, 
      compression?: boolean,
      metadata?: Record<string, any>
    } = {}
  ): Promise<ServiceResponse> {
    const { isCritical = false, compression = false, metadata = {} } = options;
    
    // Если Redis отключен, сразу возвращаем успех, но с флагом, что это был фейковый успех
    if (!REDIS_ENABLED || redisConnectionFailed) {
      return { success: true, source: 'redis_disabled' };
    }
    
    try {
      const client = await getRedisClient();
      if (!client) {
        logger.error('Redis клиент не инициализирован при сохранении', { userId });
        return { success: false, error: 'REDIS_NOT_INITIALIZED' };
      }
      
      // Логируем информацию о провайдере, если доступна
      if (gameState._provider) {
        logger.info('Сохранение в Redis с информацией о провайдере', {
          userId,
          provider: gameState._provider
        });
      }
      
      // Ключ для сохранения состояния игры
      const gameStateKey = `${REDIS_PREFIX}gamestate:${userId}`;
      
      // Сохраняем в Redis с таймаутом
      const savePromise = async () => {
        await client.set(gameStateKey, JSON.stringify(gameState));
        
        // Устанавливаем TTL (время жизни) в зависимости от важности сохранения
        if (isCritical) {
          // Для критических сохранений - 7 дней
          await client.expire(gameStateKey, 7 * 24 * 60 * 60);
        } else {
          // Для обычных сохранений - 1 день
          await client.expire(gameStateKey, 24 * 60 * 60);
        }
      };
      
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout saving to Redis')), 3000);
      });
      
      await Promise.race([savePromise(), timeoutPromise]);
      
      return { success: true };
    } catch (error) {
      logger.error('Ошибка при сохранении игры в Redis', { 
        error: error instanceof Error ? error.message : String(error)
      });
      return { success: false, error: 'REDIS_SAVE_ERROR' };
    }
  },
  
  /**
   * Загружает состояние игры из Redis
   */
  async loadGameState(userId: string): Promise<ServiceResponse> {
    // Если Redis отключен, сразу возвращаем ошибку
    if (!REDIS_ENABLED || redisConnectionFailed) {
      return { success: false, error: 'REDIS_DISABLED' };
    }
    
    try {
      const client = await getRedisClient();
      if (!client) {
        logger.error('Redis клиент не инициализирован при загрузке', { userId });
        return { success: false, error: 'REDIS_NOT_INITIALIZED' };
      }
      
      // Ключ для загрузки состояния игры
      const gameStateKey = `${REDIS_PREFIX}gamestate:${userId}`;
      
      // Получаем данные из Redis с таймаутом
      const loadPromise = client.get(gameStateKey);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout loading from Redis')), 3000);
      });
      
      const gameStateJson = await Promise.race([loadPromise, timeoutPromise]) as string | null;
      
      if (!gameStateJson) {
        console.log(`[GameSync] Данные для ${userId} не найдены в кэше, загружаем из БД`);
        return { success: false, error: 'NOT_FOUND' };
      }
      
      // Парсим JSON
      const gameState = JSON.parse(gameStateJson);
      
      return { 
        success: true, 
        data: gameState,
        source: 'redis'
      };
    } catch (error) {
      logger.error('Ошибка при загрузке игры из Redis', { 
        error: error instanceof Error ? error.message : String(error)
      });
      return { success: false, error: 'REDIS_LOAD_ERROR' };
    }
  },
  
  /**
   * Обновляет информацию о клиенте, который сохраняет состояние
   */
  async updateClientSaveInfo(userId: string, clientId: string): Promise<boolean> {
    // Если Redis отключен, сразу возвращаем успех
    if (!REDIS_ENABLED || redisConnectionFailed) {
      return true;
    }
    
    try {
      const client = await getRedisClient();
      if (!client) {
        return false;
      }
      
      // Ключ для информации о клиенте
      const clientInfoKey = `${REDIS_PREFIX}clientinfo:${userId}`;
      
      // Сохраняем информацию о клиенте с таймаутом
      const savePromise = async () => {
        await client.set(clientInfoKey, JSON.stringify({
          client_id: clientId,
          timestamp: Date.now()
        }));
        
        // Устанавливаем TTL - 30 минут
        await client.expire(clientInfoKey, 30 * 60);
      };
      
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout updating client info in Redis')), 2000);
      });
      
      await Promise.race([savePromise(), timeoutPromise]);
      
      return true;
    } catch (error) {
      logger.error('Ошибка при обновлении информации о клиенте', { 
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  },
  
  /**
   * Получает информацию о клиенте, который последним сохранял состояние
   */
  async getClientSaveInfo(userId: string): Promise<{ client_id: string, timestamp: number } | null> {
    // Если Redis отключен, сразу возвращаем null
    if (!REDIS_ENABLED || redisConnectionFailed) {
      return null;
    }
    
    try {
      const client = await getRedisClient();
      if (!client) {
        return null;
      }
      
      // Ключ для информации о клиенте
      const clientInfoKey = `${REDIS_PREFIX}clientinfo:${userId}`;
      
      // Получаем данные из Redis с таймаутом
      const loadPromise = client.get(clientInfoKey);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout getting client info from Redis')), 2000);
      });
      
      const clientInfoJson = await Promise.race([loadPromise, timeoutPromise]) as string | null;
      
      if (!clientInfoJson) {
        return null;
      }
      
      // Парсим JSON
      return JSON.parse(clientInfoJson);
    } catch (error) {
      logger.error('Ошибка при получении информации о клиенте', { 
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
};

// Wrapper для сохранения и загрузки данных с учетом возможного отсутствия Redis
export const saveRawData = async (key: string, data: any, expirationSeconds?: number): Promise<boolean> => {
  try {
    // Если Redis недоступен, возвращаем false без попыток сохранения
    if (!isRedisServiceAvailable()) {
      console.log(`[Redis] Пропуск сохранения для ${key} - Redis недоступен`);
      return false;
    }
    
    const client = await getRedisClient();
    
    if (!client) {
      console.log(`[Redis] Не удалось получить клиент для сохранения ${key}`);
      return false;
    }
    
    if (expirationSeconds) {
      await client.setex(key, expirationSeconds, typeof data === 'string' ? data : JSON.stringify(data));
    } else {
      await client.set(key, typeof data === 'string' ? data : JSON.stringify(data));
    }
    
    return true;
  } catch (error) {
    console.error(`[Redis] Ошибка при сохранении данных для ${key}:`, error);
    handleConnectionError(error as Error);
    return false;
  }
};

export const loadRawData = async (key: string): Promise<any | null> => {
  try {
    // Если Redis недоступен, возвращаем null без попыток загрузки
    if (!isRedisServiceAvailable()) {
      console.log(`[Redis] Пропуск загрузки для ${key} - Redis недоступен`);
      return null;
    }
    
    const client = await getRedisClient();
    
    if (!client) {
      console.log(`[Redis] Не удалось получить клиент для загрузки ${key}`);
      return null;
    }
    
    const data = await client.get(key);
    
    if (!data) {
      return null;
    }
    
    try {
      return JSON.parse(data);
    } catch {
      return data; // Если не удалось распарсить как JSON, возвращаем как строку
    }
  } catch (error) {
    console.error(`[Redis] Ошибка при загрузке данных для ${key}:`, error);
    handleConnectionError(error as Error);
    return null;
  }
}; 