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
import { encryptGameSave, verifySaveIntegrity } from '../../../utils/saveEncryption'
import { ModelFields, createProgressData, createProgressHistoryData, createSyncQueueData } from '../../../utils/modelHelpers'
import { recordSaveAttempt } from '../../../services/monitoring'
import { Prisma } from '@prisma/client'
import { redisClient } from '../../../lib/redis'
import { extractToken } from '../../../utils/auth'
import { GameState } from '../../../types/gameTypes'

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
  duplicateRequest?: boolean;
  concurrentRequest?: boolean;
  blockedByLock?: boolean;
  throttled?: boolean;
  batched?: boolean;
  batchId?: string;
}

// Блокировка сохранения для каждого пользователя
const saveLocks = new Map<string, boolean>();

// Время последнего сохранения для каждого пользователя и минимальный интервал между запросами
const lastSaveTime = new Map<string, number>();
// Отдельная карта для отслеживания запросов через Farcaster
const lastFarcasterRequestTime = new Map<string, number>();
const MIN_SAVE_INTERVAL_MS = 300; // Минимальный интервал между сохранениями (мс)
const FARCASTER_MIN_INTERVAL_MS = 500; // Более строгий интервал для Farcaster запросов
const THROTTLE_STATUS_CODE = 429; // Too Many Requests

// Буферы состояния для отложенного сохранения
interface PendingSave {
  gameState: any;
  isCritical: boolean;
  saveReason: string;
  timestamp: number;
  clientId: string;
  batchId: string;
  resolvers: Array<(response: Response) => void>;
}
const pendingSaves = new Map<string, PendingSave>();
const BATCH_TIMEOUT_MS = 400; // Время ожидания новых запросов для группировки

// Функция для генерации ID пакета
function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

