/**
 * Сервис для работы с localStorage
 * Обеспечивает сохранение и загрузку игровых данных в локальном хранилище браузера
 */
import { ExtendedGameState } from '../../types/gameTypes';

// Ключи для localStorage
const STORAGE_KEYS = {
  GAME_STATE: 'snotcoin_game_state',
  SETTINGS: 'snotcoin_settings',
  USER_ID: 'snotcoin_user_id',
};

/**
 * Проверяет доступность localStorage
 */
export const isLocalStorageAvailable = (): boolean => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    
    // Проверяем доступность localStorage
    const testKey = 'test_storage';
    localStorage.setItem(testKey, '1');
    const testValue = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    
    return testValue === '1';
  } catch (error) {
    return false;
  }
};

/**
 * Сохраняет данные в localStorage
 * @param key Ключ
 * @param data Данные для сохранения
 * @returns true если данные успешно сохранены, иначе false
 */
export const setItem = <T>(key: string, data: T): boolean => {
  if (!isLocalStorageAvailable()) return false;
  
  try {
    const serializedData = JSON.stringify(data);
    localStorage.setItem(key, serializedData);
    return true;
  } catch (error) {
    console.error(`[LocalStorage] Ошибка при сохранении данных с ключом ${key}:`, error);
    return false;
  }
};

/**
 * Получает данные из localStorage
 * @param key Ключ
 * @returns Данные или null если данные не найдены
 */
export const getItem = <T>(key: string): T | null => {
  if (!isLocalStorageAvailable()) return null;
  
  try {
    const serializedData = localStorage.getItem(key);
    if (!serializedData) return null;
    return JSON.parse(serializedData) as T;
  } catch (error) {
    console.error(`[LocalStorage] Ошибка при получении данных с ключом ${key}:`, error);
    return null;
  }
};

/**
 * Удаляет данные из localStorage
 * @param key Ключ
 * @returns true если данные успешно удалены, иначе false
 */
export const removeItem = (key: string): boolean => {
  if (!isLocalStorageAvailable()) return false;
  
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`[LocalStorage] Ошибка при удалении данных с ключом ${key}:`, error);
    return false;
  }
};

/**
 * Очищает все данные из localStorage
 * @returns true если данные успешно очищены, иначе false
 */
export const clearStorage = (): boolean => {
  if (!isLocalStorageAvailable()) return false;
  
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.error(`[LocalStorage] Ошибка при очистке хранилища:`, error);
    return false;
  }
};

/**
 * Сохраняет игровое состояние
 * @param userId ID пользователя
 * @param state Игровое состояние
 * @returns true если состояние успешно сохранено, иначе false
 */
export const saveGameState = (userId: string, state: ExtendedGameState): boolean => {
  if (!userId) {
    console.error('[LocalStorage] ID пользователя не указан');
    return false;
  }
  
  // Добавляем метаданные перед сохранением
  const stateToSave: ExtendedGameState = {
    ...state,
    _userId: userId,
    _lastModified: Date.now(),
    _savedAt: new Date().toISOString()
  };
  
  return setItem(`${STORAGE_KEYS.GAME_STATE}_${userId}`, stateToSave);
};

/**
 * Загружает игровое состояние
 * @param userId ID пользователя
 * @returns Игровое состояние или null если состояние не найдено
 */
export const loadGameState = (userId: string): ExtendedGameState | null => {
  if (!userId) {
    console.error('[LocalStorage] ID пользователя не указан');
    return null;
  }
  
  return getItem<ExtendedGameState>(`${STORAGE_KEYS.GAME_STATE}_${userId}`);
};

/**
 * Удаляет игровое состояние
 * @param userId ID пользователя
 * @returns true если состояние успешно удалено, иначе false
 */
export const deleteGameState = (userId: string): boolean => {
  if (!userId) {
    console.error('[LocalStorage] ID пользователя не указан');
    return false;
  }
  
  return removeItem(`${STORAGE_KEYS.GAME_STATE}_${userId}`);
};

/**
 * Сохраняет настройки пользователя
 * @param userId ID пользователя
 * @param settings Настройки пользователя
 * @returns true если настройки успешно сохранены, иначе false
 */
