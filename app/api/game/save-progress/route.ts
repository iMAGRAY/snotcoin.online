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
import { generateDataSignature, verifyDataSignature, signGameState } from '../../../utils/dataIntegrity'
import { rateLimit } from '../../../utils/rateLimit'

export const dynamic = 'force-dynamic'

// Максимальный размер данных состояния (5MB)
const MAX_STATE_SIZE = 5 * 1024 * 1024;

// Настройки для защиты от флуд-атак
const FLOOD_PROTECTION = {
  MAX_REQUESTS_PER_MINUTE: 60,
  MAX_REQUESTS_PER_HOUR: 300
};

// Счетчик запросов для защиты от атак
const requestCounter: Record<string, { count: number; timestamp: number }> = {};

// Интерфейс для метрик запросов
interface RequestMetrics {
  startTime: number;
  endTime?: number;
  totalTime?: number;
  redisSaveTime?: number;
  dbSaveTime?: number;
  authCheckTime?: number;
  validateTime?: number;
  payloadSize?: number;
}

/**
 * Результат проверки ограничения запросов
 */
interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  count: number;
  limit: number;
}

/**
 * Обработчик POST запросов на сохранение прогресса игры
 */
export async function POST(request: NextRequest) {
  // Инициализация метрик для текущего запроса
  const metrics: RequestMetrics = {
    startTime: performance.now()
  };
  
  try {
    // Получаем информацию о клиенте и запросе
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const clientId = request.headers.get('x-client-id') || 'unknown';
    const requestId = request.headers.get('x-request-id') || `req-${Date.now()}`;
    
    // Проверяем ограничение запросов для IP-адреса
    const minuteRateLimitResult = await rateLimit.check(
      clientIp, 
      'save-progress-minute', 
      FLOOD_PROTECTION.MAX_REQUESTS_PER_MINUTE
    );
    
    if (!minuteRateLimitResult.success) {
      logger.warn('Превышен минутный лимит запросов на сохранение', { 
        clientIp, 
        clientId,
        requestsCount: minuteRateLimitResult.count,
        limit: minuteRateLimitResult.limit
      });
      
      // Проверяем, не являются ли запросы частью атаки
      // Если количество значительно превышает лимит, это может быть атакой
      if (minuteRateLimitResult.count > FLOOD_PROTECTION.MAX_REQUESTS_PER_MINUTE * 2) {
        // Логируем инцидент безопасности
        await redisService.logSecurityEvent({
          type: 'flood_attack',
          userId: null,
          clientId,
          clientIp,
          timestamp: Date.now(),
          details: {
            requestsCount: minuteRateLimitResult.count,
            limit: minuteRateLimitResult.limit,
            timeWindow: '1 minute'
          }
        });
      }
      
      gameMetrics.saveErrorCounter({ reason: 'rate_limit_minute' });
      
      return NextResponse.json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Превышен лимит запросов на сохранение прогресса',
        retryAfter: Math.ceil((minuteRateLimitResult.reset - Date.now()) / 1000),
        metrics: {
          processingTime: performance.now() - metrics.startTime
        }
      }, { 
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((minuteRateLimitResult.reset - Date.now()) / 1000))
        }
      });
    }
    
    // Проверяем часовой лимит запросов (долгосрочная защита)
    const hourRateLimitResult = await rateLimit.check(
      clientIp, 
      'save-progress-hour', 
      FLOOD_PROTECTION.MAX_REQUESTS_PER_HOUR,
      3600000 // 1 час
    );
    
    if (!hourRateLimitResult.success) {
      logger.warn('Превышен часовой лимит запросов на сохранение', { 
        clientIp, 
        clientId,
        requestsCount: hourRateLimitResult.count,
        limit: hourRateLimitResult.limit
      });
      
      // Логируем аномальную активность
      await redisService.logSecurityEvent({
        type: 'excessive_requests',
        userId: null,
        clientId,
        clientIp,
        timestamp: Date.now(),
        details: {
          requestsCount: hourRateLimitResult.count,
          limit: hourRateLimitResult.limit,
          timeWindow: '1 hour'
        }
      });
      
      // Добавляем IP в список наблюдения
      await redisService.addToWatchlist(clientIp, {
        type: 'excessive_requests',
        clientId,
        requestsCount: hourRateLimitResult.count,
        limit: hourRateLimitResult.limit
      });
      
      gameMetrics.saveErrorCounter({ reason: 'rate_limit_hour' });
      
      return NextResponse.json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Превышен часовой лимит запросов на сохранение прогресса',
        retryAfter: Math.ceil((hourRateLimitResult.reset - Date.now()) / 1000),
        metrics: {
          processingTime: performance.now() - metrics.startTime
        }
      }, { 
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((hourRateLimitResult.reset - Date.now()) / 1000))
        }
      });
    }
    
    // Время начала проверки авторизации
    const authStartTime = performance.now();
    
    // Проверяем авторизацию
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Отсутствует токен авторизации при сохранении', { clientIp, clientId });
      metrics.authCheckTime = performance.now() - authStartTime;
      gameMetrics.saveErrorCounter({ reason: 'unauthorized' });
      
      return NextResponse.json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Требуется авторизация',
        metrics: {
          processingTime: performance.now() - metrics.startTime,
          authCheckTime: metrics.authCheckTime
        }
      }, { status: 401 });
    }
    
    // Извлекаем и проверяем токен
    const token = authHeader.split(' ')[1];
    const authResult = await verifyJWT(token);
    
    // Завершаем измерение времени проверки авторизации
    metrics.authCheckTime = performance.now() - authStartTime;
    
    if (!authResult.valid) {
      logger.warn('Недействительный токен авторизации', { 
        clientIp, 
        clientId,
        error: authResult.error
      });
      
      // Логируем инцидент безопасности
      await redisService.logSecurityEvent({
        type: 'invalid_token',
        userId: null,
        clientId,
        clientIp,
        timestamp: Date.now()
      });
      
      gameMetrics.saveErrorCounter({ reason: 'invalid_token' });
      
      return NextResponse.json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Недействительный токен авторизации',
        metrics: {
          processingTime: performance.now() - metrics.startTime,
          authCheckTime: metrics.authCheckTime
        }
      }, { status: 401 });
    }
    
    // Получаем userId из токена
    const { userId } = authResult;
    
    if (!userId) {
      logger.warn('Отсутствует userId в токене', { clientIp, clientId });
      gameMetrics.saveErrorCounter({ reason: 'missing_user_id' });
      
      return NextResponse.json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Отсутствует идентификатор пользователя',
        metrics: {
          processingTime: performance.now() - metrics.startTime,
          authCheckTime: metrics.authCheckTime
        }
      }, { status: 401 });
    }
    
    // Проверяем наличие тела запроса
    if (!request.body) {
      logger.warn('Отсутствует тело запроса', { userId, clientIp, clientId });
      gameMetrics.saveErrorCounter({ reason: 'missing_request_body' });
      
      return NextResponse.json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Отсутствует тело запроса',
        metrics: {
          processingTime: performance.now() - metrics.startTime,
          authCheckTime: metrics.authCheckTime
        }
      }, { status: 400 });
    }
    
    // Проверяем размер запроса
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_STATE_SIZE) {
      logger.warn('Превышен максимальный размер запроса', { 
        userId, 
        size: contentLength, 
        maxSize: MAX_STATE_SIZE 
      });
      
      metrics.payloadSize = contentLength;
      gameMetrics.saveErrorCounter({ reason: 'payload_too_large' });
      
      return NextResponse.json({
        success: false,
        error: 'PAYLOAD_TOO_LARGE',
        message: 'Превышен максимальный размер данных для сохранения',
        metrics: {
          processingTime: performance.now() - metrics.startTime,
          authCheckTime: metrics.authCheckTime,
          payloadSize: metrics.payloadSize
        }
      }, { status: 413 });
    }
    
    // Парсим тело запроса
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      logger.error('Ошибка при парсинге JSON запроса', { 
        userId, 
        error: parseError instanceof Error ? parseError.message : String(parseError) 
      });
      
      gameMetrics.saveErrorCounter({ reason: 'invalid_json' });
      
      return NextResponse.json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Неверный формат JSON в запросе',
        metrics: {
          processingTime: performance.now() - metrics.startTime,
          authCheckTime: metrics.authCheckTime
        }
      }, { status: 400 });
    }
    
    // Извлекаем параметры из запроса
    const { gameState: clientGameState, forceSave = false, isCompressed = false, saveReason = 'manual' } = body;
    
    // Проверяем наличие gameState
    if (!clientGameState) {
      logger.warn('Отсутствует gameState в запросе', { userId });
      gameMetrics.saveErrorCounter({ reason: 'missing_game_state' });
      
      return NextResponse.json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Отсутствуют данные игрового состояния',
        metrics: {
          processingTime: performance.now() - metrics.startTime,
          authCheckTime: metrics.authCheckTime
        }
      }, { status: 400 });
    }
    
    // Проверяем userId в gameState
    if (clientGameState._userId && clientGameState._userId !== userId) {
      logger.warn('Несоответствие userId в токене и в игровом состоянии', { 
        tokenUserId: userId, 
        stateUserId: clientGameState._userId 
      });
      
      // Логируем попытку подмены userId
      await redisService.logSecurityEvent({
        type: 'user_id_mismatch',
        userId,
        clientId,
        clientIp,
        timestamp: Date.now(),
        details: { 
          tokenUserId: userId, 
          stateUserId: clientGameState._userId 
        }
      });
      
      gameMetrics.saveErrorCounter({ reason: 'user_id_mismatch' });
      
      return NextResponse.json({
        success: false,
        error: 'BAD_REQUEST',
        message: 'Несоответствие ID пользователя',
        metrics: {
          processingTime: performance.now() - metrics.startTime,
          authCheckTime: metrics.authCheckTime
        }
      }, { status: 400 });
    }
    
    // Проверка целостности данных
    if (clientGameState._dataSignature) {
      const isValidSignature = verifyDataSignature(userId, clientGameState, clientGameState._dataSignature);
      if (!isValidSignature) {
        logger.warn('Нарушение целостности данных', { 
          userId, 
          version: clientGameState._saveVersion 
        });
        
        // Логируем инцидент безопасности
        await redisService.logSecurityEvent({
          type: 'integrity_violation',
          userId,
          clientId,
          clientIp,
          timestamp: Date.now()
        });
        
        gameMetrics.saveErrorCounter({ reason: 'integrity_violation' });
        
        return NextResponse.json({
          success: false,
          error: 'INTEGRITY_VIOLATION',
          message: 'Нарушение целостности данных',
          metrics: {
            processingTime: performance.now() - metrics.startTime,
            authCheckTime: metrics.authCheckTime
          }
        }, { status: 400 });
      }
    }
    
    // Создаем копию игрового состояния для безопасной работы
    let gameState = { ...clientGameState };
    
    // Добавляем/обновляем userId и метку времени
    gameState._userId = userId;
    gameState._savedAt = new Date().toISOString();
    gameState._saveReason = saveReason;
    
    // Увеличиваем версию сохранения
    gameState._saveVersion = (gameState._saveVersion || 0) + 1;
    
    // Получаем информацию о клиенте для проверки частоты сохранений
    let clientSaveInfo = await redisService.getClientSaveInfo(userId);
    
    // Если нет информации о сохранениях пользователя, создаем её
    if (!clientSaveInfo) {
      clientSaveInfo = {
        client_id: clientId,
        timestamp: Date.now()
      };
    }
    
    // После создания ClientSaveInfo
    const clientInfo = await redisService.getClientSaveInfo(userId);
    
    // Начинаем проверки на аномальное поведение
    if (clientInfo && clientInfo.client_id && clientInfo.client_id !== clientId) {
      // Проверяем на одновременные сохранения с разных устройств
      logger.info('Обнаружено сохранение с разных устройств', {
        userId,
        currentClientId: clientId,
        previousClientId: clientInfo.client_id
      });
      
      // Логируем событие безопасности и добавляем пользователя в список наблюдения
      // если происходит слишком много смен устройств
      const switchTimeThreshold = 5 * 60 * 1000; // 5 минут
      if (Date.now() - clientInfo.timestamp < switchTimeThreshold) {
        await redisService.logSecurityEvent({
          type: 'concurrent_save',
          userId,
          clientId,
          clientIp,
          timestamp: Date.now(),
          details: {
            previousClientId: clientInfo.client_id,
            timeInterval: Date.now() - clientInfo.timestamp
          }
        });
        
        // Если быстрых смен устройств больше 3, добавляем в список для наблюдения
        if ((clientInfo as any).concurrent_count > 3) {
          await redisService.addToWatchlist(userId, {
            type: 'frequent_device_change',
            timestamp: Date.now(),
            clientId,
            previousClientId: clientInfo.client_id,
            count: (clientInfo as any).concurrent_count
          });
        }
      }
    }
    
    // Проверяем наличие предыдущей версии для сравнения изменений
    let shouldSave = forceSave;
    let hasSignificantChanges = false;
    let previousVersion = 0;
    
    try {
      // Загружаем предыдущее состояние из Redis для сравнения
      const previousState = await redisService.loadGameState(userId);
      
      if (previousState.success && previousState.data) {
        // Проверяем версию и необходимость слияния
        previousVersion = previousState.data._saveVersion || 0;
        const currentVersion = gameState._saveVersion || 0;
        
        // Если версия старая и нет принудительного сохранения, обновляем версию
        if (previousVersion >= currentVersion && !forceSave) {
          logger.warn('Попытка сохранения устаревшей версии', {
            userId,
            previousVersion: previousVersion,
            newVersion: currentVersion
          });
          
          // Обновляем версию
          gameState._saveVersion = previousVersion + 1;
        }
        
        // Проверяем изменения в состоянии
        hasSignificantChanges = checkForMeaningfulChanges(previousState.data, gameState);
        
        // Сохраняем только если есть значительные изменения или принудительное сохранение
        shouldSave = hasSignificantChanges || forceSave;
        
        // Если версии совпадают, выполняем слияние
        if (previousVersion === currentVersion) {
          logger.info('Обнаружен конфликт версий, выполняем слияние данных', { 
            userId, 
            version: currentVersion 
          });
          
          // Сливаем состояния, предпочитая более новое
          gameState = mergeGameStates(previousState.data, gameState);
          gameState._saveVersion = Math.max(previousVersion, currentVersion) + 1;
          gameState._mergedAt = new Date().toISOString();
        }
      }
    } catch (loadError) {
      logger.error('Ошибка при загрузке предыдущего состояния для сравнения', {
        userId,
        error: loadError instanceof Error ? loadError.message : String(loadError)
      });
      
      // При ошибке загрузки всегда сохраняем
      shouldSave = true;
    }
    
    // Если нет значительных изменений, пропускаем сохранение
    if (!shouldSave) {
      logger.info('Пропуск сохранения: нет значительных изменений', { userId });
      
      // Обновляем метрики
      metrics.endTime = performance.now();
      metrics.totalTime = metrics.endTime - metrics.startTime;
      
      return NextResponse.json({
        success: true,
        saved: false,
        message: 'Нет значительных изменений, сохранение не требуется',
        version: gameState._saveVersion,
        metrics: {
          processingTime: metrics.totalTime,
          authCheckTime: metrics.authCheckTime
        }
      });
    }
    
    // Время начала валидации данных
    const validateStartTime = performance.now();
    
    // Подписываем состояние
    const signedState = signGameState(userId, gameState);
    
    // Завершаем измерение времени валидации
    metrics.validateTime = performance.now() - validateStartTime;
    
    // Индикатор критичности сохранения
    const isCritical = saveReason === 'critical' || saveReason === 'exit' || forceSave;
    
    // Сохраняем в Redis
    const redisSaveStartTime = performance.now();
    try {
      // Сохраняем состояние в Redis
      const redisSaveResult = await redisService.saveGameState(
        userId, 
        signedState,
        { isCritical, metadata: { clientId, saveReason } }
      );
      
      metrics.redisSaveTime = performance.now() - redisSaveStartTime;
      
      if (!redisSaveResult.success) {
        logger.warn('Ошибка при сохранении в Redis', {
          error: redisSaveResult.error,
          timeMs: metrics.redisSaveTime.toFixed(2)
        });
      }
    } catch (redisError) {
      metrics.redisSaveTime = performance.now() - redisSaveStartTime;
      logger.error('Критическая ошибка Redis при сохранении', {
        userId,
        error: redisError instanceof Error ? redisError.message : String(redisError),
        timeMs: metrics.redisSaveTime.toFixed(2)
      });
    }
    
    // Обновляем информацию о клиенте
    await redisService.updateClientSaveInfo(userId, clientId, {
      increment_concurrent: clientInfo?.client_id !== clientId,
      ip: clientIp,
      source: request.headers.get('user-agent') || 'unknown'
    });
    
    // Добавляем метрику сохранения
    gameMetrics.saveTotalCounter({ 
      userId, 
      clientId, 
      saved: true 
    });
    
    // Обновляем финальные метрики
    metrics.endTime = performance.now();
    metrics.totalTime = metrics.endTime - metrics.startTime;
    
    // Возвращаем ответ об успешном сохранении
    return NextResponse.json({
      success: true,
      saved: true,
      version: signedState._saveVersion,
      timestamp: Date.now(),
      previousVersion: previousVersion,
      hasMeaningfulChanges: hasSignificantChanges,
      metrics: {
        processingTime: metrics.totalTime,
        authCheckTime: metrics.authCheckTime,
        validateTime: metrics.validateTime,
        redisSaveTime: metrics.redisSaveTime,
        dbSaveTime: metrics.dbSaveTime,
        payloadSize: metrics.payloadSize
      }
    });
    
  } catch (error) {
    // Обновляем финальные метрики в случае ошибки
    metrics.endTime = performance.now();
    metrics.totalTime = metrics.endTime - metrics.startTime;
    
    // Логируем ошибку
    logger.error('Критическая ошибка при сохранении прогресса', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Метрика ошибок
    gameMetrics.saveErrorCounter({ reason: 'server_error' });
    
    // Возвращаем ответ с ошибкой
    return NextResponse.json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Внутренняя ошибка сервера при сохранении прогресса',
      metrics: {
        processingTime: metrics.totalTime,
        authCheckTime: metrics.authCheckTime,
        validateTime: metrics.validateTime,
        redisSaveTime: metrics.redisSaveTime
      }
    }, { status: 500 });
  }
}

