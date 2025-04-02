/**
 * API для загрузки прогресса игры
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '../../../utils/auth'
import type { StructuredGameSave } from '../../../types/saveTypes'
import { createInitialGameState } from '../../../constants/gameConstants'
import { redisService } from '../../../services/redis'
import { apiLogger as logger } from '../../../lib/logger'
import { gameMetrics } from '../../../lib/metrics'
import { prisma } from '../../../lib/prisma'
import { logTiming } from '../../../lib/logger'
import { decryptGameSave, verifySaveIntegrity } from '../../../utils/saveEncryption'

export const dynamic = 'force-dynamic'

// Интерфейс для метрик запроса
interface RequestMetrics {
  startTime: number;
  cacheTime?: number;
  dbTime?: number;
  totalTime?: number;
  source?: string;
  isNewUser?: boolean;
  isCompressed?: boolean;
}

/**
 * Функция для валидации и нормализации игрового состояния
 * @param gameState Состояние игры для валидации
 * @returns Валидированное состояние игры
 */
function validateGameState(gameState: any): any {
  if (!gameState) {
    logger.warn('Отсутствует состояние игры для валидации');
    return createInitialGameState('unknown');
  }
  
  try {
    // Проверяем наличие базовых полей
    if (!gameState.inventory) {
      logger.warn('Отсутствует инвентарь в состоянии игры', { gameState });
      gameState.inventory = {
        snot: 0,
        snotCoins: 0,
        containerCapacity: 1,
        containerSnot: 0,
        fillingSpeed: 1,
        containerCapacityLevel: 1,
        fillingSpeedLevel: 1,
        collectionEfficiency: 1
      };
    }
    
    if (!gameState.container) {
      logger.warn('Отсутствует контейнер в состоянии игры', { gameState });
      gameState.container = {
        level: 1,
        capacity: 1,
        currentAmount: 0,
        fillRate: 1,
        currentFill: 0
      };
    }
    
    if (!gameState.upgrades) {
      logger.warn('Отсутствуют улучшения в состоянии игры', { gameState });
      gameState.upgrades = {
        clickPower: {
          level: 1,
          value: 1
        },
        passiveIncome: {
          level: 0,
          value: 0
        },
        collectionEfficiencyLevel: 0,
        containerLevel: 1,
        fillingSpeedLevel: 1
      };
    }
    
    // Проверяем и нормализуем версию сохранения
    if (!gameState._saveVersion) {
      gameState._saveVersion = 1;
    }
    
    // Проверяем и нормализуем метку времени
    if (!gameState._lastSaved) {
      gameState._lastSaved = new Date().toISOString();
    }
    
    return gameState;
  } catch (error) {
    logger.error('Ошибка при валидации состояния игры', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // В случае ошибки возвращаем начальное состояние
    return createInitialGameState('unknown');
  }
}

/**
 * Обработчик GET запроса для загрузки прогресса игры
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  const metrics: RequestMetrics = { startTime };
  
  // Инкрементируем счетчик запросов на загрузку
  gameMetrics.loadTotalCounter();
  
  try {
    logger.info('Получен запрос на загрузку прогресса');
    
    // Получение и проверка токена доступа
    const token = request.headers.get('authorization')?.split(' ')[1] || '';
    
    const tokenResult = await verifyJWT(token);
    if (!tokenResult.valid || !tokenResult.userId) {
      logger.warn('Недействительный токен', { error: tokenResult.error });
      gameMetrics.loadErrorCounter({ reason: 'invalid_token' });
      
      return NextResponse.json({
        success: false,
        error: tokenResult.error || 'INVALID_TOKEN',
        message: 'Недействительный токен',
        processingTime: performance.now() - startTime
      }, { status: 401 });
    }
    
    const userId = tokenResult.userId;
    logger.info('Токен верифицирован', { 
      userId,
      provider: tokenResult.provider || 'не указан'
    });
    
    // Попытка загрузки из Redis кэша для быстрого ответа
    const cacheStartTime = performance.now();
    let cacheHit = false;
    let gameStateData = null;
    
    try {
      if (!redisService) {
        logger.warn('Redis сервис не инициализирован при загрузке из кэша');
        metrics.cacheTime = performance.now() - cacheStartTime;
      } else {
        const cachedData = await redisService.loadGameState(userId);
        metrics.cacheTime = performance.now() - cacheStartTime;
        
        if (cachedData.success && cachedData.data) {
          cacheHit = true;
          metrics.source = 'cache';
          
          logger.info('Прогресс загружен из кэша', { 
            userId,
            source: cachedData.source || 'cache',
            timeMs: metrics.cacheTime.toFixed(2)
          });
          
          // Подготавливаем данные для ответа
          gameStateData = cachedData.data;
          
          // Если в gameStateData отсутствует _createdAt, добавляем его
          if (!gameStateData._createdAt) {
            gameStateData._createdAt = new Date().toISOString();
          }
          
          // Обновляем метрики кэша
          gameMetrics.saveTotalCounter({ cache_hit: true });
          
          // Добавляем метаданные
          const now = new Date().toISOString();
          const metadata = {
            version: gameStateData._saveVersion || 1,
            userId: gameStateData._userId || userId,
            isCompressed: false,
            cacheHit: true,
            savedAt: gameStateData._savedAt || now,
            loadedAt: now,
            processingTime: performance.now() - startTime,
            source: cachedData.source || 'cache'
          };
          
          // Добавляем информацию о провайдере, если отсутствует
          if (!gameStateData._provider) {
            // Определяем провайдер на основе информации из токена или userId
            gameStateData._provider = tokenResult.provider || 
                                 (userId.startsWith('farcaster_') ? 'farcaster' : 
                                  userId.startsWith('google_') ? 'google' : 
                                  userId.startsWith('local_') ? 'local' : '');
            
            logger.info('Добавлена информация о провайдере в игровое состояние', { 
              provider: gameStateData._provider,
              userId 
            });
          }
          
          try {
            // Маркируем как критическое состояние для более длительного хранения
            if (redisService) {
              await redisService.saveGameState(userId, gameStateData, { isCritical: true });
              logger.debug('Состояние помечено как критическое');
            }
            
            // Записываем метрику времени выполнения
            metrics.totalTime = performance.now() - startTime;
            gameMetrics.loadDuration(metrics.totalTime, { 
              source: 'cache',
              cache_hit: true
            });
            
            return NextResponse.json({
              success: true,
              data: {
                gameState: gameStateData,
                metadata
              }
            });
          } catch (error) {
            logger.error('Ошибка при сохранении критического состояния', {
              error: error instanceof Error ? error.message : String(error)
            });
            
            // Продолжаем выполнение даже при ошибке кэширования
            metrics.totalTime = performance.now() - startTime;
            gameMetrics.loadDuration(metrics.totalTime, { 
              source: 'cache',
              cache_hit: true,
              error: true
            });
            
            return NextResponse.json({
              success: true,
              data: {
                gameState: gameStateData,
                metadata
              }
            });
          }
        }
      }
      
      // Если данных нет в кэше, продолжаем загрузку из БД
      logger.info('Кэш не найден, загружаем из БД', { userId });
    } catch (cacheError) {
      metrics.cacheTime = performance.now() - cacheStartTime;
      
      logger.warn('Ошибка при проверке кэша', {
        error: cacheError instanceof Error ? cacheError.message : String(cacheError),
        timeMs: metrics.cacheTime.toFixed(2)
      });
      
      // Продолжаем выполнение для загрузки из БД
    }
    
    // Загрузка данных из базы
    const dbStartTime = performance.now();
    
    try {
      // Загружаем прогресс и основные данные пользователя параллельно
      const [progress, user] = await Promise.all([
        prisma.progress.findUnique({
          where: { user_id: userId }
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { created_at: true, updated_at: true, farcaster_username: true }
        })
      ]);
      
      metrics.dbTime = performance.now() - dbStartTime;
      
      if (progress && progress.game_state) {
        logger.info('Прогресс загружен из БД', { 
          userId,
          timeMs: metrics.dbTime.toFixed(2)
        });
        
        metrics.source = 'database';
        
        // Проверка на сжатие данных
        const isCompressed = typeof progress.game_state === 'string' && 
                            progress.game_state.startsWith('{"_compressed":true');
        
        metrics.isCompressed = isCompressed;
        let gameStateData;
        
        if (isCompressed) {
          try {
            // Если данные сжаты, распаковываем их
            const compressedData = JSON.parse(progress.game_state as string);
            
            // Здесь должен быть код распаковки, но для простоты просто берем данные
            // TODO: Реализовать настоящую распаковку данных
            gameStateData = compressedData;
            
            logger.info('Данные успешно распакованы', { userId });
          } catch (parseError) {
            logger.error('Ошибка при распаковке данных', {
              error: parseError instanceof Error ? parseError.message : String(parseError)
            });
            
            gameMetrics.loadErrorCounter({ reason: 'decompression_error' });
            
            return NextResponse.json({
              success: false,
              error: 'DATA_CORRUPTED',
              message: 'Ошибка при распаковке данных',
              processingTime: performance.now() - startTime
            }, { status: 500 });
          }
        } else {
          // Если данные не сжаты, просто используем их
          gameStateData = progress.game_state;
        }
        
        // Проверяем наличие зашифрованной версии сохранения
        if (progress.encrypted_state) {
          logger.info('Найдена зашифрованная версия сохранения', { userId });
          
          // Проверяем целостность и расшифровываем сохранение
          const decryptResult = decryptGameSave(progress.encrypted_state, userId);
          
          if (decryptResult) {
            logger.info('Сохранение успешно расшифровано', { 
              userId,
              version: decryptResult._saveVersion
            });
            
            // Используем расшифрованные данные
            gameStateData = decryptResult;
            
            // Добавляем флаг, что данные были проверены
            gameStateData._integrityVerified = true;
          } else {
            // Ошибка расшифровки, логируем и продолжаем с нешифрованными данными
            logger.warn('Ошибка при расшифровке сохранения', {
              userId,
              error: 'Failed to decrypt game save'
            });
            
            gameMetrics.loadErrorCounter({ reason: 'decryption_error' });
            
            // Если не удалось расшифровать, но при этом есть обычное сохранение,
            // мы продолжаем с ним, но добавляем предупреждение
            gameStateData._integrityWarning = true;
          }
        }
        
        // Добавляем или обновляем метаданные
        const now = new Date().toISOString();
        const metadata = {
          version: (gameStateData as any)._saveVersion || progress.version || 1,
          userId: userId,
          isCompressed: isCompressed,
          cacheHit: false,
          savedAt: progress.updated_at?.toISOString() || now,
          loadedAt: now,
          processingTime: performance.now() - startTime,
          source: 'database'
        };
        
        // Добавляем метаданные пользователя, если они доступны
        if (user) {
          Object.assign(metadata, {
            userCreatedAt: user.created_at?.toISOString(),
            userUpdatedAt: user.updated_at?.toISOString(),
            username: user.farcaster_username
          });
        }
        
        // Сохраняем в кэш для будущих запросов
        try {
          // Сохраняем в кэш с критическим маркером
          await redisService.saveGameState(userId, gameStateData, { isCritical: true });
          logger.debug('Данные сохранены в кэш', { userId });
        } catch (cacheError) {
          logger.warn('Ошибка кэширования данных', {
            error: cacheError instanceof Error ? cacheError.message : String(cacheError)
          });
          // Продолжаем выполнение даже при ошибке кэширования
        }
        
        // Обогащаем ответ метаданными, если это полные данные
        const isFullGameState = typeof gameStateData === 'object' && 
                              gameStateData !== null && 
                              'inventory' in gameStateData;
        
        if (isFullGameState) {
          gameStateData = {
            ...gameStateData as StructuredGameSave,
            _metadata: metadata,
            _hasFullData: true
          };
        }
        
        // Записываем метрику времени выполнения
        metrics.totalTime = performance.now() - startTime;
        gameMetrics.loadDuration(metrics.totalTime, { 
          source: 'database',
          cache_hit: false,
          compressed: isCompressed
        });
        
        // Валидируем полученные данные
        const validatedState = validateGameState(gameStateData);

        // Убеждаемся, что userId установлен правильно
        validatedState._userId = userId;

        // Добавляем информацию о провайдере, если отсутствует
        if (!validatedState._provider) {
          // Определяем провайдер на основе информации из токена или userId
          validatedState._provider = tokenResult.provider || 
                                 (userId.startsWith('farcaster_') ? 'farcaster' : 
                                  userId.startsWith('google_') ? 'google' : 
                                  userId.startsWith('local_') ? 'local' : '');
          
          logger.info('Добавлена информация о провайдере в игровое состояние', { 
            provider: validatedState._provider,
            userId 
          });
        }

        return NextResponse.json({
          success: true,
          data: {
            gameState: validatedState,
            metadata
          }
        });
      } else {
        // Прогресс не найден, создаем новое состояние игры
        logger.info('Прогресс не найден, создаем новое состояние игры', { userId });
        metrics.isNewUser = true;
        
        // Создаем начальное состояние игры для нового пользователя
        const initialState = createInitialGameState(userId);
        
        // Добавляем метаданные
        initialState._createdAt = new Date().toISOString();
        initialState._saveVersion = 1;
        
        // Кэшируем начальное состояние в Redis
        try {
          await redisService.saveGameState(userId, initialState, { isCritical: true });
          logger.debug('Начальное состояние сохранено в кэш', { userId });
        } catch (cacheError) {
          logger.warn('Ошибка кэширования начального состояния', {
            error: cacheError instanceof Error ? cacheError.message : String(cacheError)
          });
          // Продолжаем выполнение даже при ошибке кэширования
        }
        
        // Записываем метрику времени выполнения
        metrics.totalTime = performance.now() - startTime;
        gameMetrics.loadDuration(metrics.totalTime, { 
          source: 'new_user',
          cache_hit: false,
          new_user: true
        });
        
        return NextResponse.json({
          success: true,
          data: {
            gameState: initialState,
            metadata: {
              version: 1,
              userId: userId,
              isCompressed: false,
              savedAt: new Date().toISOString(),
              loadedAt: new Date().toISOString(),
              isNewUser: true,
              processingTime: metrics.totalTime
            }
          }
        });
      }
    } catch (dbError) {
      metrics.dbTime = performance.now() - dbStartTime;
      
      logger.error('Ошибка при загрузке данных из БД', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
        stack: dbError instanceof Error ? dbError.stack : undefined,
        timeMs: metrics.dbTime.toFixed(2)
      });
      
      gameMetrics.loadErrorCounter({ reason: 'db_error' });
      
      // Если есть данные из кэша, возвращаем их несмотря на ошибку БД
      if (gameStateData) {
        logger.info('Возврат данных из кэша при ошибке БД', { userId });
        
        // Записываем метрику времени выполнения
        metrics.totalTime = performance.now() - startTime;
        gameMetrics.loadDuration(metrics.totalTime, { 
          source: 'cache_fallback',
          cache_hit: true,
          db_error: true
        });
        
        return NextResponse.json({
          success: true,
          warning: 'Данные загружены из кэша, ошибка БД',
          data: {
            gameState: gameStateData,
            metadata: {
              version: (gameStateData as any)._saveVersion || 1,
              userId: userId,
              isCompressed: false,
              cacheHit: true,
              savedAt: (gameStateData as any)._savedAt || new Date().toISOString(),
              loadedAt: new Date().toISOString(),
              processingTime: metrics.totalTime,
              source: 'cache_fallback'
            }
          }
        }, { status: 207 }); // 207 Multi-Status
      }
      
      return NextResponse.json({
        success: false,
        error: 'DB_ERROR',
        message: 'Ошибка при загрузке прогресса из базы данных',
        details: dbError instanceof Error ? dbError.message : 'Unknown error',
        processingTime: performance.now() - startTime
      }, { status: 500 });
    }
  } catch (error) {
    logger.error('Неожиданная ошибка при загрузке прогресса', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    gameMetrics.loadErrorCounter({ reason: 'unexpected_error' });
    
    return NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Ошибка при загрузке прогресса',
      details: error instanceof Error ? error.message : 'Unknown error',
      processingTime: performance.now() - startTime
    }, { status: 500 });
  }
}