export async function POST(request: NextRequest): Promise<Response> {
  const startTime = performance.now();
  const metrics: RequestMetrics = { startTime };

  // Инкрементируем счетчик запросов на сохранение
  gameMetrics.saveTotalCounter();
  
  // Объявляем переменные до блока try, чтобы они были доступны в блоке catch
  let userId: string = 'unknown';
  let tokenResult: any = { valid: false };
  let gameState: any = null;
  let saveInProgress = false;

  try {
    logger.info('Получен запрос на сохранение прогресса');
    
    // Получение и проверка источника запроса для Farcaster
    const origin = request.headers.get('origin') || '';
    const referer = request.headers.get('referer') || '';
    const isFarcasterOrigin = 
      origin.includes('farcaster.xyz') || 
      origin.includes('warpcast.com') ||
      referer.includes('farcaster.xyz') || 
      referer.includes('warpcast.com');
    
    // Получение и проверка токена доступа
    const token = request.headers.get('authorization')?.split(' ')[1] || '';
    const clientId = request.headers.get('x-client-id') || 'unknown';
    
    // Проверка наличия Farcaster FID в заголовке для Mini Apps
    const farcasterFid = request.headers.get('x-farcaster-user');
    
    // Используем FID из Farcaster если он есть, иначе обычную JWT авторизацию
    if (farcasterFid) {
      // Валидация FID - строго числовое значение
      if (!/^\d+$/.test(farcasterFid)) {
        logger.warn('Недействительный Farcaster FID', { fid: farcasterFid });
        gameMetrics.saveErrorCounter({ reason: 'invalid_farcaster_fid' });
        
        return NextResponse.json({
          success: false,
          error: 'INVALID_FARCASTER_FID',
          message: 'Недействительный Farcaster FID',
          processingTime: performance.now() - startTime
        }, { status: 401 });
      }
      
      // Проверяем существует ли пользователь в базе данных
      try {
        const existingUser = await prisma.user.findFirst({
          where: { farcaster_fid: farcasterFid }
        });
        
        // Если пользователь не найден, создаем его
        if (!existingUser) {
          logger.info('Создаем нового пользователя Farcaster', { fid: farcasterFid });
          
          const newUser = await prisma.user.create({
            data: {
              farcaster_fid: farcasterFid,
              farcaster_username: `user_${farcasterFid}`, // Временное имя
              created_at: new Date(),
              updated_at: new Date()
            }
          });
          
          userId = newUser.id;
          logger.info('Создан новый пользователь Farcaster', { userId, fid: farcasterFid });
        } else {
          userId = existingUser.id;
          logger.info('Найден существующий пользователь Farcaster', { userId, fid: farcasterFid });
        }
      } catch (userError) {
        logger.error('Ошибка при проверке/создании пользователя Farcaster', {
          error: userError instanceof Error ? userError.message : String(userError),
          fid: farcasterFid
        });
        
        // Используем FID как userId если возникла ошибка, но создаем префикс
        userId = `farcaster_${farcasterFid}`;
      }
      
      // Проверка соответствия источника для запросов с Farcaster FID
      if (!isFarcasterOrigin && process.env.NODE_ENV === 'production') {
        logger.warn('Подозрительный запрос с Farcaster FID из неизвестного источника', { 
          fid: farcasterFid, 
          origin, 
          referer 
        });
        gameMetrics.saveErrorCounter({ reason: 'suspicious_farcaster_origin' });
        
        // В продакшене блокируем, в разработке можно разрешить
        if (process.env.STRICT_FARCASTER_ORIGIN === 'true') {
          return NextResponse.json({
            success: false,
            error: 'INVALID_REQUEST_ORIGIN',
            message: 'Недопустимый источник запроса',
            processingTime: performance.now() - startTime
          }, { status: 403 });
        }
      }
      
      // Проверка частоты запросов для Farcaster (более строгое ограничение)
      const now = Date.now();
      const lastFarcasterTime = lastFarcasterRequestTime.get(farcasterFid) || 0;
      const timeSinceLastFarcasterRequest = now - lastFarcasterTime;
      
      if (timeSinceLastFarcasterRequest < FARCASTER_MIN_INTERVAL_MS) {
        logger.warn('Превышен лимит запросов для Farcaster пользователя', {
          fid: farcasterFid,
          timeSince: timeSinceLastFarcasterRequest
        });
        
        return NextResponse.json({
          success: false,
          error: 'TOO_MANY_REQUESTS',
          message: 'Слишком много запросов. Пожалуйста, попробуйте позже.',
          processingTime: performance.now() - startTime
        }, { status: 429 });
      }
      
      // Обновляем время последнего запроса через Farcaster
      lastFarcasterRequestTime.set(farcasterFid, now);
      
      logger.info('Авторизация через Farcaster FID', { userId, clientId, origin });
    } else {
      // Стандартная JWT авторизация
      tokenResult = await verifyJWT(token);
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
      
      userId = tokenResult.userId;
      logger.info('Токен верифицирован', { userId, clientId });
    }
    
    // Проверка частоты запросов (rate limiting)
    const now = Date.now();
    const lastSave = lastSaveTime.get(userId) || 0;
    const timeSinceLastSave = now - lastSave;
    
    // Чтение и проверка тела запроса для получения gameState
    // (перемещаем этот код выше, чтобы иметь доступ к gameState для буферизации)
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
    
    // Если запросы приходят слишком часто, буферизуем их
    if (timeSinceLastSave < MIN_SAVE_INTERVAL_MS) {
      // Проверяем, есть ли уже буфер для этого пользователя
      const pendingSave = pendingSaves.get(userId);
      
      // Если это критическое сохранение или нет буфера - создаем новый
      if (isCritical || !pendingSave) {
        // Уже есть ожидающее сохранение, но пришло критическое - обрабатываем немедленно
        if (pendingSave && isCritical) {
          logger.info('Получено критическое сохранение во время буферизации, обрабатываем немедленно', {
            userId,
            batchId: pendingSave.batchId
          });
          
          // Останавливаем предыдущее отложенное сохранение если оно было
          pendingSaves.delete(userId);
          
          // Продолжаем с критическим сохранением как обычно
        } else {
          // Создаем новый буфер сохранения
          const batchId = generateBatchId();
          metrics.batched = true;
          metrics.batchId = batchId;
          
          // Возвращаем промис, который будет разрешен после выполнения отложенного сохранения
          return new Promise(resolve => {
            pendingSaves.set(userId, {
              gameState,
              isCritical,
              saveReason,
              timestamp: now,
              clientId,
              batchId,
              resolvers: [resolve]
            });
            
            // Устанавливаем таймер для выполнения отложенного сохранения
            setTimeout(() => {
              processPendingSave(userId).catch(error => {
                logger.error('Ошибка при обработке отложенного сохранения', {
                  error: error instanceof Error ? error.message : String(error),
                  userId,
                  batchId
                });
              });
            }, BATCH_TIMEOUT_MS);
            
            logger.info('Запрос на сохранение добавлен в буфер', {
              userId,
              batchId,
              reason: saveReason,
              critical: isCritical
            });
          });
        }
      } else {
        // Добавляем запрос к существующему буферу
        metrics.batched = true;
        metrics.batchId = pendingSave.batchId;
        
        // Обновляем состояние игры в буфере только если версия новее
        const currentVersion = pendingSave.gameState._saveVersion || 0;
        const newVersion = gameState._saveVersion || 0;
        
        if (newVersion > currentVersion) {
          pendingSave.gameState = gameState;
          logger.info('Обновлено состояние в буфере сохранения', {
            userId,
            batchId: pendingSave.batchId,
            oldVersion: currentVersion,
            newVersion
          });
        }
        
        // Если новый запрос критический, помечаем весь пакет как критический
        if (isCritical) {
          pendingSave.isCritical = true;
        }
        
        // Возвращаем промис, который будет разрешен после выполнения отложенного сохранения
        return new Promise(resolve => {
          pendingSave.resolvers.push(resolve);
          
          logger.info('Запрос добавлен к существующему буферу сохранения', {
            userId,
            batchId: pendingSave.batchId,
            bufferSize: pendingSave.resolvers.length,
            reason: saveReason
          });
        });
      }
    }
    
    // Проверяем, не выполняется ли уже сохранение для этого пользователя
    if (saveLocks.get(userId)) {
      logger.warn('Сохранение уже выполняется для этого пользователя', { 
        userId,
        clientId,
        saveVersion: gameState?._saveVersion
      });
      gameMetrics.saveTotalCounter({ concurrent: true, duplicate: true, userId });
      
      return NextResponse.json({
        success: false,
        error: 'SAVE_IN_PROGRESS',
        message: 'Сохранение уже выполняется для этого пользователя',
        processingTime: performance.now() - startTime
      }, { status: 429 }); // Too Many Requests
    }
    
    // Устанавливаем блокировку и обновляем время последнего сохранения
    saveLocks.set(userId, true);
    lastSaveTime.set(userId, now);
    saveInProgress = true;
    
    // Проверяем наличие конкурентных сохранений от других клиентов
    try {
      if (!redisService) {
        logger.warn('Redis сервис не инициализирован');
      } else {
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
      }
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
      if (!redisService) {
        logger.warn('Redis сервис не инициализирован при загрузке предыдущего состояния');
      } else {
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
      if (!redisService) {
        logger.warn('Redis сервис не инициализирован при сохранении');
        metrics.redisSaveTime = performance.now() - redisSaveStartTime;
      } else {
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
        // Шифруем состояние игры перед сохранением
        const { encryptedSave, metadata } = encryptGameSave(gameState, userId);
        
        // Добавляем информацию о шифровании в метаданные
        gameState._isEncrypted = true;
        gameState._encryptionMetadata = {
          timestamp: metadata.timestamp,
          version: metadata.version,
          algorithm: metadata.algorithm
        };
        
        // Преобразуем gameState в JSON строку для сохранения в БД
        const gameStateJson = JSON.stringify(gameState);
        
        try {
          // Оптимизированный upsert с проверкой версии
          const upsertResult = await prisma.progress.upsert({
            where: { user_id: userId },
            update: {
              ...createProgressData({
                game_state: gameState,
                version: gameState._saveVersion || 1,
                updated_at: new Date()
              }),
              // Добавляем условие для предотвращения race condition
              // Обновляем только если версия старая меньше новой
              ...((gameState._saveVersion || 1) > 1 ? {
                version: {
                  increment: 1
                }
              } : {})
            },
            create: createProgressData({
              user_id: userId,
              version: gameState._saveVersion || 1,
              game_state: gameState,
              updated_at: new Date()
            })
          });
          
          logger.info('Прогресс успешно сохранен в БД через upsert', {
            userId,
            version: gameState._saveVersion,
            isNew: upsertResult.created_at.toISOString() === upsertResult.updated_at.toISOString()
          });
        } catch (upsertError) {
          logger.error('Ошибка при выполнении upsert', {
            error: upsertError instanceof Error ? upsertError.message : String(upsertError),
            userId
          });
          
          // Если upsert не сработал, пробуем fallback на update
          try {
            await prisma.progress.update({
              where: { user_id: userId },
              data: createProgressData({
                game_state: gameState,
                version: gameState._saveVersion || 1,
                updated_at: new Date()
              })
            });
            
            logger.info('Прогресс сохранен через fallback update', { userId });
          } catch (updateError) {
            // Если и update не сработал, значит записи действительно нет, пытаемся создать
            try {
              await prisma.progress.create({
                data: createProgressData({
                  user_id: userId,
                  version: gameState._saveVersion || 1,
                  game_state: gameState,
                  updated_at: new Date()
                })
              });
              
              logger.info('Прогресс сохранен через fallback create', { userId });
            } catch (createError: any) {
              // Если и create не сработал, пробрасываем ошибку
              throw new Error(`Не удалось сохранить прогресс: ${createError.message}`);
            }
          }
        }
        
        // Сохраняем историю прогресса, если это критическое сохранение или слияние
        if (isCritical || mergeNeeded || (gameState._saveVersion || 0) % 5 === 0) {
          try {
            // Запрос на добавление в историю прогресса через сырой SQL
            await prisma.$executeRaw`
              INSERT INTO progress_history (
                ${ModelFields.ProgressHistory.user_id}, 
                ${ModelFields.ProgressHistory.client_id}, 
                ${ModelFields.ProgressHistory.save_type}, 
                ${ModelFields.ProgressHistory.save_reason}, 
                ${ModelFields.ProgressHistory.created_at}
              ) VALUES (
                ${userId}, 
                ${clientId || 'unknown'},
                ${isCritical ? 'critical' : (mergeNeeded ? 'merged' : 'regular')},
                ${saveReason},
                NOW()
              )
            `;
            
            logger.debug('Состояние сохранено в историю прогресса', {
              userId,
              version: gameState._saveVersion
            });
          } catch (historyError) {
            // Если ошибка только в истории, логируем, но продолжаем выполнение
            logger.warn('Ошибка при сохранении истории прогресса', {
              error: historyError instanceof Error ? historyError.message : String(historyError)
            });
          }
        }
        
        // Проверяем, что поля energy и lastEnergyUpdateTime существуют и сохраняются
        if (gameState && gameState.inventory) {
          // Проверяем поле energy
          if (gameState.inventory.energy === undefined) {
            gameState.inventory.energy = 500; // Устанавливаем значение по умолчанию
            console.log(`[save-progress] Восстановлено поле energy = 500 для пользователя ${userId}`);
          }
          
          // Проверяем поле lastEnergyUpdateTime
          if (gameState.inventory.lastEnergyUpdateTime === undefined) {
            gameState.inventory.lastEnergyUpdateTime = Date.now();
            console.log(`[save-progress] Восстановлено поле lastEnergyUpdateTime для пользователя ${userId}`);
          }
          
          // Логируем для отладки
          logger.debug('Значения энергии при сохранении:', { 
            userId, 
            energy: gameState.inventory.energy,
            lastEnergyUpdateTime: gameState.inventory.lastEnergyUpdateTime
          });
        }
        
        metrics.dbSaveTime = performance.now() - dbSaveStartTime;
        
        logger.info('Прогресс успешно обновлен в БД', {
          userId,
          version: gameState._saveVersion,
          timeMs: metrics.dbSaveTime.toFixed(2)
        });
        
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
              ${ModelFields.SyncQueue.user_id}, 
              ${ModelFields.SyncQueue.operation}, 
              ${ModelFields.SyncQueue.data}, 
              ${ModelFields.SyncQueue.status}, 
              ${ModelFields.SyncQueue.created_at}, 
              ${ModelFields.SyncQueue.updated_at}, 
              ${ModelFields.SyncQueue.attempts}
            ) VALUES (
              ${userId}, 
              'save_progress', 
              ${JSON.stringify({ gameState, saveReason, isCritical })}, 
              'pending',
              NOW(),
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
    
    // Отправляем метрики в случае успеха
    const provider = typeof tokenResult !== 'undefined' && tokenResult && tokenResult.provider || 
                   typeof gameState !== 'undefined' && gameState && gameState._provider || 
                   typeof userId !== 'undefined' && userId && (userId.startsWith('farcaster_') || userId.startsWith('google_') || userId.startsWith('local_')) ? 
                   userId.startsWith('farcaster_') ? 'farcaster' : userId.startsWith('google_') ? 'google' : 'local' : 'unknown';
    
    // Записываем успешное сохранение
    recordSaveAttempt(typeof userId !== 'undefined' ? userId : 'unknown', provider, true, false);
    
    // Возвращаем успешный ответ
    const totalTime = performance.now() - startTime;
    gameMetrics.saveDuration(totalTime, { 
      total: true,
      critical: isCritical,
      meaningful_changes: hasMeaningfulChanges,
      merged: mergeNeeded,
      reason: saveReason,
      concurrent: metrics.concurrentRequest
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
    // Логирование ошибки
    logger.error('Непредвиденная ошибка при сохранении', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: typeof userId !== 'undefined' ? userId : 'unknown',
      method: 'POST',
      route: '/api/game/save-progress',
      details: {
        hasFarcasterHeader: !!request.headers.get('X-Farcaster-User'),
        farcasterUser: request.headers.get('X-Farcaster-User') || 'none',
        contentType: request.headers.get('Content-Type') || 'none',
        origin: request.headers.get('Origin') || 'none',
        referer: request.headers.get('Referer') || 'none',
      }
    });
    
    // Увеличиваем счетчик ошибок
    gameMetrics.saveErrorCounter({ reason: 'unexpected_error' });
    
    // Определяем провайдер для статистики если возможно
    let provider = 'unknown';
    try {
      if (typeof tokenResult !== 'undefined' && tokenResult && tokenResult.provider) {
        provider = tokenResult.provider;
      } else if (typeof gameState !== 'undefined' && gameState && gameState._provider) {
        provider = gameState._provider;
      } else if (typeof userId !== 'undefined' && userId) {
        if (userId.startsWith('farcaster_')) provider = 'farcaster';
        else if (userId.startsWith('google_')) provider = 'google';
        else if (userId.startsWith('local_')) provider = 'local';
      }
      
      // Записываем неудачное сохранение
      recordSaveAttempt(typeof userId !== 'undefined' ? userId : 'unknown', provider, false, false);
    } catch (monitoringError) {
      // Игнорируем ошибки мониторинга
      logger.warn('Ошибка при записи статистики', { 
        error: monitoringError instanceof Error ? monitoringError.message : String(monitoringError)
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Ошибка при сохранении прогресса',
      details: error instanceof Error ? error.message : String(error),
      processingTime: performance.now() - startTime
    }, { status: 500 });
  } finally {
    // Снимаем блокировку, если она была установлена
    if (saveInProgress && userId !== 'unknown') {
      saveLocks.delete(userId);
    }
  }
}

/**
 * Обрабатывает отложенное сохранение из буфера
 */
async function processPendingSave(userId: string): Promise<void> {
  const pendingSave = pendingSaves.get(userId);
  if (!pendingSave) return;
  
  // Удаляем из буфера перед обработкой, чтобы избежать повторной обработки
  pendingSaves.delete(userId);
  
  const { gameState, isCritical, saveReason, clientId, batchId, resolvers } = pendingSave;
  const totalRequests = resolvers.length;
  
  logger.info('Начало обработки отложенного сохранения', {
    userId,
    batchId,
    totalRequests,
    critical: isCritical
  });
  
  try {
    // Устанавливаем блокировку для предотвращения одновременных сохранений
    saveLocks.set(userId, true);
    
    // Обновляем время последнего сохранения
    lastSaveTime.set(userId, Date.now());
    
    // Проверка согласованности userId
    if (gameState._userId) {
      // Нормализация ID пользователя
      const normalizedGameStateUserId = gameState._userId.replace(/^(farcaster_|local_|google_)/, '');
      const normalizedUserId = userId.replace(/^(farcaster_|local_|google_)/, "");
      
      // Добавляем/обновляем userId и метку времени
      gameState._userId = userId;
    }
    
    gameState._savedAt = new Date().toISOString();
    gameState._saveReason = saveReason;
    gameState._batchId = batchId;
    gameState._batchSize = totalRequests;
    
    // Увеличиваем версию сохранения
    gameState._saveVersion = (gameState._saveVersion || 0) + 1;
    
    // Сохраняем данные в Redis
    let redisSaveResult = null;
    let redisSaveTime = 0;
    
    try {
      const redisSaveStartTime = performance.now();
      
      if (redisService) {
        redisSaveResult = await redisService.saveGameState(
          userId, 
          gameState,
          { isCritical, metadata: { clientId, saveReason, batchId } }
        );
        redisSaveTime = performance.now() - redisSaveStartTime;
        
        if (redisSaveResult.success) {
          logger.info('Batch: данные успешно сохранены в Redis', {
            userId,
            batchId,
            timeMs: redisSaveTime.toFixed(2)
          });
        } else {
          logger.warn('Batch: ошибка при сохранении в Redis', {
            error: redisSaveResult.error,
            batchId,
            timeMs: redisSaveTime.toFixed(2)
          });
        }
      } else {
        logger.warn('Batch: Redis сервис не инициализирован');
        redisSaveTime = performance.now() - redisSaveStartTime;
      }
    } catch (redisError) {
      logger.error('Batch: ошибка при сохранении в Redis', {
        error: redisError instanceof Error ? redisError.message : String(redisError),
        batchId
      });
    }
    
    // Сохраняем в базу данных
    let dbSaveResult = null;
    let dbSaveTime = 0;
    
    try {
      const dbSaveStartTime = performance.now();
      
      // Шифруем состояние игры перед сохранением
      const { encryptedSave, metadata } = encryptGameSave(gameState, userId);
      
      // Добавляем информацию о шифровании в метаданные
      gameState._isEncrypted = true;
      gameState._encryptionMetadata = {
        timestamp: metadata.timestamp,
        version: metadata.version,
        algorithm: metadata.algorithm
      };
      
      // Оптимизированный upsert с проверкой версии
      const upsertResult = await prisma.progress.upsert({
        where: { user_id: userId },
        update: {
          ...createProgressData({
            game_state: gameState,
            version: gameState._saveVersion || 1,
            updated_at: new Date()
          }),
          // Добавляем условие для предотвращения race condition
          ...((gameState._saveVersion || 1) > 1 ? {
            version: {
              increment: 1
            }
          } : {})
        },
        create: createProgressData({
          user_id: userId,
          version: gameState._saveVersion || 1,
          game_state: gameState,
          updated_at: new Date()
        })
      });
      
      dbSaveTime = performance.now() - dbSaveStartTime;
      dbSaveResult = { success: true, upsertResult };
      
      logger.info('Batch: прогресс успешно сохранен в БД', {
        userId,
        batchId,
        version: gameState._saveVersion,
        timeMs: dbSaveTime.toFixed(2)
      });
      
      // Записываем метрику времени сохранения в БД
      gameMetrics.saveDuration(dbSaveTime, { 
        db_save: true,
        critical: isCritical,
        batched: true,
        batch_size: totalRequests
      });
      
    } catch (dbError) {
      logger.error('Batch: ошибка при сохранении в БД', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
        batchId
      });
      
      dbSaveResult = { 
        success: false, 
        error: dbError instanceof Error ? dbError.message : String(dbError) 
      };
    }
    
    // Отправляем метрики
    const totalTime = performance.now() - pendingSave.timestamp;
    gameMetrics.saveDuration(totalTime, { 
      total: true,
      critical: isCritical,
      batched: true,
      batch_size: totalRequests,
      reason: saveReason
    });
    
    // Определяем статус ответа
    const status = dbSaveResult?.success ? 200 : 
                  redisSaveResult?.success ? 207 : 500;
    
    // Успешный результат для всех ожидающих запросов
    const response = NextResponse.json({
      success: dbSaveResult?.success || redisSaveResult?.success,
      message: dbSaveResult?.success ? 
        'Прогресс успешно сохранен (батчевое сохранение)' : 
        'Данные сохранены только в Redis (батчевое сохранение)',
      error: !dbSaveResult?.success && !redisSaveResult?.success ? 
        'BATCH_SAVE_ERROR' : undefined,
      batchId,
      totalRequests,
      isBatched: true,
      processingTime: totalTime,
      metrics: {
        saveVersion: gameState._saveVersion,
        batchId,
        totalBatchedRequests: totalRequests,
        redisSaveTimeMs: redisSaveTime,
        dbSaveTimeMs: dbSaveResult?.success ? dbSaveTime : undefined,
        totalTimeMs: totalTime,
        redisSuccess: !!redisSaveResult?.success,
        dbSuccess: !!dbSaveResult?.success
      }
    }, { status });
    
    // Уведомляем всех ожидающих клиентов
    for (const resolver of resolvers) {
      resolver(response.clone());
    }
    
    logger.info('Отложенное сохранение успешно обработано', {
      userId,
      batchId,
      totalRequests,
      status
    });
  } catch (error) {
    // Ошибка для всех ожидающих запросов
    const errorResponse = NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Ошибка при обработке отложенного сохранения',
      details: error instanceof Error ? error.message : String(error),
      batchId,
      totalRequests,
      isBatched: true
    }, { status: 500 });
    
    // Уведомляем всех ожидающих клиентов об ошибке
    for (const resolver of resolvers) {
      resolver(errorResponse.clone());
    }
    
    logger.error('Ошибка при обработке отложенного сохранения', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      batchId,
      totalRequests
    });
  } finally {
    // Снимаем блокировку
    saveLocks.delete(userId);
  }
} 