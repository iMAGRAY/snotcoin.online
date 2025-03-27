/**
 * Сервис для работы с Redis
 */

import { createClient } from 'redis';
import { apiLogger as logger } from '../lib/logger';
import { ENV } from '../lib/env';

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

/**
 * Получает Redis клиент, создавая его при необходимости
 */
async function getRedisClient() {
  // Если Redis отключен через переменную окружения
  if (!REDIS_ENABLED) {
    console.log('[Redis] Redis отключен через переменную окружения REDIS_ENABLED');
    return null;
  }
  
  // Если предыдущие попытки подключения уже были неудачными, не пытаемся снова
  if (redisConnectionFailed && connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
    console.log(`[Redis] Достигнуто максимальное количество попыток подключения (${MAX_CONNECTION_ATTEMPTS}), Redis отключен`);
    return null;
  }
  
  if (!redisClient) {
    try {
      connectionAttempts++;
      console.log('[Redis] Автоматическая инициализация соединения при запросе клиента');
      console.log('[Redis] Установка соединения с Redis...');
      console.log(`[Redis] Попытка ${connectionAttempts} из ${MAX_CONNECTION_ATTEMPTS}`);
      
      redisClient = createClient({
        url: REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            // Ограничиваем количество повторных попыток
            if (retries >= 3) {
              redisConnectionFailed = true;
              console.error(`[Redis] Превышено количество повторных попыток (${retries})`);
              return new Error('Превышено количество повторных попыток подключения к Redis');
            }
            // Экспоненциальная задержка между попытками: 1s, 2s, 4s
            return Math.min(Math.pow(2, retries) * 1000, 10000);
          },
          connectTimeout: 5000 // 5 секунд таймаут на соединение
        }
      });
      
      redisClient.on('error', (err: any) => {
        console.error('[Redis] Ошибка соединения:', err);
        if (err.code === 'ECONNREFUSED') {
          redisConnectionFailed = true;
        }
        redisClient = null;
      });
      
      redisClient.on('ready', () => {
        console.log('[Redis] Соединение установлено');
        console.log('[Redis] Клиент готов к использованию');
        redisConnectionFailed = false;
      });
      
      redisClient.on('reconnecting', () => {
        console.log('[Redis] Попытка переподключения...');
      });
      
      // Устанавливаем таймаут на подключение
      const connectionPromise = redisClient.connect();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout connecting to Redis')), 5000);
      });
      
      await Promise.race([connectionPromise, timeoutPromise]);
      console.log('[Redis] Соединение установлено');
    } catch (error) {
      console.error('[Redis] Ошибка при создании клиента:', error);
      redisClient = null;
      redisConnectionFailed = true;
    }
  }
  
  return redisClient;
}

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