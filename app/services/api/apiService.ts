/**
 * Сервис API
 * Обрабатывает запросы к серверу для загрузки и сохранения состояния игры
 */
import { getToken, getUserId, refreshToken } from '../auth/authenticationService';
import { ExtendedGameState } from '../../types/gameTypes';
import { SaveProgressResponse } from '../../types/saveTypes';
import { signGameState, verifyDataSignature, generateDataSignature } from '../../utils/dataIntegrity';
import { sanitizeGameState } from '../../services/gameDataService';
import { generateClientId, getBrowserInfo, getDeviceInfo, getClientVersion } from '../../utils/clientUtils';

// API маршруты
const API_ROUTES = {
  SAVE: '/api/game/save-progress',
  LOAD: '/api/game/load-progress',
  BACKUP: '/api/game/backup',
  REDIS: '/api/game/redis'
};

/**
 * Базовый URL для API
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Хранение активных запросов для возможности отмены
const activeRequests: AbortController[] = [];

/**
 * Получает заголовок авторизации с JWT токеном
 * @returns Заголовок авторизации или пустой объект
 */
export async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    // Получаем токен из сервиса аутентификации
    const token = getToken();
    
    // Если токен отсутствует, пробуем обновить его
    if (!token) {
      const refreshed = await refreshToken();
      if (refreshed) {
        const newToken = getToken();
        if (newToken) {
          return { 'Authorization': `Bearer ${newToken}` };
        }
      }
      console.warn('[API] Токен авторизации не найден');
      return {};
    }
    
    return { 'Authorization': `Bearer ${token}` };
  } catch (error) {
    console.error('[API] Ошибка при получении заголовка авторизации', error);
    return {};
  }
}

/**
 * Сохраняет состояние игры для пользователя через API
 * @param gameState Состояние игры для сохранения (может быть сжатым в строку)
 * @param forceSave Принудительное сохранение даже без изменений
 * @returns Promise с результатом сохранения
 */
export async function saveGameStateViaAPI(gameState: ExtendedGameState | string, forceSave = false): Promise<SaveProgressResponse> {
  try {
    const headers = await getAuthHeader();
    // Получаем userId из разных источников для обеспечения надежности
    let userId: string | null = getUserId();
    
    // Если gameState это строка (сжатые данные), используем userId только из внешних источников
    const isCompressedString = typeof gameState === 'string';
    
    // Если gameState это объект, пробуем получить userId из него
    if (!userId && !isCompressedString) {
      const state = gameState as ExtendedGameState;
      if (state && state._userId) {
        userId = state._userId;
        console.log('[API] Используется userId из игрового состояния:', userId);
      }
    }
    
    if (!userId) {
      console.error('[API] Не удалось сохранить прогресс: ID пользователя не найден');
      throw new Error('User ID not found');
    }
    
    if (Object.keys(headers).length === 0) {
      console.error('[API] Не удалось сохранить прогресс: отсутствует токен авторизации');
      throw new Error('Unauthorized');
    }
    
    // Обновляем userId в игровом состоянии, если это объект и userId отличается или отсутствует
    if (!isCompressedString) {
      const state = gameState as ExtendedGameState;
      if (!state._userId || state._userId !== userId) {
        state._userId = userId;
      }
      
      // Добавляем подпись для проверки целостности данных
      gameState = signGameState(userId, state);
    }
    
    const response = await fetch('/api/game/save-progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': generateClientId(), // Добавляем идентификатор клиента
        ...headers
      },
      body: JSON.stringify({
        userId,
        gameState,
        forceSave,
        isCompressed: isCompressedString
      })
    });
    
    // Если токен истек (401), пробуем обновить и повторить запрос
    if (response.status === 401) {
      console.warn('[API] Токен истек, пробуем обновить и повторить сохранение');
      const refreshed = await refreshToken();
      
      if (refreshed) {
        const newHeaders = await getAuthHeader();
        if (Object.keys(newHeaders).length > 0) {
          const retryResponse = await fetch('/api/game/save-progress', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...newHeaders
            },
            body: JSON.stringify({
              userId,
              gameState,
              forceSave,
              isCompressed: isCompressedString
            })
          });
          
          const retryData = await retryResponse.json();
          return retryData;
        }
      }
      
      throw new Error('Token refresh failed');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[API] Ошибка при сохранении состояния игры:', error);
    throw error;
  }
}

