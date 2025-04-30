/**
 * Экспорт сервисов хранения данных
 * Система сохранения игры была удалена
 */

import { GameState } from '@/app/types/gameTypes';
import { ExtendedGameState } from '@/app/types/game';

// Define a prefix for all storage keys to avoid conflicts with other apps
const STORAGE_PREFIX = 'royaleway_';
const GAME_STATE_KEY = `${STORAGE_PREFIX}game_state`;
const GAME_STATE_BACKUP_KEY = `${STORAGE_PREFIX}game_state_backup`;
const LAST_SYNC_KEY = `${STORAGE_PREFIX}last_sync`;

/**
 * Проверяет целостность состояния игры
 */
const validateGameState = (state: any): state is ExtendedGameState => {
  if (!state || typeof state !== 'object') return false;
  
  // Проверяем обязательные поля
  const requiredFields = [
    'inventory',
    'container',
    'upgrades',
    '_userId',
    '_lastModified',
    '_createdAt',
    'stats',
    'settings',
    'soundSettings'
  ];
  
  return requiredFields.every(field => field in state);
};

/**
 * Сохраняет состояние игры в localStorage
 */
export const saveGameState = (gameState: ExtendedGameState): void => {
  if (typeof window === 'undefined') return;
  
  try {
    // Проверяем целостность данных перед сохранением
    if (!validateGameState(gameState)) {
      console.error('[Storage] Некорректное состояние игры');
      return;
    }

    // Добавляем метаданные
    const stateToSave = {
      ...gameState,
      _lastModified: Date.now(),
      _dataSource: 'local',
      _loadedAt: new Date().toISOString()
    };

    // Сохраняем основное состояние
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(stateToSave));
    
    // Создаем резервную копию
    const backup = {
      state: stateToSave,
      timestamp: Date.now(),
      version: 1
    };
    localStorage.setItem(GAME_STATE_BACKUP_KEY, JSON.stringify(backup));
    
    // Обновляем время последней синхронизации
    localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    
    console.log('[Storage] Состояние игры сохранено');
  } catch (error) {
    console.error('[Storage] Ошибка при сохранении состояния:', error);
    
    // Пытаемся сохранить хотя бы резервную копию
    try {
      const backup = {
        state: gameState,
        timestamp: Date.now(),
        version: 1
      };
      localStorage.setItem(GAME_STATE_BACKUP_KEY, JSON.stringify(backup));
    } catch (backupError) {
      console.error('[Storage] Ошибка при создании резервной копии:', backupError);
    }
  }
};

/**
 * Загружает состояние игры из localStorage
 */
export const loadGameState = (): ExtendedGameState | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    // Пытаемся загрузить основное состояние
    const savedState = localStorage.getItem(GAME_STATE_KEY);
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      if (validateGameState(parsedState)) {
        return parsedState;
      }
    }
    
    // Если основное состояние отсутствует или некорректно, пробуем загрузить из резервной копии
    const backupStr = localStorage.getItem(GAME_STATE_BACKUP_KEY);
    if (backupStr) {
      const backup = JSON.parse(backupStr);
      if (backup.state && backup.timestamp && validateGameState(backup.state)) {
        // Проверяем возраст резервной копии (не старше 24 часов)
        const backupAge = Date.now() - backup.timestamp;
        if (backupAge <= 24 * 60 * 60 * 1000) {
          console.log('[Storage] Загружено состояние из резервной копии');
          return backup.state;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('[Storage] Ошибка при загрузке состояния:', error);
    return null;
  }
};

/**
 * Очищает все сохраненные данные
 */
export const clearAllData = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(GAME_STATE_KEY);
    localStorage.removeItem(GAME_STATE_BACKUP_KEY);
    localStorage.removeItem(LAST_SYNC_KEY);
    console.log('[Storage] Все данные очищены');
  } catch (error) {
    console.error('[Storage] Ошибка при очистке данных:', error);
  }
}; 