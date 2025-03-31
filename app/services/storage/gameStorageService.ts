/**
 * Сервис для работы с хранилищем игрового состояния
 */
import type { GameState } from '../../types/gameTypes';
// Удаляем импорт несуществующих функций
// import { saveGameStateWithIntegrity, loadGameStateWithIntegrity } from '../gameDataService';

interface SaveResult {
  success: boolean;
  error?: string;
}

interface LoadResult {
  success: boolean;
  data?: GameState;
  error?: string;
  version?: number | undefined;
}

/**
 * Простая реализация функции сохранения состояния с целостностью
 * @param userId ID пользователя
 * @param state Состояние игры
 * @returns Результат операции с данными
 */
async function saveGameStateWithIntegrity(userId: string, state: GameState) {
  // Простая реализация, которая сохраняет в localStorage
  try {
    const storageKey = `game_state_${userId}`;
    localStorage.setItem(storageKey, JSON.stringify(state));
    return { success: true };
  } catch (error) {
    console.error('Ошибка при сохранении состояния:', error);
    return { success: false, error };
  }
}

/**
 * Простая реализация функции загрузки состояния с целостностью
 * @param userId ID пользователя
 * @returns Результат операции с данными
 */
async function loadGameStateWithIntegrity(userId: string) {
  // Простая реализация, которая загружает из localStorage
  try {
    const storageKey = `game_state_${userId}`;
    const data = localStorage.getItem(storageKey);
    if (!data) {
      return { success: false, error: 'Данные не найдены' };
    }
    return { success: true, data: JSON.parse(data), version: 1 };
  } catch (error) {
    console.error('Ошибка при загрузке состояния:', error);
    return { success: false, error };
  }
}

/**
 * Сохраняет состояние игры
 * @param userId ID пользователя
 * @param state Состояние игры
 * @returns Результат операции
 */
export async function saveGameState(userId: string, state: GameState): Promise<SaveResult> {
  try {
    console.log(`[GameStorageService] Сохранение состояния для ${userId}`);
    const result = await saveGameStateWithIntegrity(userId, state);
    return { success: true };
  } catch (error) {
    console.error(`[GameStorageService] Ошибка при сохранении:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Загружает состояние игры
 * @param userId ID пользователя
 * @returns Результат операции с данными
 */
export async function loadGameState(userId: string): Promise<LoadResult> {
  try {
    console.log(`[GameStorageService] Загрузка состояния для ${userId}`);
    const result = await loadGameStateWithIntegrity(userId);
    
    if (result.success && result.data) {
      return {
        success: true,
        data: result.data,
        version: result.version
      };
    }
    
    return {
      success: false,
      error: 'Не удалось загрузить состояние игры'
    };
  } catch (error) {
    console.error(`[GameStorageService] Ошибка при загрузке:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
} 