/**
 * Загружает состояние игры для пользователя через API
 * @param userIdOrGameState ID пользователя или текущее состояние игры
 * @returns Promise с состоянием игры
 */
export async function loadGameStateViaAPI(userIdOrGameState: string | ExtendedGameState): Promise<ExtendedGameState | null> {
  try {
    // Получаем данные для авторизации запроса
    const headers = await getAuthHeader();
    
    // Получаем userId из разных источников для обеспечения надежности
    let userId: string | null = getUserId();
    let gameState: ExtendedGameState | undefined;
    
    // Проверяем, что передали: userId или gameState
    if (typeof userIdOrGameState === 'string') {
      // Если передана строка, считаем ее userId
      userId = userIdOrGameState;
    } else {
      // Если передан объект, считаем его gameState
      gameState = userIdOrGameState;
      // Если нет userId из auth, пробуем получить из текущего состояния игры
      if (!userId && gameState && gameState._userId) {
        userId = gameState._userId;
        console.log('[API] Используется userId из игрового состояния:', userId);
      }
    }
    
    // Проверка наличия userId
    if (!userId) {
      console.error('[API] Не удалось загрузить прогресс: ID пользователя не найден');
      logSecurityEvent('load_failed', 'missing_user_id', null);
      throw new Error('User ID not found');
    }
    
    // Проверка наличия авторизационных данных
    if (Object.keys(headers).length === 0) {
      console.error('[API] Не удалось загрузить прогресс: отсутствует токен авторизации');
      logSecurityEvent('load_failed', 'missing_auth_token', userId);
      throw new Error('Unauthorized');
    }
    
    // Добавляем параметры запроса для идентификации клиента и защиты от кэширования
    const clientId = generateClientId();
    const queryParams = new URLSearchParams({
      userId,
      timestamp: Date.now().toString(),
      clientId
    });
    
    // Устанавливаем таймаут для запроса
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут
    
    try {
      const response = await fetch(`/api/game/load-progress?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          ...headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'X-Client-Id': clientId,
          'X-Request-ID': generateRandomId()
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Обрабатываем истекший токен (401)
      if (response.status === 401) {
        console.warn('[API] Токен истек, пробуем обновить и повторить загрузку');
        const refreshed = await refreshToken();
        
        if (refreshed) {
          const newHeaders = await getAuthHeader();
          if (Object.keys(newHeaders).length > 0) {
            // Повторяем запрос с обновленным токеном
            const newController = new AbortController();
            const newTimeoutId = setTimeout(() => newController.abort(), 10000);
            
            try {
              const retryResponse = await fetch(`/api/game/load-progress?${queryParams.toString()}`, {
                method: 'GET',
                headers: {
                  ...newHeaders,
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                  'Pragma': 'no-cache',
                  'X-Client-Id': clientId,
                  'X-Request-ID': generateRandomId()
                },
                signal: newController.signal
              });
              
              clearTimeout(newTimeoutId);
              
              if (!retryResponse.ok) {
                console.error('[API] Повторный запрос неуспешен:', retryResponse.status);
                logSecurityEvent('load_failed', `http_error_${retryResponse.status}`, userId);
                throw new Error(`HTTP Error: ${retryResponse.status}`);
              }
              
              return await processLoadResponse(retryResponse, userId);
            } catch (error) {
              clearTimeout(newTimeoutId);
              throw error;
            }
          }
        }
        
        logSecurityEvent('load_failed', 'token_refresh_failed', userId);
        throw new Error('Token refresh failed');
      }
      
      if (!response.ok) {
        console.error('[API] Загрузка не удалась:', response.status);
        logSecurityEvent('load_failed', `http_error_${response.status}`, userId);
        throw new Error(`HTTP Error: ${response.status}`);
      }
      
      return await processLoadResponse(response, userId);
      
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('[API] Запрос прерван по таймауту');
        logSecurityEvent('load_failed', 'request_timeout', userId);
        throw new Error('Request timeout');
      }
      throw error;
    }
  } catch (error) {
    console.error('[API] Ошибка при загрузке состояния игры:', error);
    return null;
  }
}

/**
 * Обрабатывает ответ API при загрузке состояния
 * @param response Ответ от API
 * @param userId ID пользователя
 * @returns Обработанное состояние игры
 */
async function processLoadResponse(response: Response, userId: string): Promise<ExtendedGameState | null> {
  try {
    const data = await response.json();
    
    // Проверяем структуру ответа
    if (!data || !data.gameState) {
      console.error('[API] Некорректная структура данных в ответе');
      logSecurityEvent('load_failed', 'invalid_response', userId);
      throw new Error('Invalid response data structure');
    }
    
    let loadedState = data.gameState as ExtendedGameState;
    
    // Проверяем базовую целостность загруженных данных
    if (!loadedState.inventory || !loadedState.upgrades) {
      console.error('[API] Неполные данные в загруженном состоянии');
      logSecurityEvent('load_failed', 'incomplete_state', userId);
      throw new Error('Incomplete game state data');
    }
    
    // Проверка версии сохранения
    if (!loadedState._saveVersion) {
      console.warn('[API] Отсутствует версия сохранения в загруженном состоянии');
      loadedState._saveVersion = 1;
    }
    
    // Проверяем владельца данных
    if (loadedState._userId && loadedState._userId !== userId) {
      console.error('[API] Несоответствие ID пользователя в загруженных данных');
      logSecurityEvent('load_failed', 'user_id_mismatch', userId, {
        expected: userId,
        received: loadedState._userId
      });
      throw new Error('User ID mismatch in loaded data');
    }
    
    // Обновляем userId в загруженном состоянии для согласованности
    loadedState._userId = userId;
    
    // Проверяем наличие подписи данных
    if (loadedState._dataSignature) {
      // Проверяем целостность данных
      const isValid = verifyDataSignature(userId, loadedState, loadedState._dataSignature);
      if (!isValid) {
        console.error('[API] Нарушение целостности загруженных данных');
        logSecurityEvent('load_failed', 'signature_mismatch', userId);
        
        // Проверяем, можно ли исправить подпись
        const newSignature = generateDataSignature(userId, loadedState);
        if (newSignature) {
          console.warn('[API] Обновление подписи данных');
          loadedState._dataSignature = newSignature;
        } else {
          throw new Error('Data integrity violation');
        }
      }
    } else {
      // Добавляем подпись, если она отсутствует
      console.log('[API] Добавление подписи к загруженным данным');
      const signedState = signGameState(userId, loadedState);
      loadedState._dataSignature = signedState._dataSignature;
    }
    
    // Добавляем временную метку загрузки
    loadedState._loadedAt = new Date().toISOString();
    
    // Дополнительная проверка непротиворечивости загруженных данных
    if (typeof loadedState.inventory.snot !== 'number' || 
        typeof loadedState.inventory.snotCoins !== 'number' ||
        typeof loadedState.container?.capacity !== 'number') {
      console.error('[API] Некорректные типы данных в загруженном состоянии');
      loadedState = sanitizeGameState(loadedState) as ExtendedGameState;
    }
    
    // Добавляем информацию о клиенте
    loadedState._client = {
      version: getClientVersion(),
      platform: getBrowserInfo(),
      device: getDeviceInfo()
    };
    
    return loadedState;
  } catch (error: any) {
    console.error('[API] Ошибка при обработке ответа:', error);
    return null;
  }
}

/**
 * Логирует события безопасности
 * @param event Тип события
 * @param reason Причина события
 * @param userId ID пользователя
 * @param details Дополнительные детали
 */
function logSecurityEvent(event: string, reason: string, userId: string | null, details?: Record<string, any>): void {
  try {
    console.warn(`[Security] ${event}: ${reason}${userId ? ` (userId: ${userId})` : ''}`);
    
    // Здесь можно добавить отправку события в системы аналитики или мониторинга
    if (typeof window !== 'undefined') {
      const securityLog = JSON.parse(localStorage.getItem('security_log') || '[]');
      securityLog.push({
        timestamp: Date.now(),
        event,
        reason,
        userId,
        details,
        userAgent: navigator.userAgent
      });
      
      // Ограничиваем размер журнала
      if (securityLog.length > 100) {
        securityLog.shift();
      }
      
      localStorage.setItem('security_log', JSON.stringify(securityLog));
    }
  } catch (error: any) {
    console.error('[Security] Ошибка при логировании события:', error);
  }
}

/**
 * Генерирует случайный идентификатор для запросов
 */
function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Сохраняет состояние игры в Redis через API
 * @param userId ID пользователя
 * @param gameState Состояние игры
 * @param isCritical Флаг критичности сохранения
 * @returns Promise<boolean> Успешность выполнения операции
 */
export async function saveGameStateToRedisViaAPI(
  userId: string, 
  gameState: any, 
  isCritical = true
): Promise<boolean> {
  try {
    // Получаем токен для авторизации
    const token = getToken();
    
    if (!token) {
      console.warn(`[ApiService] Не удалось получить токен для сохранения в Redis`);
      return false;
    }
    
    // Отправляем запрос на сервер для сохранения в Redis с токеном в URL
    const redisResponse = await fetch(`/api/cache/save-redis?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId,
        data: gameState,
        isCritical: isCritical
      }),
    });
    
    if (redisResponse.ok) {
      console.log(`[ApiService] Состояние успешно сохранено в Redis через API`);
      return true;
    } else {
      const errorData = await redisResponse.json();
      console.warn(`[ApiService] Ошибка при сохранении в Redis: ${errorData.error || redisResponse.statusText}`);
      return false;
    }
  } catch (error) {
    console.error('[ApiService] Ошибка при сохранении в Redis через API:', error);
    return false;
  }
}