export const saveSettings = (userId: string, settings: Record<string, any>): boolean => {
  if (!userId) {
    console.error('[LocalStorage] ID пользователя не указан');
    return false;
  }
  
  return setItem(`${STORAGE_KEYS.SETTINGS}_${userId}`, settings);
};

/**
 * Загружает настройки пользователя
 * @param userId ID пользователя
 * @returns Настройки пользователя или null если настройки не найдены
 */
export const loadSettings = (userId: string): Record<string, any> | null => {
  if (!userId) {
    console.error('[LocalStorage] ID пользователя не указан');
    return null;
  }
  
  return getItem<Record<string, any>>(`${STORAGE_KEYS.SETTINGS}_${userId}`);
};

/**
 * Сохраняет ID пользователя
 * @param userId ID пользователя
 * @returns true если ID пользователя успешно сохранен, иначе false
 */
export const saveUserId = (userId: string): boolean => {
  return setItem(STORAGE_KEYS.USER_ID, userId);
};

/**
 * Загружает ID пользователя
 * @returns ID пользователя или null если ID не найден
 */
export const loadUserId = (): string | null => {
  return getItem<string>(STORAGE_KEYS.USER_ID);
};

/**
 * Проверяет наличие сохраненного состояния игры
 * @param userId ID пользователя
 * @returns true если состояние игры существует, иначе false
 */
export const hasGameState = (userId: string): boolean => {
  if (!userId || !isLocalStorageAvailable()) return false;
  
  const state = localStorage.getItem(`${STORAGE_KEYS.GAME_STATE}_${userId}`);
  return !!state;
};

/**
 * Сохраняет резервную копию игрового состояния
 * @param userId ID пользователя
 * @param state Игровое состояние
 * @returns true если резервная копия успешно сохранена, иначе false
 */
export const saveGameStateBackup = (userId: string, state: ExtendedGameState): boolean => {
  if (!userId) {
    console.error('[LocalStorage] ID пользователя не указан');
    return false;
  }
  
  const timestamp = Date.now();
  
  // Добавляем метаданные перед сохранением
  const stateToSave: ExtendedGameState = {
    ...state,
    _userId: userId,
    _lastModified: timestamp,
    _savedAt: new Date().toISOString()
  };
  
  return setItem(`backup_${userId}_${timestamp}`, stateToSave);
};

/**
 * Загружает последнюю резервную копию игрового состояния
 * @param userId ID пользователя
 * @returns Игровое состояние из резервной копии или null если копия не найдена
 */
export const loadGameStateBackup = (userId: string): ExtendedGameState | null => {
  if (!userId || !isLocalStorageAvailable()) return null;
  
  try {
    // Находим все резервные копии для пользователя
    const backupKeys: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`backup_${userId}_`)) {
        backupKeys.push(key);
      }
    }
    
    // Если резервных копий нет, возвращаем null
    if (backupKeys.length === 0) return null;
    
    // Сортируем резервные копии по времени (самые новые в начале)
    backupKeys.sort((a, b) => {
      const timeA = parseInt((a.split('_').pop() || '0'), 10);
      const timeB = parseInt((b.split('_').pop() || '0'), 10);
      return timeB - timeA;
    });
    
    // Загружаем самую новую резервную копию
    const latestBackupKey = backupKeys[0];
    const backup = getItem<ExtendedGameState>(latestBackupKey);
    
    // Удаляем использованную резервную копию
    if (backup) {
      removeItem(latestBackupKey);
    }
    
    return backup;
  } catch (error) {
    console.error('[LocalStorage] Ошибка при загрузке резервной копии:', error);
    return null;
  }
};

/**
 * Очищает все резервные копии игрового состояния
 * @returns true если резервные копии успешно удалены, иначе false
 */
export const clearGameStateBackups = (): boolean => {
  if (!isLocalStorageAvailable()) return false;
  
  try {
    // Находим все резервные копии
    const backupKeys: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('backup_')) {
        backupKeys.push(key);
      }
    }
    
    // Удаляем все резервные копии
    backupKeys.forEach(key => {
      removeItem(key);
    });
    
    return true;
  } catch (error) {
    console.error('[LocalStorage] Ошибка при очистке резервных копий:', error);
    return false;
  }
};

// Экспортируем все ключи
export const KEYS = STORAGE_KEYS; 