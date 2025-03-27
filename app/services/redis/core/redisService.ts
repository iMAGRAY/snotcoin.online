/**
 * Основной сервис для работы с Redis
 */

import { redisConnectionManager } from '../connection/redisConnectionManager';
import { redisCacheAdapter } from '../cache/redisCacheAdapter';
import { memoryCacheManager } from '../cache/memoryCacheManager';
import { gameStateSynchronizer } from '../sync/gameStateSynchronizer';
import { RedisServiceResult, GameStateOptions, CacheStats } from '../types/redisTypes';
import { ExtendedGameState } from '../../../types/gameTypes';
import { CRITICAL_TTL, DEFAULT_TTL } from '../utils/constants';
import { ClientSaveInfo } from '../types/redisTypes';

/**
 * Класс основного сервиса для работы с Redis
 */
export class RedisService {
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
      const key = `client-save-info:${userId}`;
      const result = await redisCacheAdapter.get<ClientSaveInfo>(key);
      return result;
    } catch (error) {
      console.error('[RedisService] Ошибка получения информации о сохранении клиента:', error);
      return null;
    }
  }

  /**
   * Обновляет информацию о сохранении клиента
   * @param userId ID пользователя
   * @param clientId ID клиента
   * @param metadata Метаданные
   */
  public async updateClientSaveInfo(
    userId: string, 
    clientId: string, 
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      const key = `client-save-info:${userId}`;
      const saveInfo: ClientSaveInfo = {
        client_id: clientId,
        timestamp: Date.now(),
        metadata
      };
      
      return await redisCacheAdapter.set(key, JSON.stringify(saveInfo), DEFAULT_TTL);
    } catch (error) {
      console.error('[RedisService] Ошибка обновления информации о сохранении клиента:', error);
      return false;
    }
  }
}

// Экспортируем singleton
export const redisService = new RedisService(); 