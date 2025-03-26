/**
 * API для сохранения прогресса игры
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '../../../utils/auth'
import { redisService } from '../../../services/redis'
import { apiLogger as logger } from '../../../lib/logger'
import { gameMetrics } from '../../../lib/metrics'
import { prisma } from '../../../lib/prisma'
import { mergeGameStates } from '../../../utils/gameStateMerger'

export const dynamic = 'force-dynamic'

// Максимальный размер данных состояния (10MB)
const MAX_STATE_SIZE = 10 * 1024 * 1024;

// Интерфейс для метрик запроса
interface RequestMetrics {
  startTime: number;
  requestSize?: number;
  isCriticalSave?: boolean;
  saveReason?: string;
  hasMeaningfulChanges?: boolean;
  redisSaveTime?: number;
  dbSaveTime?: number;
}

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  const metrics: RequestMetrics = { startTime };

  // Инкрементируем счетчик запросов на сохранение
  gameMetrics.saveTotalCounter();
  
  try {
    logger.info('Получен запрос на сохранение прогресса');
    
    // Получение и проверка токена доступа
    const token = request.headers.get('authorization')?.split(' ')[1] || '';
    const clientId = request.headers.get('x-client-id') || 'unknown';
    
    const tokenResult = await verifyJWT(token);
    if (!tokenResult.valid || !tokenResult.userId) {
      logger.warn('Недействительный токен', { error: tokenResult.error });
      gameMetrics.saveErrorCounter({ reason: 'invalid_token' });
      
      return NextResponse.json({
        success: false,
        error: tokenResult.error || 'INVALID_TOKEN',
        message: 'Недействительный токен',
        processingTime: performance.now() - startTime
      }, { status: 401 });
    }
    
    const userId = tokenResult.userId;
    logger.info('Токен верифицирован', { userId, clientId });
    
    // Чтение и проверка тела запроса
    let gameState;
    let saveReason;
    let isCritical = false;
    
    try {
      // Проверяем, что размер запроса не превышает установленные лимиты
      const buffer = await request.arrayBuffer();
      const size = buffer.byteLength;
      metrics.requestSize = size;
      
      if (size > MAX_STATE_SIZE) {
        logger.warn('Превышен максимальный размер запроса', { size, maxSize: MAX_STATE_SIZE });
        gameMetrics.saveErrorCounter({ reason: 'request_too_large' });
        
        return NextResponse.json({
          success: false,
          error: 'REQUEST_TOO_LARGE',
          message: `Превышен максимальный размер запроса (${size} > ${MAX_STATE_SIZE})`,
          processingTime: performance.now() - startTime
        }, { status: 413 });
      }
      
      // Преобразуем буфер обратно в строку и парсим JSON
      const bodyText = new TextDecoder().decode(buffer);
      const body = JSON.parse(bodyText);
      
      // Проверяем наличие gameState и других необходимых полей
    if (!body.gameState) {
        logger.warn('Отсутствуют данные состояния игры');
        gameMetrics.saveErrorCounter({ reason: 'missing_data' });
        
      return NextResponse.json({ 
          success: false,
          error: 'MISSING_DATA',
          message: 'Отсутствуют данные состояния игры',
          processingTime: performance.now() - startTime
      }, { status: 400 });
    }
    
      gameState = body.gameState;
      saveReason = body.reason || 'manual';
      isCritical = body.isCritical === true;
      
      metrics.saveReason = saveReason;
      metrics.isCriticalSave = isCritical;
      
      // Проверка согласованности userId
      if (gameState._userId && gameState._userId !== userId) {
        logger.warn('Несоответствие ID пользователя', { 
          tokenUserId: userId, 
          gameStateUserId: gameState._userId 
        });
        gameMetrics.saveErrorCounter({ reason: 'user_id_mismatch' });
        
        return NextResponse.json({
          success: false,
          error: 'USER_ID_MISMATCH',
          message: 'ID пользователя в данных не соответствует токену',
          processingTime: performance.now() - startTime
        }, { status: 400 });
      }
      
      // Добавляем/обновляем userId и метку времени
      gameState._userId = userId;
      gameState._savedAt = new Date().toISOString();
      gameState._saveReason = saveReason;
      
      // Увеличиваем версию сохранения
      gameState._saveVersion = (gameState._saveVersion || 0) + 1;
      
    } catch (parseError) {
      logger.error('Ошибка при парсинге JSON', { 
        error: parseError instanceof Error ? parseError.message : String(parseError) 
      });
      gameMetrics.saveErrorCounter({ reason: 'invalid_json' });
      
      return NextResponse.json({
        success: false,
        error: 'INVALID_JSON',
        message: 'Ошибка при парсинге JSON',
        details: parseError instanceof Error ? parseError.message : String(parseError),
        processingTime: performance.now() - startTime
      }, { status: 400 });
    }
    
    // Проверяем наличие конкурентных сохранений от других клиентов
    try {
      const currentCache = await redisService.getClientSaveInfo(userId);
      
      if (currentCache && currentCache.client_id && 
          currentCache.client_id !== clientId && 
          currentCache.timestamp) {
          
        const timeSinceLastSave = Date.now() - currentCache.timestamp;
        
        // Если недавно было сохранение от другого клиента
        if (timeSinceLastSave < 30000) { // 30 секунд
          logger.warn('Обнаружено конкурентное сохранение', {
            otherClientId: currentCache.client_id,
            timeSinceLastSaveMs: timeSinceLastSave
          });
          
          // Увеличиваем счетчик конкурентных сохранений
          gameMetrics.saveTotalCounter({ concurrent: true, userId });
        }
      }
      
      // Обновляем информацию о текущем клиенте
      await redisService.updateClientSaveInfo(userId, clientId);
      
    } catch (cacheError) {
      // Просто логируем ошибку, но не прерываем процесс
      logger.warn('Ошибка при проверке конкурентных сохранений', {
        error: cacheError instanceof Error ? cacheError.message : String(cacheError)
      });
    }
    
    // Загружаем предыдущее состояние из Redis
    let hasMeaningfulChanges = true;
    let mergeNeeded = false;
    let previousVersion = 0;
    
    try {
      const previousState = await redisService.loadGameState(userId);
      
      if (previousState.success && previousState.data) {
        // Проверяем версию и необходимость слияния
        previousVersion = previousState.data._saveVersion || 0;
        const currentVersion = gameState._saveVersion || 0;
        
        if (previousVersion > currentVersion) {
          logger.info('Обнаружен конфликт версий', {
            previousVersion,
            currentVersion,
            clientId
          });
          
          mergeNeeded = true;
          
          // Сливаем состояния, предпочитая более новое
          gameState = mergeGameStates(previousState.data, gameState);
          gameState._saveVersion = Math.max(previousVersion, currentVersion) + 1;
          gameState._mergedAt = new Date().toISOString();
          
          logger.info('Состояние игры слито', {
            newVersion: gameState._saveVersion
          });
      } else {
          // Проверяем наличие значимых изменений
          // Этот код зависит от логики игры, здесь упрощенный пример
          const hasScoreChanges = gameState.score !== previousState.data.score;
          const hasInventoryChanges = gameState.inventory && 
                                    JSON.stringify(gameState.inventory) !== 
                                    JSON.stringify(previousState.data.inventory || {});
          const hasQuestChanges = gameState.quests && 
                                JSON.stringify(gameState.quests) !== 
                                JSON.stringify(previousState.data.quests || {});
          
          hasMeaningfulChanges = hasScoreChanges || hasInventoryChanges || hasQuestChanges;
          metrics.hasMeaningfulChanges = hasMeaningfulChanges;
        }
      }
    } catch (loadError) {
      logger.warn('Ошибка при загрузке предыдущего состояния из Redis', {
        error: loadError instanceof Error ? loadError.message : String(loadError)
      });
      // Продолжаем сохранение, даже если не удалось загрузить предыдущее состояние
    }
    
    // Сохраняем данные в Redis для быстрого доступа
    const redisSaveStartTime = performance.now();
    try {
      const redisSaveResult = await redisService.saveGameState(
        userId, 
        gameState,
        { isCritical, metadata: { clientId, saveReason } }
      );
      
      metrics.redisSaveTime = performance.now() - redisSaveStartTime;
      
      if (!redisSaveResult.success) {
        logger.warn('Ошибка при сохранении в Redis', {
          error: redisSaveResult.error,
          timeMs: metrics.redisSaveTime.toFixed(2)
        });
      } else {
        logger.info('Данные успешно сохранены в Redis', {
          timeMs: metrics.redisSaveTime.toFixed(2)
        });
      }
    } catch (redisError) {
      metrics.redisSaveTime = performance.now() - redisSaveStartTime;
      
      logger.error('Ошибка при сохранении в Redis', {
        error: redisError instanceof Error ? redisError.message : String(redisError),
        timeMs: metrics.redisSaveTime.toFixed(2)
      });
      
      gameMetrics.saveErrorCounter({ reason: 'redis_error' });
      
      // Продолжаем выполнение, чтобы сохранить в БД
    }
    
    // Сохраняем в базу данных, если изменения значительные или это критическое сохранение
    if (hasMeaningfulChanges || isCritical) {
      const dbSaveStartTime = performance.now();
      
      try {
        // Проверяем существование записи прогресса
        const existingProgress = await prisma.progress.findUnique({
          where: { user_id: userId },
          select: { id: true, version: true }
        });
        
        if (existingProgress) {
          // Обновляем существующую запись
          const updatedProgress = await prisma.progress.update({
            where: { user_id: userId },
            data: {
              game_state: gameState,
              version: gameState._saveVersion,
              updated_at: new Date()
            }
          });
          
          // Сохраняем история прогресса
          if (isCritical || mergeNeeded || gameState._saveVersion % 5 === 0) {
            // Запрос на добавление в историю прогресса через сырой SQL
            await prisma.$executeRaw`
              INSERT INTO progress_history (
                user_id, version, game_state, reason, created_at
              ) VALUES (
                ${userId}, 
                ${gameState._saveVersion}, 
                ${JSON.stringify(gameState)}, 
                ${saveReason}, 
                NOW()
              )
            `;
            
            logger.debug('Состояние сохранено в историю прогресса', {
              userId,
              version: gameState._saveVersion
            });
          }
          
          metrics.dbSaveTime = performance.now() - dbSaveStartTime;
          
          logger.info('Прогресс успешно обновлен в БД', {
            userId,
            version: gameState._saveVersion,
            timeMs: metrics.dbSaveTime.toFixed(2)
          });
        } else {
          // Создаем новую запись прогресса
          const newProgress = await prisma.progress.create({
            data: {
              user_id: userId,
              game_state: gameState,
              version: gameState._saveVersion,
              created_at: new Date(),
              updated_at: new Date()
            }
          });
          
          // Сохраняем историю для нового прогресса
          await prisma.$executeRaw`
            INSERT INTO progress_history (
              user_id, version, game_state, reason, created_at
            ) VALUES (
              ${userId}, 
              ${gameState._saveVersion}, 
              ${JSON.stringify(gameState)}, 
              'initial', 
              NOW()
            )
          `;
          
          metrics.dbSaveTime = performance.now() - dbSaveStartTime;
          
          logger.info('Создана новая запись прогресса в БД', {
            userId,
            version: gameState._saveVersion,
            timeMs: metrics.dbSaveTime.toFixed(2)
          });
        }
        
        // Записываем метрику времени сохранения в БД
        gameMetrics.saveDuration(metrics.dbSaveTime, { 
          db_save: true,
          meaningful_changes: hasMeaningfulChanges,
          critical: isCritical
        });
        
      } catch (dbError) {
        metrics.dbSaveTime = performance.now() - dbSaveStartTime;
        
        logger.error('Ошибка при сохранении в БД', {
          error: dbError instanceof Error ? dbError.message : String(dbError),
          stack: dbError instanceof Error ? dbError.stack : undefined,
          timeMs: metrics.dbSaveTime.toFixed(2)
        });
        
        gameMetrics.saveErrorCounter({ reason: 'db_error' });
        
        // Добавляем в очередь синхронизации для повторной попытки
        try {
          // Добавляем задачу в очередь синхронизации
          await prisma.$executeRaw`
            INSERT INTO sync_queue (
              user_id, operation_type, data, priority, created_at, attempts
            ) VALUES (
              ${userId}, 
              'save_progress', 
              ${JSON.stringify({ gameState, saveReason, isCritical })}, 
              ${isCritical ? 10 : 5}, 
              NOW(),
              0
            )
          `;
          
          logger.info('Задача добавлена в очередь синхронизации', { userId });
          
          // Возвращаем частичный успех
          return NextResponse.json({
            success: true,
            warning: 'Данные сохранены только в кэше, ожидается синхронизация с БД',
            processingTime: performance.now() - startTime,
            metrics: {
              redisSaveTime: metrics.redisSaveTime,
              dbError: true,
              queuedForSync: true
            }
          }, { status: 207 }); // 207 Multi-Status
        } catch (queueError) {
          logger.error('Ошибка при добавлении в очередь синхронизации', {
            error: queueError instanceof Error ? queueError.message : String(queueError)
          });
          
          // Возвращаем ошибку с данными о частичном сохранении
          return NextResponse.json({
            success: false,
            error: 'DB_ERROR',
            message: 'Ошибка сохранения в БД и добавления в очередь',
            warning: 'Данные сохранены только в кэше',
            processingTime: performance.now() - startTime,
            metrics: {
              redisSaveTime: metrics.redisSaveTime,
              dbError: true,
              queueError: true
            }
          }, { status: 500 });
        }
      }
    } else {
      logger.info('Пропуск сохранения в БД, нет значимых изменений');
    }
    
    // Возвращаем успешный ответ
    const totalTime = performance.now() - startTime;
    gameMetrics.saveDuration(totalTime, { 
      total: true,
      critical: isCritical,
      meaningful_changes: hasMeaningfulChanges,
      merged: mergeNeeded,
      reason: saveReason
    });
      
      return NextResponse.json({
        success: true,
      message: 'Прогресс успешно сохранен',
      processingTime: totalTime,
      metrics: {
        saveVersion: gameState._saveVersion,
        previousVersion,
        mergeNeeded,
        hasMeaningfulChanges,
        requestSizeBytes: metrics.requestSize,
        redisSaveTimeMs: metrics.redisSaveTime,
        dbSaveTimeMs: metrics.dbSaveTime,
        totalTimeMs: totalTime
      }
    });
    
  } catch (error) {
    logger.error('Неожиданная ошибка при сохранении прогресса', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    gameMetrics.saveErrorCounter({ reason: 'unexpected_error' });
    
    return NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Ошибка при сохранении прогресса',
      details: error instanceof Error ? error.message : String(error),
      processingTime: performance.now() - startTime
    }, { status: 500 });
  }
} 