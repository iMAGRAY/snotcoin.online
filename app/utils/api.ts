/**
 * API клиент для взаимодействия с сервером
 */

import { ExtendedGameState } from "../types/gameTypes";
import { StructuredGameSave, CompressedGameState, gameStateToStructured, structuredToGameState } from "../types/saveTypes";
import { compressGameState } from "./dataCompression";

// Базовый URL для API запросов
const API_BASE_URL = '/api';

/**
 * Получает токен авторизации из localStorage
 */
function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token');
  }
  return null;
}

/**
 * Класс API клиента для работы с сервером
 */
export class ApiClient {
  /**
   * Сохраняет прогресс игры на сервере
   * @param userId ID пользователя
   * @param gameState Состояние игры
   * @param options Опции запроса
   * @returns Результат сохранения
   */
  static async saveGameProgress(
    userId: string, 
    gameState: ExtendedGameState,
    options: {
      compress?: boolean;
      timeout?: number;
    } = {}
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    version?: number;
  }> {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }
      
      // Устанавливаем таймаут
      const timeoutMs = options.timeout || 10000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      // Подготавливаем данные для отправки
      let compressedData: CompressedGameState | null = null;
      let isCompressed = false;
      
      // Структурируем данные для более эффективного хранения
      const structuredState = gameStateToStructured(gameState);
      
      // Сжимаем данные, если необходимо
      if (options.compress) {
        compressedData = await compressGameState(
          gameState,
          userId,
          {
            includeIntegrityInfo: true,
            removeTempData: true
          }
        );
        isCompressed = !!compressedData;
      }
      
      // Выполняем запрос
      const response = await fetch(`${API_BASE_URL}/game/save-progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          progress: {
            userId,
            gameState: structuredState,
            compressedData: isCompressed ? compressedData : null,
            isCompressed,
            clientTimestamp: new Date().toISOString()
          }
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при сохранении прогресса');
      }
      
      const result = await response.json();
      return {
        success: true,
        message: result.message || 'Прогресс успешно сохранен',
        version: result.progress?.version
      };
      
    } catch (error) {
      console.error('Ошибка при сохранении прогресса:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  }
  
  /**
   * Загружает прогресс игры с сервера
   * @param userId ID пользователя
   * @returns Результат загрузки с состоянием игры
   */
  static async loadGameProgress(userId: string): Promise<{
    success: boolean;
    gameState?: ExtendedGameState;
    message?: string;
    error?: string;
  }> {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }
      
      // Выполняем запрос
      const response = await fetch(`${API_BASE_URL}/game/load-progress`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при загрузке прогресса');
      }
      
      const result = await response.json();
      
      if (!result.success || !result.progress) {
        throw new Error('Данные прогресса не найдены');
      }
      
      // Преобразуем структурированное сохранение в формат состояния игры
      const structuredSave = result.progress as StructuredGameSave;
      
      // Преобразуем в ExtendedGameState
      const gameState: ExtendedGameState = structuredToGameState(structuredSave);
      
      // Устанавливаем userId из параметра
      gameState._userId = userId;
      
      return {
        success: true,
        gameState,
        message: 'Прогресс успешно загружен'
      };
      
    } catch (error) {
      console.error('Ошибка при загрузке прогресса:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  }
}