/**
 * Проверяет наличие значительных изменений между состояниями
 * @param oldState Предыдущее состояние
 * @param newState Новое состояние
 * @returns true если есть значительные изменения
 */
function checkForMeaningfulChanges(oldState: any, newState: any): boolean {
  // Проверяем изменения в инвентаре
  if (oldState.inventory && newState.inventory) {
    if (oldState.inventory.snot !== newState.inventory.snot ||
        oldState.inventory.snotCoins !== newState.inventory.snotCoins ||
        oldState.inventory.containerCapacity !== newState.inventory.containerCapacity ||
        (oldState.inventory as any).containerSnot !== (newState.inventory as any).containerSnot ||
        oldState.inventory.fillingSpeed !== newState.inventory.fillingSpeed) {
      return true;
    }
  }
  
  // Проверяем изменения в контейнере
  if (oldState.container && newState.container) {
    if (oldState.container.level !== newState.container.level ||
        oldState.container.capacity !== newState.container.capacity ||
        Math.abs(oldState.container.currentAmount - newState.container.currentAmount) > 10) {
      return true;
    }
  }
  
  // Проверяем изменения в улучшениях
  if (oldState.upgrades && newState.upgrades) {
    if (oldState.upgrades.containerLevel !== newState.upgrades.containerLevel ||
        oldState.upgrades.fillingSpeedLevel !== newState.upgrades.fillingSpeedLevel ||
        oldState.upgrades.collectionEfficiencyLevel !== newState.upgrades.collectionEfficiencyLevel ||
        (oldState.upgrades.clickPower && newState.upgrades.clickPower && 
         oldState.upgrades.clickPower.level !== newState.upgrades.clickPower.level) ||
        (oldState.upgrades.passiveIncome && newState.upgrades.passiveIncome && 
         oldState.upgrades.passiveIncome.level !== newState.upgrades.passiveIncome.level)) {
      return true;
    }
  }
  
  // Проверка изменений в достижениях (если появились новые)
  if (oldState.achievements && newState.achievements && 
      oldState.achievements.unlockedAchievements && newState.achievements.unlockedAchievements) {
    if (oldState.achievements.unlockedAchievements.length !== newState.achievements.unlockedAchievements.length) {
      return true;
    }
  }
  
  // Проверка изменений в статистике
  if (oldState.stats && newState.stats) {
    if (oldState.stats.highestLevel !== newState.stats.highestLevel ||
        Math.abs(oldState.stats.clickCount - newState.stats.clickCount) > 50 ||
        Math.abs(oldState.stats.totalSnot - newState.stats.totalSnot) > 100 ||
        Math.abs(oldState.stats.totalSnotCoins - newState.stats.totalSnotCoins) > 50 ||
        oldState.stats.consecutiveLoginDays !== newState.stats.consecutiveLoginDays) {
      return true;
    }
  }
  
  // Если не нашли значительных изменений
  return false;
} 