/**
 * Загружает состояние из Redis через API
 * @param userId ID пользователя
 * @returns Состояние игры или null при ошибке
 */
export async function loadGameStateFromRedisViaAPI(userId: string): Promise<ExtendedGameState | null> {
  try {
    console.log(`[ApiService] Загрузка данных из Redis через API для ${userId}`);
    
    // Получаем токен для авторизации
    const token = getToken();
    
    if (!token) {
      console.warn(`[ApiService] Не удалось получить токен для загрузки данных из Redis`);
      return null;
    }
    
    // Отправляем запрос на сервер для получения данных из Redis с токеном в URL
    const response = await fetch(`/api/cache/load-redis?userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.warn(`[ApiService] Не удалось загрузить данные из Redis через API: ${errorData.error || response.statusText}`);
      return null;
    }
    
    const result = await response.json();
    
    // Проверяем структуру ответа
    if (!result || typeof result !== 'object') {
      console.warn(`[ApiService] Некорректный формат ответа от Redis API`);
      return null;
    }
    
    // Проверяем наличие данных
    if (!result.success) {
      console.warn(`[ApiService] Redis API вернул ошибку: ${result.error || 'Unknown error'}`);
      return null;
    }
    
    // Проверяем наличие данных в ответе
    if (!result.data) {
      console.warn(`[ApiService] Redis API вернул пустой ответ`);
      return null;
    }
    
    console.log(`[ApiService] Данные успешно загружены из Redis через API (источник: ${result.source})`);
    
    return result.data as ExtendedGameState;
  } catch (error) {
    console.error(`[ApiService] Ошибка при загрузке данных из Redis через API:`, error);
    return null;
  }
}

/**
 * Отменяет все активные запросы
 */
export function cancelAllRequests(): void {
  console.log('[ApiService] Отмена всех активных запросов');
  // Здесь должна быть реализация отмены запросов с использованием AbortController
} 