/**
 * Синхронизатор состояния игры между Redis и базой данных
 */

import { ExtendedGameState } from '../../../types/gameTypes';
import { RedisServiceResult } from '../types/redisTypes';
import { PrismaClient } from '@prisma/client';
import { redisCacheAdapter } from '../cache/redisCacheAdapter';
import { memoryCacheManager } from '../cache/memoryCacheManager';
import { REDIS_KEY_PREFIXES, DEFAULT_TTL, CRITICAL_TTL } from '../utils/constants';

// Создаем экземпляр Prisma
const prisma = new PrismaClient();

/**
 * Тип источника данных
 */
type DataSource = 'redis' | 'redis-critical' | 'memory' | 'database';

/**
 * Класс для синхронизации состояния игры между Redis и базой данных
 */
export class GameStateSynchronizer {
  /**
   * Сохраняет состояние игры
   * @param userId ID пользователя
   * @param state Состояние игры
   * @param isCritical Флаг критичности данных
   */
  public async saveGameState(
    userId: string, 
    state: ExtendedGameState, 
    isCritical: boolean = false
  ): Promise<RedisServiceResult<boolean>> {
    const startTime = Date.now();
    
    try {
      // Подготавливаем данные
      const gameStateJson = JSON.stringify(state);
      const ttl = isCritical ? CRITICAL_TTL : DEFAULT_TTL;
      
      // Ключи в Redis
      const primaryKey = REDIS_KEY_PREFIXES.GAME_STATE + userId;
      const criticalKey = REDIS_KEY_PREFIXES.CRITICAL_GAME_STATE + userId;
      
      // Сохраняем в память для быстрого доступа
      memoryCacheManager.set(primaryKey, state, ttl);
      
      // Пытаемся сохранить в Redis
      let redisSuccess = false;
      
      // Если это критическое сохранение, сохраняем в обе копии
      if (isCritical) {
        try {
          // Сначала сохраняем в критический кэш
          const criticalResult = await redisCacheAdapter.set(criticalKey, gameStateJson, CRITICAL_TTL);
          
          // Затем в основной кэш
          redisSuccess = await redisCacheAdapter.set(primaryKey, gameStateJson, DEFAULT_TTL);
          
          if (!criticalResult && !redisSuccess) {
            throw new Error('Не удалось сохранить ни в одну из копий Redis');
          }
        } catch (criticalError) {
          console.error('[GameSync] Ошибка сохранения критических данных:', criticalError);
          redisSuccess = false;
        }
      } else {
        // Для обычного сохранения только в основной кэш
        redisSuccess = await redisCacheAdapter.set(primaryKey, gameStateJson, DEFAULT_TTL);
      }
      
      // Если Redis недоступен, создаем задачу отложенной синхронизации
      if (!redisSuccess) {
        try {
          // Отложенная синхронизация с Redis будет выполнена фоновым процессом
          await this.queueRedisSyncTask(userId);
        } catch (queueError) {
          console.error('[GameSync] Ошибка создания задачи синхронизации:', queueError);
        }
      }
      
      return {
        success: true,
        source: redisSuccess ? 'redis' : 'memory',
        metrics: {
          duration: Date.now() - startTime,
          size: gameStateJson.length
        }
      };
    } catch (error) {
      console.error('[GameSync] Ошибка сохранения игровых данных:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          duration: Date.now() - startTime
        }
      };
    }
  }
  
  /**
   * Загружает состояние игры
   * @param userId ID пользователя
   */
  public async loadGameState(userId: string): Promise<RedisServiceResult<ExtendedGameState>> {
    const startTime = Date.now();
    
    try {
      // Ключи в Redis
      const primaryKey = REDIS_KEY_PREFIXES.GAME_STATE + userId;
      const criticalKey = REDIS_KEY_PREFIXES.CRITICAL_GAME_STATE + userId;
      
      // Пытаемся загрузить из памяти
      const memoryState = memoryCacheManager.get<ExtendedGameState>(primaryKey);
      
      if (memoryState) {
        console.log(`[GameSync] Данные для ${userId} загружены из памяти`);
        
        return {
          success: true,
          data: memoryState,
          source: 'memory',
          metrics: {
            duration: Date.now() - startTime,
            cacheHit: true
          }
        };
      }
      
      // Пытаемся загрузить из Redis
      let gameState: ExtendedGameState | undefined;
      let source: DataSource = 'redis';
      
      // Сначала пытаемся получить из основного кэша
      let serializedState = await redisCacheAdapter.get(primaryKey);
      
      // Если в основном кэше нет, пробуем из критического
      if (!serializedState) {
        serializedState = await redisCacheAdapter.get(criticalKey);
        source = 'redis-critical';
        
        if (serializedState) {
          console.log(`[GameSync] Данные для ${userId} восстановлены из критического кэша`);
        }
      }
      
      // Если нашли в Redis, парсим и возвращаем
      if (serializedState) {
        try {
          gameState = JSON.parse(serializedState) as ExtendedGameState;
          
          // Сохраняем в память для быстрого доступа
          memoryCacheManager.set(primaryKey, gameState, DEFAULT_TTL);
          
          return {
            success: true,
            data: gameState,
            source,
            metrics: {
              duration: Date.now() - startTime,
              cacheHit: true,
              size: serializedState.length
            }
          };
        } catch (parseError) {
          console.error('[GameSync] Ошибка при парсинге JSON из Redis:', parseError);
        }
      }
      
      // Если данных нет в Redis, пытаемся загрузить из БД
      console.log(`[GameSync] Данные для ${userId} не найдены в кэше, загружаем из БД`);
      
      try {
        const userProgress = await prisma.progress.findUnique({
          where: { user_id: userId }
        });
        
        if (userProgress) {
          // Проверяем тип и формат данных перед парсингом
          let dbGameState: ExtendedGameState;
          
          // Извлекаем game_state из записи
          const gameStateData = userProgress.game_state;
          
          // Обрабатываем разные типы представления данных
          if (typeof gameStateData === 'object' && gameStateData !== null) {
            // Если это уже объект (Prisma может вернуть данные в виде объекта)
            dbGameState = gameStateData as ExtendedGameState;
            console.log(`[GameSync] Данные из БД уже в формате объекта`);
          } else if (typeof gameStateData === 'string') {
            // Проверяем, не является ли строка "[object Object]"
            if (gameStateData === '[object Object]') {
              console.error(`[GameSync] Некорректные данные в БД: ${gameStateData}`);
              return {
                success: false,
                error: 'Некорректный формат данных в БД',
                metrics: {
                  duration: Date.now() - startTime,
                  cacheHit: false
                }
              };
            }
            
            // Пытаемся распарсить как JSON
            try {
              dbGameState = JSON.parse(gameStateData) as ExtendedGameState;
              console.log(`[GameSync] Данные из БД успешно распарсены из JSON-строки`);
            } catch (parseError) {
              console.error(`[GameSync] Ошибка при парсинге данных из БД:`, parseError);
              return {
                success: false,
                error: `Ошибка при парсинге данных: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                metrics: {
                  duration: Date.now() - startTime,
                  cacheHit: false
                }
              };
            }
          } else {
            console.error(`[GameSync] Неизвестный тип данных в БД: ${typeof gameStateData}`);
            return {
              success: false,
              error: `Неизвестный тип данных в БД: ${typeof gameStateData}`,
              metrics: {
                duration: Date.now() - startTime,
                cacheHit: false
              }
            };
          }
          
          // Проверяем валидность полученных данных
          if (!dbGameState || typeof dbGameState !== 'object' || !dbGameState.inventory) {
            console.error(`[GameSync] Данные из БД имеют некорректную структуру`);
            return {
              success: false,
              error: 'Данные из БД имеют некорректную структуру',
              metrics: {
                duration: Date.now() - startTime,
                cacheHit: false
              }
            };
          }
          
          // Убедимся, что userId установлен в объекте состояния
          if (!dbGameState._userId) {
            dbGameState._userId = userId;
          }
          
          // Сохраняем в Redis и память для следующих запросов
          this.saveGameState(userId, dbGameState, true).catch(err => {
            console.error('[GameSync] Ошибка кэширования загруженных данных:', err);
          });
          
          return {
            success: true,
            data: dbGameState,
            source: 'database',
            metrics: {
              duration: Date.now() - startTime,
              cacheHit: false,
              size: typeof gameStateData === 'string' ? gameStateData.length : JSON.stringify(gameStateData).length
            }
          };
        } else {
          console.warn(`[GameSync] Прогресс пользователя ${userId} не найден в БД`);
        }
      } catch (dbError) {
        console.error('[GameSync] Ошибка при загрузке из БД:', dbError);
      }
      
      // Если данных нет нигде
      return {
        success: false,
        error: 'Данные не найдены',
        metrics: {
          duration: Date.now() - startTime,
          cacheHit: false
        }
      };
    } catch (error) {
      console.error('[GameSync] Ошибка загрузки игровых данных:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          duration: Date.now() - startTime
        }
      };
    }
  }
  
  /**
   * Удаляет состояние игры из всех хранилищ
   * @param userId ID пользователя
   */
  public async deleteGameState(userId: string): Promise<RedisServiceResult<boolean>> {
    const startTime = Date.now();
    
    try {
      // Ключи в Redis
      const primaryKey = REDIS_KEY_PREFIXES.GAME_STATE + userId;
      const criticalKey = REDIS_KEY_PREFIXES.CRITICAL_GAME_STATE + userId;
      
      // Удаляем из памяти
      memoryCacheManager.delete(primaryKey);
      
      // Удаляем из Redis
      let redisSuccess = true;
      
      try {
        await redisCacheAdapter.del(primaryKey);
        await redisCacheAdapter.del(criticalKey);
      } catch (redisError) {
        console.error('[GameSync] Ошибка при удалении из Redis:', redisError);
        redisSuccess = false;
      }
      
      // Удаляем из БД
      let dbSuccess = true;
      
      try {
        await prisma.progress.delete({
          where: { user_id: userId }
        });
      } catch (dbError) {
        if ((dbError as any).code !== 'P2025') { // Не найдено
          console.error('[GameSync] Ошибка при удалении из БД:', dbError);
          dbSuccess = false;
        }
      }
      
      return {
        success: dbSuccess || redisSuccess,
        metrics: {
          duration: Date.now() - startTime
        }
      };
    } catch (error) {
      console.error('[GameSync] Ошибка удаления игровых данных:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          duration: Date.now() - startTime
        }
      };
    }
  }
  
  /**
   * Синхронизирует данные из Redis в БД
   * @param userId ID пользователя
   * @param forceSave Принудительное сохранение
   */
  public async syncToDB(userId: string, forceSave: boolean = false): Promise<RedisServiceResult<boolean>> {
    const startTime = Date.now();
    
    try {
      // Создаем задачу синхронизации с БД
      await this.queueDbSyncTask(userId, forceSave);
      
      return {
        success: true,
        metrics: {
          duration: Date.now() - startTime
        }
      };
    } catch (error) {
      console.error('[GameSync] Ошибка синхронизации с БД:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          duration: Date.now() - startTime
        }
      };
    }
  }
  
  /**
   * Создает задачу синхронизации с Redis
   * @param userId ID пользователя
   */
  private async queueRedisSyncTask(userId: string): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO sync_queue (user_id, operation, data, status, created_at, updated_at)
        VALUES (
          ${userId}, 
          ${'REDIS_SYNC'}, 
          ${JSON.stringify({ 
            userId, 
            operation: 'saveGameState',
            timestamp: Date.now() 
          })}::jsonb, 
          ${'pending'}, 
          NOW(), 
          NOW()
        )
      `;
      console.log(`[GameSync] Создана задача синхронизации с Redis для ${userId}`);
    } catch (error) {
      console.error('[GameSync] Ошибка создания задачи Redis синхронизации:', error);
      throw error;
    }
  }
  
  /**
   * Создает задачу синхронизации с БД
   * @param userId ID пользователя
   * @param forceSave Принудительное сохранение
   */
  private async queueDbSyncTask(userId: string, forceSave: boolean = false): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO sync_queue (user_id, operation, data, status, created_at, updated_at)
        VALUES (
          ${userId}, 
          ${'DB_SYNC'}, 
          ${JSON.stringify({ 
            userId, 
            forceSave,
            timestamp: Date.now() 
          })}::jsonb, 
          ${'pending'}, 
          NOW(), 
          NOW()
        )
      `;
      console.log(`[GameSync] Создана задача синхронизации с БД для ${userId}`);
    } catch (error) {
      console.error('[GameSync] Ошибка создания задачи DB синхронизации:', error);
      throw error;
    }
  }
}

// Экспортируем singleton
export const gameStateSynchronizer = new GameStateSynchronizer(); 