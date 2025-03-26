/**
 * API сервис для работы с игровыми данными
 * Обрабатывает запросы к серверу для загрузки и сохранения состояния игры
 */
import type { ExtendedGameState } from "../../types/gameTypes";
import type { SaveProgressResponse, LoadProgressResponse } from "../../types/saveTypes";
import { getToken, getUserId, refreshToken } from '../auth/authenticationService';

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
    }
    
    const response = await fetch('/api/game/save-progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    
    if (!userId) {
      console.error('[API] Не удалось загрузить прогресс: ID пользователя не найден');
      throw new Error('User ID not found');
    }
    
    if (Object.keys(headers).length === 0) {
      console.error('[API] Не удалось загрузить прогресс: отсутствует токен авторизации');
      throw new Error('Unauthorized');
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут
    
    try {
      const response = await fetch(`/api/game/load-progress?userId=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Если токен истек (401), пробуем обновить и повторить запрос
      if (response.status === 401) {
        console.warn('[API] Токен истек, пробуем обновить и повторить загрузку');
        const refreshed = await refreshToken();
        
        if (refreshed) {
          const newHeaders = await getAuthHeader();
          if (Object.keys(newHeaders).length > 0) {
            const retryResponse = await fetch(`/api/game/load-progress?userId=${encodeURIComponent(userId)}`, {
              method: 'GET',
              headers: newHeaders
            });
            
            if (!retryResponse.ok) {
              console.error('[API] Повторный запрос неуспешен:', retryResponse.status);
              throw new Error(`HTTP Error: ${retryResponse.status}`);
            }
            
            const retryData = await retryResponse.json();
            
            // Проверяем структуру ответа
            if (!retryData || !retryData.gameState) {
              console.error('[API] Некорректная структура данных в ответе');
              throw new Error('Invalid response data structure');
            }
            
            const loadedState = retryData.gameState as ExtendedGameState;
            
            // Проверяем целостность загруженных данных
            if (!loadedState.inventory || !loadedState.upgrades) {
              console.error('[API] Неполные данные в загруженном состоянии');
              throw new Error('Incomplete game state data');
            }
            
            // Обновляем userId в загруженном состоянии для согласованности
            if (loadedState && (!loadedState._userId || loadedState._userId !== userId)) {
              loadedState._userId = userId;
            }
            
            return loadedState;
          }
        }
        
        throw new Error('Token refresh failed');
      }
      
      if (!response.ok) {
        console.error('[API] Загрузка не удалась:', response.status);
        throw new Error(`HTTP Error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Проверяем структуру ответа
      if (!data || !data.gameState) {
        console.error('[API] Некорректная структура данных в ответе');
        throw new Error('Invalid response data structure');
      }
      
      const loadedState = data.gameState as ExtendedGameState;
      
      // Проверяем целостность загруженных данных
      if (!loadedState.inventory || !loadedState.upgrades) {
        console.error('[API] Неполные данные в загруженном состоянии');
        throw new Error('Incomplete game state data');
      }
      
      // Обновляем userId в загруженном состоянии для согласованности
      if (loadedState && (!loadedState._userId || loadedState._userId !== userId)) {
        loadedState._userId = userId;
      }
      
      return loadedState;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('[API] Запрос прерван по таймауту');
        throw new Error('Request timeout');
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('[API] Ошибка при загрузке состояния игры:', error);
    return null;
  }
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