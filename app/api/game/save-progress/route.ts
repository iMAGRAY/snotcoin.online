/**
 * API для сохранения прогресса игры
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '../../../utils/auth'
import { apiLogger as logger } from '../../../lib/logger'
import { gameMetrics } from '../../../lib/metrics'
import { prisma } from '../../../lib/prisma'
import { mergeGameStates } from '../../../utils/gameStateMerger'
import { encryptGameSave, verifySaveIntegrity } from '../../../utils/saveEncryption'
import { ModelFields, createProgressData, createProgressHistoryData, createSyncQueueData } from '../../../utils/modelHelpers'
import { recordSaveAttempt } from '../../../services/monitoring'
import { Prisma } from '@prisma/client'
import { extractToken } from '../../../utils/auth'

// Расширяем тип GameState для включения необходимых полей
export interface GameState {
  _saveVersion?: number;
  _mergedAt?: string;
  score?: number;
  inventory?: Record<string, any>;
  quests?: Record<string, any>;
  [key: string]: any;
}

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

// Информация о последнем клиенте для каждого пользователя
interface ClientSaveInfo {
  client_id: string;
  timestamp: number;
}
const clientSaveInfo = new Map<string, ClientSaveInfo>();

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

// Функция для получения предыдущего состояния игры из базы данных
async function getPreviousGameState(userId: string): Promise<GameState | null> {
  try {
    const progress = await prisma.progress.findUnique({
      where: { user_id: userId }
    });
    
    if (progress && progress.game_state) {
      return JSON.parse(progress.game_state as string) as GameState;
    }
    
    return null;
  } catch (error) {
    logger.error('Ошибка при получении предыдущего состояния из базы данных', { 
      error: error instanceof Error ? error.message : String(error),
      userId 
    });
    return null;
  }
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
      // Получаем информацию о последнем клиенте для этого пользователя
      const currentInfo = clientSaveInfo.get(userId);
        
      if (currentInfo && currentInfo.client_id && 
          currentInfo.client_id !== clientId && 
          currentInfo.timestamp) {
            
        const timeSinceLastSave = Date.now() - currentInfo.timestamp;
          
        // Если недавно было сохранение от другого клиента
        if (timeSinceLastSave < 30000) { // 30 секунд
          logger.warn('Обнаружено конкурентное сохранение', {
            otherClientId: currentInfo.client_id,
            timeSinceLastSaveMs: timeSinceLastSave
          });
            
          // Увеличиваем счетчик конкурентных сохранений
          gameMetrics.saveTotalCounter({ concurrent: true, userId });
        }
      }
        
      // Обновляем информацию о текущем клиенте
      clientSaveInfo.set(userId, {
        client_id: clientId,
        timestamp: Date.now()
      });
    } catch (cacheError) {
      // Просто логируем ошибку, но не прерываем процесс
      logger.warn('Ошибка при проверке конкурентных сохранений', {
        error: cacheError instanceof Error ? cacheError.message : String(cacheError)
      });
    }
    
    // Загружаем предыдущее состояние из базы данных
    let hasMeaningfulChanges = true;
    let mergeNeeded = false;
    let previousVersion = 0;
    
    try {
      const previousState = await getPreviousGameState(userId);
      
      if (previousState) {
        logger.info('Получено предыдущее состояние игры', {
          userId,
          version: previousState._saveVersion || 0
        });
        
        // Проверяем версию сохранения
        const prevVersion = previousState._saveVersion || 0;
        const currVersion = gameState._saveVersion || 0;
        
        // Если текущая версия не новее, возможно дублирующийся запрос
        if (prevVersion >= currVersion) {
          logger.warn('Получен запрос с устаревшей версией сохранения', {
            userId,
            currentVersion: currVersion,
            previousVersion: prevVersion
          });
          metrics.duplicateRequest = true;
          
          // Увеличиваем счетчик дублирующихся запросов
          gameMetrics.saveTotalCounter({ duplicate: true, userId });
          
          // Если версия та же, проверяем, есть ли значимые изменения
          if (prevVersion === currVersion) {
            // Проверяем значимые изменения (например, счет, инвентарь, квесты)
            const prevScore = previousState.score || 0;
            const currScore = gameState.score || 0;
            const hasScoreChanges = prevScore !== currScore;
            
            // Проверяем изменения в инвентаре
            const prevInventory = previousState.inventory || {};
            const currInventory = gameState.inventory || {};
            const hasInventoryChanges = JSON.stringify(prevInventory) !== JSON.stringify(currInventory);
            
            // Проверяем изменения в квестах
            const prevQuests = previousState.quests || {};
            const currQuests = gameState.quests || {};
            const hasQuestChanges = JSON.stringify(prevQuests) !== JSON.stringify(currQuests);
            
            // Если есть значимые изменения, разрешаем сохранение
            const hasMeaningfulChanges = hasScoreChanges || hasInventoryChanges || hasQuestChanges;
            metrics.hasMeaningfulChanges = hasMeaningfulChanges;
          }
        }
      }
      
      // Сохраняем состояние в базу данных
      const dbSaveStartTime = performance.now();
      try {
        // Создаем или обновляем запись прогресса в базе данных
        const encryptedState = encryptGameSave(JSON.stringify(gameState));
        
        await prisma.progress.upsert({
          where: { user_id: userId },
          update: {
            game_state: encryptedState,
            updated_at: new Date()
          },
          create: createProgressData(userId, encryptedState)
        });
        
        metrics.dbSaveTime = performance.now() - dbSaveStartTime;
        
        logger.info('Состояние игры сохранено в базу данных', {
          userId,
          timeMs: metrics.dbSaveTime.toFixed(2)
        });
      } catch (dbError) {
        logger.error('Ошибка при сохранении состояния в базу данных', {
          error: dbError instanceof Error ? dbError.message : String(dbError),
          userId
        });
        
        // Увеличиваем счетчик ошибок базы данных
        gameMetrics.saveErrorCounter({ reason: 'db_error' });
        
        // Отмечаем метрику
        metrics.dbSaveTime = performance.now() - dbSaveStartTime;
      }
    } catch (loadError) {
      logger.warn('Ошибка при загрузке предыдущего состояния из базы данных', {
        error: loadError instanceof Error ? loadError.message : String(loadError)
      });
      // Продолжаем сохранение, даже если не удалось загрузить предыдущее состояние
    }
    
    // Сохраняем данные в историю прогресса
    try {
      const historyData = createProgressHistoryData(userId, encryptedState, saveReason);
      await prisma.progressHistory.create({ data: historyData });
      
      logger.info('История прогресса сохранена', { userId });
    } catch (historyError) {
      logger.error('Ошибка при сохранении истории прогресса', {
        error: historyError instanceof Error ? historyError.message : String(historyError),
        userId
      });
      
      // Увеличиваем счетчик ошибок
      gameMetrics.saveErrorCounter({ reason: 'history_error' });
    }
    
    // Проверяем, нужно ли обновить данные очереди синхронизации
    if (isCritical || (metrics.hasMeaningfulChanges && !metrics.duplicateRequest)) {
      try {
        // Добавляем или обновляем запись в очереди синхронизации
        const syncData = createSyncQueueData(userId);
        
        await prisma.syncQueue.upsert({
          where: { user_id: userId },
          update: syncData,
          create: syncData
        });
        
        logger.info('Очередь синхронизации обновлена', { userId });
      } catch (syncError) {
        logger.error('Ошибка при обновлении очереди синхронизации', {
          error: syncError instanceof Error ? syncError.message : String(syncError),
          userId
        });
      }
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
        dbSaveTimeMs: metrics.dbSaveTime?.toFixed(2),
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

// Упрощенная функция для обработки ожидающих сохранений
async function processPendingSave(userId: string) {
  // Получаем ожидающее сохранение из буфера
  const pendingSave = pendingSaves.get(userId);
  if (!pendingSave) {
    logger.warn('Не найдено ожидающее сохранение для пользователя', { userId });
    return;
  }
  
  // Удаляем из буфера, чтобы не обработать повторно
  pendingSaves.delete(userId);
  
  try {
    // Получаем информацию о сохранении
    const { gameState, resolvers, clientId, batchId } = pendingSave;
    const totalRequests = resolvers.length;
    
    logger.info('Начинаем обработку отложенного сохранения', {
      userId,
      batchId,
      totalRequests
    });
    
    // Инкрементируем версию сохранения
    gameState._saveVersion = (gameState._saveVersion || 0) + 1;
    
    // Сохраняем данные в базу данных
    let dbSaveResult = null;
    let dbSaveTime = 0;
    
    const dbSaveStartTime = performance.now();
    try {
      // Шифруем состояние игры для сохранения
      const encryptedState = encryptGameSave(JSON.stringify(gameState));
      
      // Обновляем или создаем запись в базе данных
      await prisma.progress.upsert({
        where: { user_id: userId },
        update: {
          game_state: encryptedState,
          updated_at: new Date()
        },
        create: createProgressData({
          user_id: userId,
          game_state: encryptedState,
          created_at: new Date(),
          updated_at: new Date()
        })
      });
      
      dbSaveTime = performance.now() - dbSaveStartTime;
      dbSaveResult = { success: true };
      
      logger.info('Batch: данные успешно сохранены в БД', {
        userId,
        batchId,
        timeMs: dbSaveTime.toFixed(2)
      });
    } catch (dbError) {
      dbSaveTime = performance.now() - dbSaveStartTime;
      dbSaveResult = { 
        success: false, 
        error: dbError instanceof Error ? dbError.message : String(dbError) 
      };
      
      logger.error('Batch: ошибка при сохранении в БД', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
        batchId
      });
    }
    
    // Рассчитываем общее время выполнения пакета
    const totalTime = performance.now() - pendingSave.timestamp;
    
    // Определяем статус ответа
    const status = dbSaveResult?.success ? 200 : 500;
    
    // Успешный результат для всех ожидающих запросов
    const response = NextResponse.json({
      success: dbSaveResult?.success,
      message: dbSaveResult?.success ? 
        'Прогресс успешно сохранен (батчевое сохранение)' : 'BATCH_SAVE_ERROR',
      error: !dbSaveResult?.success ? dbSaveResult?.error : undefined,
      batchId,
      totalRequests,
      processingTime: totalTime,
      metrics: {
        batchId,
        totalBatchedRequests: totalRequests,
        dbSaveTimeMs: dbSaveTime,
        totalTimeMs: totalTime,
        dbSuccess: !!dbSaveResult?.success
      }
    }, { status });
    
    // Разрешаем все промисы с одинаковым ответом
    for (const resolver of resolvers) {
      resolver(response);
    }
    
    // Логируем результат
    logger.info('Обработка отложенного сохранения завершена', {
      userId,
      batchId,
      success: dbSaveResult?.success,
      totalRequests,
      timeMs: totalTime.toFixed(2)
    });
  } catch (error) {
    logger.error('Ошибка при обработке отложенного сохранения', {
      error: error instanceof Error ? error.message : String(error),
      userId
    });
    
    // Необходимо разрешить промисы даже в случае ошибки
    const errorResponse = NextResponse.json({
      success: false,
      error: 'BATCH_PROCESSING_ERROR',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
    
    // Разрешаем все промисы с ошибкой
    const resolvers = pendingSave.resolvers;
    for (const resolver of resolvers) {
      resolver(errorResponse);
    }
  } finally {
    // Разблокируем пользователя
    saveLocks.delete(userId);
  }
}

// Дополнительные функции для API
const saveToDatabase = async (userId: string, gameState: GameState, saveReason: string): Promise<{success: boolean, error?: string}> => {
  try {
    const encryptedState = encryptGameSave(JSON.stringify(gameState));
    
    await prisma.progress.upsert({
      where: { user_id: userId },
      update: {
        game_state: encryptedState,
        updated_at: new Date()
      },
      create: {
        user_id: userId,
        game_state: encryptedState,
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    
    // Также сохраняем историю (при необходимости)
    try {
      await prisma.progressHistory.create({
        data: {
          user_id: userId,
          save_reason: saveReason,
          created_at: new Date()
        }
      });
    } catch (historyError) {
      logger.warn('Ошибка при сохранении истории', {
        error: historyError instanceof Error ? historyError.message : String(historyError)
      });
    }
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
};

// Создаем запись в очереди синхронизации
const updateSyncQueue = async (userId: string): Promise<void> => {
  try {
    // Проверяем существует ли уже запись
    const existingRecord = await prisma.syncQueue.findFirst({
      where: { user_id: userId }
    });
    
    if (existingRecord) {
      // Обновляем существующую запись
      await prisma.syncQueue.update({
        where: { id: existingRecord.id },
        data: {
          updated_at: new Date()
        }
      });
    } else {
      // Создаем новую запись
      await prisma.syncQueue.create({
        data: {
          user_id: userId,
          operation: 'save_progress',
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date(),
          attempts: 0
        }
      });
    }
    
    logger.info('Очередь синхронизации обновлена', { userId });
  } catch (error) {
    logger.error('Ошибка при обновлении очереди синхронизации', {
      error: error instanceof Error ? error.message : String(error),
      userId
    });
  }
}; 