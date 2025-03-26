/**
 * Синхронизатор состояния игры между Redis и базой данных
 */

import { ExtendedGameState } from '../../../types/gameTypes';
import { RedisServiceResult } from '../types/redisTypes';
import { PrismaClient } from '@prisma/client';
import { redisCacheAdapter } from '../cache/redisCacheAdapter';
import { memoryCacheManager } from '../cache/memoryCacheManager';
import { REDIS_KEY_PREFIXES, DEFAULT_TTL, CRITICAL_TTL } from '../utils/constants';
import { redisService } from '../core/redisService';
import { localStorageService } from '../../storage/localStorageService';

// Константы для ключей Redis
export const REDIS_KEYS = {
  GAME_DATA: 'game:data',
  USER_SAVE_INFO: 'user:save:info',
  SECURITY_LOG: 'security:log'
};

/**
 * Результат операции синхронизации
 */
export interface SyncResult<T = any> {
  status: 'success' | 'error' | 'not_found';
  message: string;
  data: T | null;
  error?: string;
}

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
          gameState = JSON.parse(serializedState as string) as unknown as ExtendedGameState;
          
          // Проверка валидности объекта после парсинга
          if (!gameState || typeof gameState !== 'object' || !gameState.inventory) {
            throw new Error('Полученные данные из Redis не соответствуют структуре ExtendedGameState');
          }
          
          // Сохраняем в память для быстрого доступа
          memoryCacheManager.set(primaryKey, gameState, DEFAULT_TTL);
          
          return {
            success: true,
            data: gameState,
            source,
            metrics: {
              duration: Date.now() - startTime,
              cacheHit: true,
              size: (serializedState as string).length
            }
          };
        } catch (parseError) {
          console.error('[GameSync] Ошибка при парсинге JSON из Redis:', parseError);
          
          // Удаляем поврежденные данные из Redis
          try {
            await redisCacheAdapter.del(source === 'redis' ? primaryKey : criticalKey);
            console.log(`[GameSync] Удалены поврежденные данные из Redis для ${userId}`);
          } catch (deleteError) {
            console.error('[GameSync] Ошибка при удалении поврежденных данных:', deleteError);
          }
          
          // Продолжаем выполнение и попробуем загрузить из БД
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
            dbGameState = gameStateData as unknown as ExtendedGameState;
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
            
            // Пытаемся сначала распарсить из строки JSON
            try {
              dbGameState = JSON.parse(gameStateData) as unknown as ExtendedGameState;
              console.log(`[GameSync] Данные из БД успешно распарсены из строки JSON`);
            } catch (parseError) {
              console.error(`[GameSync] Ошибка парсинга строки JSON из БД:`, parseError);
              return { 
                success: false, 
                error: 'Error parsing game state JSON',
                metrics: {
                  duration: Date.now() - startTime,
                  cacheHit: false
                }
              };
            }
          } else {
            // Если уже в виде объекта, приводим к нужному типу через unknown
            dbGameState = gameStateData as unknown as ExtendedGameState;
            console.log(`[GameSync] Данные из БД успешно получены как объект`);
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
          this.saveGameState(userId, dbGameState as unknown as ExtendedGameState, true).catch(err => {
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

  /**
   * Проверяет и при необходимости мигрирует структуру состояния игры
   * @param state Текущее состояние игры
   * @param userId ID пользователя
   * @returns Мигрированное состояние
   */
  private migrateGameStateIfNeeded(state: ExtendedGameState, userId: string): ExtendedGameState {
    try {
      // Если состояние уже верной версии, проверим только критические поля
      if (state._saveVersion && state._saveVersion >= 2) {
        // Дополнительно проверяем критические поля даже для новых версий
        const migratedState = { ...state };
        let needsRepair = false;

        // Проверяем поле Cap в инвентаре
        if (migratedState.inventory && migratedState.inventory.Cap === undefined) {
          console.log(`[GameSync] Отсутствует поле Cap в инвентаре для ${userId}, исправляем`);
          migratedState.inventory.Cap = migratedState.inventory.containerCapacity || 100;
          needsRepair = true;
        }

        // Если обновления не требуются, возвращаем исходное состояние
        if (!needsRepair) {
          return state;
        }

        // Обновляем метаданные о ремонте, но не меняем версию
        if (!migratedState._repairedFields) migratedState._repairedFields = [];
        migratedState._repairedFields.push('critical_fields_repair');
        migratedState._wasRepaired = true;
        migratedState._repairedAt = Date.now();

        return migratedState;
      }
      
      console.log(`[GameSync] Обнаружена устаревшая версия данных для ${userId}, выполняем миграцию`);
      
      // Копируем состояние для безопасного изменения
      const migratedState = { ...state };
      
      // Заполняем отсутствующие поля
      migratedState._saveVersion = 2;
      migratedState._lastModified = Date.now();
      
      // Проверка наличия базовых структур
      if (!migratedState.inventory) {
        console.log(`[GameSync] Отсутствует инвентарь, создаем базовую структуру`);
        migratedState.inventory = {
          snot: 0,
          snotCoins: 0,
          containerCapacity: 100,
          containerSnot: 0,
          fillingSpeed: 1,
          collectionEfficiency: 1,
          Cap: 100,
          containerCapacityLevel: 1,
          fillingSpeedLevel: 1,
          lastUpdateTimestamp: Date.now()
        };
      } else {
        // Проверяем наличие поля Cap в инвентаре
        if (migratedState.inventory.Cap === undefined) {
          console.log(`[GameSync] Отсутствует поле Cap в инвентаре, создаем на основе containerCapacity`);
          migratedState.inventory.Cap = migratedState.inventory.containerCapacity || 100;
        }
      }
      
      if (!migratedState.container) {
        console.log(`[GameSync] Отсутствует контейнер, создаем базовую структуру`);
        migratedState.container = {
          level: 1,
          capacity: 100,
          currentAmount: 0,
          fillRate: 1
        };
      }
      
      if (!migratedState.upgrades) {
        console.log(`[GameSync] Отсутствуют улучшения, создаем базовую структуру`);
        migratedState.upgrades = {
          clickPower: { level: 1, value: 1 },
          passiveIncome: { level: 1, value: 0.1 },
          collectionEfficiencyLevel: 1,
          containerLevel: 1,
          fillingSpeedLevel: 1
        };
      }
      
      // Проверка на наличие stats
      if (!migratedState.stats) {
        console.log(`[GameSync] Отсутствуют статистики, создаем базовую структуру`);
        migratedState.stats = {
          clickCount: 0,
          playTime: 0,
          startDate: new Date().toISOString(),
          totalSnot: 0,
          totalSnotCoins: 0,
          highestLevel: 1,
          consecutiveLoginDays: 0
        };
      }
      
      // Добавляем метаданные
      if (!migratedState._userId) {
        migratedState._userId = userId;
      }
      
      // Отметка о миграции
      migratedState._wasRepaired = true;
      migratedState._repairedAt = Date.now();
      migratedState._repairedFields = migratedState._repairedFields || [];
      migratedState._repairedFields.push('structure_migration_v2');
      
      console.log(`[GameSync] Миграция данных для ${userId} успешно выполнена`);
      
      return migratedState;
    } catch (error) {
      console.error(`[GameSync] Ошибка при миграции данных:`, error);
      // В случае ошибки возвращаем исходное состояние
      return state;
    }
  }

  public async syncGameState(userId: string, mode?: 'pull' | 'push'): Promise<SyncResult<ExtendedGameState>> {
    console.log(`[GameSync] Синхронизация игрового состояния для пользователя ${userId}, режим: ${mode || 'auto'}`);
    
    if (!userId) {
      return {
        status: 'error',
        message: 'ID пользователя не указан',
        data: null
      };
    }

    try {
      // Получаем данные из Redis
      const redisClient = await redisService.getClient();
      const redisGameState = redisClient ? await redisClient.get(`gameState_${userId}`) : null;
      
      // Получаем текущее состояние из локального хранилища
      const localGameState = localStorageService.getItem(`gameState_${userId}`) as string | null;
      
      let gameStateData: ExtendedGameState;
      
      // Если данные найдены в Redis и режим не push, используем их и обновляем локальное хранилище
      if (redisGameState && mode !== 'push') {
        try {
          gameStateData = JSON.parse(redisGameState) as ExtendedGameState;
          
          // Применяем миграцию данных если необходимо
          gameStateData = this.migrateGameStateIfNeeded(gameStateData, userId);
          
          console.log(`[GameSync] Получены данные из Redis для ${userId}`, gameStateData);
          
          // Сохраняем в локальное хранилище
          localStorageService.setItem(`gameState_${userId}`, JSON.stringify(gameStateData));
        } catch (error) {
          console.error(`[GameSync] Ошибка при обработке данных из Redis:`, error);
          return {
            status: 'error',
            message: 'Ошибка при обработке данных из Redis',
            data: null
          };
        }
      }
      // Если в Redis нет данных или режим push, используем локальные данные
      else if (localGameState && (mode === 'push' || !redisGameState)) {
        try {
          gameStateData = JSON.parse(localGameState) as ExtendedGameState;
          
          // Применяем миграцию данных если необходимо
          gameStateData = this.migrateGameStateIfNeeded(gameStateData, userId);
          
          console.log(`[GameSync] Используем локальные данные для ${userId}`, gameStateData);
          
          // Обновляем данные в Redis
          if (redisClient) {
            await redisClient.set(`gameState_${userId}`, JSON.stringify(gameStateData));
            await redisClient.expire(`gameState_${userId}`, DEFAULT_TTL);
          }
        } catch (error) {
          console.error(`[GameSync] Ошибка при использовании локальных данных:`, error);
          return {
            status: 'error',
            message: 'Ошибка при использовании локальных данных',
            data: null
          };
        }
      }
      // Если ни в Redis ни локально нет данных, возвращаем ошибку
      else {
        console.log(`[GameSync] Данные не найдены для ${userId}`);
        return {
          status: 'not_found',
          message: 'Данные не найдены',
          data: null
        };
      }

      return {
        status: 'success',
        message: `Данные ${mode === 'push' ? 'отправлены' : mode === 'pull' ? 'получены' : 'синхронизированы'}`,
        data: gameStateData
      };
    } catch (error) {
      console.error(`[GameSync] Ошибка при синхронизации данных:`, error);
      return {
        status: 'error',
        message: `Ошибка при синхронизации: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
        data: null
      };
    }
  }
}

// Экспортируем singleton
export const gameStateSynchronizer = new GameStateSynchronizer(); 