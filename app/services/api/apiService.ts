/**
 * API сервис для работы с игровыми данными
 * Обрабатывает запросы к серверу для загрузки и сохранения состояния игры
 */
import type { ExtendedGameState } from "../../types/gameTypes";
import type { SaveProgressResponse, LoadProgressResponse } from "../../types/saveTypes";
import { getToken } from '../auth/authenticationService';

/**
 * Базовый URL для API
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Хранение активных запросов для возможности отмены
const activeRequests: AbortController[] = [];

/**
 * Получает актуальный заголовок авторизации
 * @returns Заголовок авторизации или null, если токен недоступен
 */
const getAuthHeader = async (): Promise<HeadersInit | null> => {
  try {
    const token = getToken();
    if (!token) {
      console.warn('[API Service] Отсутствует JWT токен для авторизации');
      return null;
    }
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  } catch (error) {
    console.error('[API Service] Ошибка получения JWT токена:', error);
    return null;
  }
};

/**
 * Сохраняет состояние игры через API
 * @param userId ID пользователя
 * @param gameState Состояние игры
 * @param isCompressed Флаг сжатия данных
 * @returns Результат операции сохранения
 */
export async function saveGameStateViaAPI(
  userId: string, 
  gameState: ExtendedGameState, 
  isCompressed = false
): Promise<SaveProgressResponse> {
  try {
    console.log(`[ApiService] Отправляем запрос на сохранение для пользователя ${userId}`);
    
    // Получаем JWT-токен
    const token = getToken();
    
    // Проверяем наличие токена
    if (!token) {
      console.error(`[ApiService] JWT-токен отсутствует для пользователя ${userId}`);
      throw new Error('Отсутствует JWT токен для аутентификации');
    }
    
    // Подготавливаем данные запроса
    const requestData = {
      userId: userId,
      gameState: gameState,
      version: gameState._saveVersion || 1,
      isCompressed: isCompressed
    };
    
    // Отправляем запрос на API
    const apiUrl = `${API_BASE_URL}/api/game/save-progress`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ApiService] Ошибка HTTP при сохранении: ${response.status} ${response.statusText}, ${errorText}`);
      throw new Error(`HTTP ошибка: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      console.error(`[ApiService] Сервер вернул ошибку при сохранении: ${result.error || 'Неизвестная ошибка'}`);
      throw new Error(result.error || 'Ошибка сервера при сохранении');
    }
    
    console.log(`[ApiService] Данные успешно сохранены на сервере для ${userId}`);
    return result;
  } catch (error) {
    console.error(`[ApiService] Ошибка при сохранении через API:`, error);
    throw error;
  }
}

/**
 * Загружает состояние игры через API
 * @param userId ID пользователя
 * @returns Состояние игры или null при ошибке
 */
export async function loadGameStateViaAPI(userId: string): Promise<ExtendedGameState | null> {
  try {
    console.log(`[ApiService] Загрузка данных для пользователя ${userId}`);
    
    // Получаем JWT-токен
    const token = getToken();
    
    // Проверяем наличие токена
    if (!token) {
      console.error(`[ApiService] JWT-токен отсутствует для пользователя ${userId}`);
      throw new Error('Отсутствует JWT токен для аутентификации');
    }
    
    // Отправляем запрос на API
    const apiUrl = `${API_BASE_URL}/api/game/load-progress?userId=${encodeURIComponent(userId)}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ApiService] Ошибка HTTP при загрузке: ${response.status} ${response.statusText}, ${errorText}`);
      throw new Error(`HTTP ошибка: ${response.status} ${response.statusText}`);
    }
    
    const result: LoadProgressResponse = await response.json();
    
    if (!result.success) {
      // Если пользователь новый, это не ошибка
      if (result.isNewUser) {
        console.log(`[ApiService] Новый пользователь ${userId}, возвращаем null`);
        return null;
      }
      
      console.error(`[ApiService] Сервер вернул ошибку при загрузке: ${result.error || 'Неизвестная ошибка'}`);
      throw new Error(result.error || 'Ошибка сервера при загрузке');
    }
    
    console.log(`[ApiService] Данные успешно загружены с сервера для ${userId}`);
    return result.gameState as ExtendedGameState;
  } catch (error) {
    console.error(`[ApiService] Ошибка при загрузке через API:`, error);
    throw error;
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