/**
 * API для загрузки прогресса игры
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '../../../utils/auth'
import type { StructuredGameSave } from '../../../types/saveTypes'
import { createInitialGameState } from '../../../constants/gameConstants'
import { apiLogger as logger } from '../../../lib/logger'
import { gameMetrics } from '../../../lib/metrics'
import { prisma } from '../../../lib/prisma'
import { logTiming } from '../../../lib/logger'
import { decryptGameSave, verifySaveIntegrity } from '../../../utils/saveEncryption'
import { validateLoadedGameState } from '../../../utils/gameStateValidator'
import { decrypt } from '../../../utils/encryption'
import { extractToken } from '../../../utils/auth'

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
    
    // Проверяем есть ли состояние игрока в базе данных
    try {
      const dbStartTime = performance.now();
      
      // Загрузка из базы данных
      const progress = await prisma.progress.findUnique({
        where: { user_id: userId }
      });
      
      metrics.dbTime = performance.now() - dbStartTime;
      
      if (progress && progress.game_state) {
        metrics.source = 'database';
        
        logger.info('Прогресс загружен из БД', { 
          userId,
          timeMs: metrics.dbTime.toFixed(2)
        });
        
        // Подготавливаем данные для ответа
        const gameStateData = progress.game_state;
        
        // Если в gameStateData отсутствует _createdAt, добавляем его
        if (!gameStateData._createdAt) {
          gameStateData._createdAt = new Date().toISOString();
        }
        
        // Добавляем метаданные
        const now = new Date().toISOString();
        const metadata = {
          version: gameStateData._saveVersion || 1,
          userId: userId,
          isCompressed: false,
          cacheHit: false,
          savedAt: gameStateData._savedAt || now,
          loadedAt: now,
          processingTime: performance.now() - startTime,
          source: 'database'
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
        
        // Записываем метрику времени выполнения
        metrics.totalTime = performance.now() - startTime;
        gameMetrics.loadDuration(metrics.totalTime, { 
          source: 'database'
        });
        
        return NextResponse.json({
          success: true,
          data: {
            gameState: gameStateData,
            metadata
          }
        });
      } else {
        // Если в БД нет данных, создаем начальное состояние
        metrics.source = 'generated';
        metrics.isNewUser = true;
        
        logger.info('Прогресс не найден в БД, создаю начальное состояние', { userId });
        
        // Создаем начальное состояние игры
        const initialState = createInitialGameState(userId);
        
        // Добавляем информацию о токене и провайдере
        initialState._provider = tokenResult.provider || '';
        
        // Устанавливаем метки времени
        const now = new Date().toISOString();
        initialState._createdAt = now;
        initialState._savedAt = now;
        
        // Добавляем метаданные для ответа
        const metadata = {
          version: 1,
          userId: userId,
          isCompressed: false,
          cacheHit: false,
          savedAt: now,
          loadedAt: now,
          processingTime: performance.now() - startTime,
          source: 'generated',
          isNewUser: true
        };
        
        try {
          // Сохраняем начальное состояние в БД
          await prisma.progress.create({
            data: {
              user_id: userId,
              version: 1,
              game_state: initialState,
              created_at: new Date(),
              updated_at: new Date()
            }
          });
          
          logger.info('Начальное состояние сохранено в БД', { userId });
        } catch (dbCreateError) {
          logger.error('Ошибка при сохранении начального состояния в БД', {
            error: dbCreateError instanceof Error ? dbCreateError.message : String(dbCreateError),
            userId
          });
          // Продолжаем выполнение даже при ошибке сохранения в БД
        }
        
        // Записываем метрику времени выполнения
        metrics.totalTime = performance.now() - startTime;
        gameMetrics.loadDuration(metrics.totalTime, { 
          source: 'generated',
          new_user: true
        });
        
        return NextResponse.json({
          success: true,
          data: {
            gameState: initialState,
            metadata
          }
        });
      }
    } catch (dbError) {
      // Обрабатываем ошибку доступа к БД
      logger.error('Ошибка при загрузке из БД', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
        userId
      });
      
      // Создаем начальное состояние на случай ошибки
      metrics.source = 'generated_fallback';
      
      // Создаем начальное состояние игры
      const initialState = createInitialGameState(userId);
      
      // Добавляем информацию о токене и провайдере
      initialState._provider = tokenResult.provider || '';
      
      // Устанавливаем метки времени
      const now = new Date().toISOString();
      initialState._createdAt = now;
      initialState._savedAt = now;
      
      // Добавляем метаданные для ответа
      const metadata = {
        version: 1,
        userId: userId,
        isCompressed: false,
        cacheHit: false,
        savedAt: now,
        loadedAt: now,
        processingTime: performance.now() - startTime,
        source: 'generated_fallback',
        dbError: dbError instanceof Error ? dbError.message : String(dbError)
      };
      
      // Записываем метрику времени выполнения
      metrics.totalTime = performance.now() - startTime;
      gameMetrics.loadDuration(metrics.totalTime, { 
        source: 'generated_fallback',
        error: true
      });
      
      return NextResponse.json({
        success: true,
        warning: 'Ошибка доступа к базе данных, создано резервное начальное состояние',
        data: {
          gameState: initialState,
          metadata
        }
      }, { status: 207 }); // 207 Multi-Status
    }
  } catch (error) {
    // Обработка общих ошибок
    logger.error('Ошибка при обработке запроса', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Записываем метрику ошибки
    gameMetrics.loadErrorCounter({ reason: 'internal_error' });
    
    return NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Ошибка при загрузке прогресса игры',
      details: error instanceof Error ? error.message : String(error),
      processingTime: performance.now() - startTime
    }, { status: 500 });
  }
}