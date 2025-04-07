/**
 * ВНИМАНИЕ! Этот файл устарел и будет удален в ближайшее время.
 * Вместо него используйте систему сохранений из каталога saveSystem:
 * - LocalStorageAdapter - из app/services/saveSystem/adapters/LocalStorageAdapter
 * - saveManager - из app/services/saveSystem/index
 * - useSaveManager - из app/contexts/SaveManagerProvider
 */

/**
 * Сервис для работы с localStorage
 * Обеспечивает сохранение и загрузку игровых данных в локальном хранилище браузера
 */
import type { ExtendedGameState } from '../../types/gameTypes';

// Ключи для localStorage
const KEYS = {
  GAME_STATE_BACKUP: 'snotcoin_game_state_backup',
  USER_ID: 'snotcoin_user_id',
  SETTINGS: 'snotcoin_settings',
  LAST_CLEANUP: 'snotcoin_last_cleanup'
};

/**
 * Проверяет, доступен ли localStorage
 * @returns true если localStorage доступен, иначе false
 */
const isLocalStorageAvailable = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    
    const testKey = '__test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.warn('[LocalStorage] localStorage недоступен:', e);
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
 * @returns Данные из localStorage или null
 */
export const getItem = <T>(key: string): T | null => {
  if (!isLocalStorageAvailable()) return null;
  
  try {
    const serializedData = localStorage.getItem(key);
    if (!serializedData) return null;
    
    return JSON.parse(serializedData);
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
 * Очищает localStorage
 * @returns true если localStorage успешно очищен, иначе false
 */
export const clearAll = (): boolean => {
  if (!isLocalStorageAvailable()) return false;
  
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.error('[LocalStorage] Ошибка при очистке localStorage:', error);
    return false;
  }
};

/**
 * Сохраняет резервную копию состояния игры в localStorage
 * @param userId ID пользователя
 * @param gameState Состояние игры
 * @returns true если данные успешно сохранены, иначе false
 */
export const saveGameStateBackup = (userId: string, gameState: ExtendedGameState): boolean => {
  if (!isLocalStorageAvailable()) return false;
  
  try {
    if (!userId) {
      console.error('[LocalStorage] Ошибка: попытка сохранить резервную копию без ID пользователя');
      return false;
    }
    
    if (!gameState) {
      console.error('[LocalStorage] Ошибка: попытка сохранить резервную копию с пустым состоянием');
      return false;
    }
    
    // Удаляем проблемные поля перед сохранением
    const cleanedState = { ...gameState };
    
    // Список полей, которые следует удалить перед сохранением
    const fieldsToClean = [
      '_thrownBalls', 
      '_worldRef', 
      '_bodiesMap', 
      '_tempData',
      '_physicsObjects',
      '_sceneObjects',
      '_renderData',
      '_debugInfo',
      '_frameData'
    ];
    
    // Удаляем проблемные поля
    fieldsToClean.forEach(field => {
      if ((cleanedState as any)[field]) {
        delete (cleanedState as any)[field];
      }
    });
    
    // Проверяем и исправляем userId в состоянии
    if (!cleanedState._userId || cleanedState._userId !== userId) {
      console.log(`[LocalStorage] Исправление несоответствия userId в состоянии: ${cleanedState._userId} -> ${userId}`);
      cleanedState._userId = userId;
    }
    
    // Обновляем версию сохранения при создании резервной копии
    cleanedState._saveVersion = (cleanedState._saveVersion || 0) + 1;
    
    // Добавляем метку времени последнего изменения
    cleanedState._lastModified = Date.now();
    
    const backup = {
      userId,
      gameState: cleanedState,
      timestamp: Date.now(),
      version: cleanedState._saveVersion || 1
    };
    
    const success = setItem(KEYS.GAME_STATE_BACKUP, backup);
    
    if (success) {
      console.log(`[LocalStorage] Резервная копия состояния игры для ${userId} сохранена (v${backup.version})`);
    } else {
      console.warn(`[LocalStorage] Не удалось сохранить резервную копию для ${userId}`);
    }
    
    return success;
  } catch (error) {
    console.error(`[LocalStorage] Критическая ошибка при сохранении резервной копии:`, error);
    
    // Пытаемся сохранить критически важные данные в отдельное хранилище
    try {
      if (userId && gameState) {
        const criticalData = {
          userId: userId,
          timestamp: Date.now(),
          version: gameState._saveVersion || 1,
          criticalState: {
            inventory: gameState.inventory,
            upgrades: gameState.upgrades,
            container: gameState.container,
            _userId: userId,
            _saveVersion: gameState._saveVersion
          }
        };
        
        setItem(`${KEYS.GAME_STATE_BACKUP}_critical`, criticalData);
        console.log(`[LocalStorage] Сохранены критические данные для ${userId}`);
      }
    } catch (criticalError) {
      console.error(`[LocalStorage] Не удалось сохранить критические данные:`, criticalError);
    }
    
    return false;
  }
};

/**
 * Загружает резервную копию состояния игры из localStorage
 * @param userId ID пользователя для проверки
 * @returns Состояние игры или null
 */
export const loadGameStateBackup = (userId: string): ExtendedGameState | null => {
  if (!isLocalStorageAvailable()) return null;
  
  try {
    const backup = getItem<{
      userId: string;
      gameState: ExtendedGameState;
      timestamp: number;
      version: number;
    }>(KEYS.GAME_STATE_BACKUP);
    
    if (!backup) {
      // Проверяем наличие критической резервной копии
      const criticalBackup = getItem<{
        userId: string;
        timestamp: number;
        version: number;
        criticalState: Partial<ExtendedGameState>;
      }>(`${KEYS.GAME_STATE_BACKUP}_critical`);
      
      if (criticalBackup && criticalBackup.userId === userId) {
        console.log(`[LocalStorage] Найдена критическая резервная копия для ${userId}`);
        
        // Создаем минимальное состояние из критических данных
        return {
          ...criticalBackup.criticalState,
          _saveVersion: criticalBackup.version,
          _isRestoredFromCriticalBackup: true,
          userId: userId
        } as ExtendedGameState;
      }
      
      return null;
    }
    
    // Проверяем, совпадает ли userId
    if (backup.userId !== userId) {
      console.warn(`[LocalStorage] Резервная копия принадлежит другому пользователю (${backup.userId}, ожидается ${userId})`);
      return null;
    }
    
    // Проверяем возраст резервной копии
    const MAX_AGE = 24 * 60 * 60 * 1000; // 24 часа
    if (Date.now() - backup.timestamp > MAX_AGE) {
      console.warn(`[LocalStorage] Резервная копия устарела (${new Date(backup.timestamp).toISOString()})`);
      return null;
    }
    
    console.log(`[LocalStorage] Загружена резервная копия состояния игры для ${userId}`);
    
    // Добавляем метку восстановления из резервной копии
    backup.gameState._isRestoredFromBackup = true;
    
    return backup.gameState;
  } catch (error) {
    console.error(`[LocalStorage] Ошибка при загрузке резервной копии:`, error);
    return null;
  }
};

/**
 * Очищает резервную копию состояния игры
 * @returns true если данные успешно удалены, иначе false
 */
export const clearGameStateBackup = (): boolean => {
  if (!isLocalStorageAvailable()) return false;
  
  try {
    // Удаляем обе версии резервных копий
    const success1 = removeItem(KEYS.GAME_STATE_BACKUP);
    const success2 = removeItem(`${KEYS.GAME_STATE_BACKUP}_critical`);
    
    console.log(`[LocalStorage] Резервные копии состояния игры очищены`);
    
    return success1 || success2;
  } catch (error) {
    console.error(`[LocalStorage] Ошибка при очистке резервных копий:`, error);
    return false;
  }
};

/**
 * Сохраняет идентификатор пользователя
 * @param userId ID пользователя
 * @returns true если данные успешно сохранены, иначе false
 */
export const saveUserId = (userId: string): boolean => {
  return setItem(KEYS.USER_ID, { userId, timestamp: Date.now() });
};

/**
 * Загружает идентификатор пользователя
 * @returns ID пользователя или null
 */
export const loadUserId = (): string | null => {
  const data = getItem<{ userId: string; timestamp: number }>(KEYS.USER_ID);
  return data ? data.userId : null;
};

/**
 * Очищает идентификатор пользователя
 * @returns true если данные успешно удалены, иначе false
 */
export const clearUserId = (): boolean => {
  return removeItem(KEYS.USER_ID);
};

/**
 * Сохраняет настройки пользователя
 * @param settings Настройки пользователя
 * @returns true если данные успешно сохранены, иначе false
 */
export const saveSettings = (settings: Record<string, any>): boolean => {
  return setItem(KEYS.SETTINGS, settings);
};

/**
 * Загружает настройки пользователя
 * @returns Настройки пользователя или null
 */
export const loadSettings = (): Record<string, any> | null => {
  return getItem(KEYS.SETTINGS);
};

/**
 * Очищает локальное хранилище от устаревших данных
 */
export const cleanupStorage = (): void => {
  if (!isLocalStorageAvailable()) return;
  
  try {
    // Проверяем, не очищали ли мы хранилище недавно
    const lastCleanup = getItem<number>(KEYS.LAST_CLEANUP) || 0;
    const CLEANUP_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 дней
    
    if (Date.now() - lastCleanup < CLEANUP_INTERVAL) {
      return;
    }
    
    // Получаем все ключи
    const keys = Object.keys(localStorage);
    
    // Ищем устаревшие данные
    keys.forEach(key => {
      // Пропускаем ключи из KEYS
      if (Object.values(KEYS).includes(key)) return;
      
      // Проверяем, нет ли ключей с временными метками
      try {
        const value = localStorage.getItem(key);
        if (!value) return;
        
        const data = JSON.parse(value);
        
        // Проверяем наличие поля timestamp
        if (data.timestamp && typeof data.timestamp === 'number') {
          const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 дней
          
          if (Date.now() - data.timestamp > MAX_AGE) {
            localStorage.removeItem(key);
            console.log(`[LocalStorage] Удален устаревший ключ: ${key}`);
          }
        }
      } catch (error) {
        // Игнорируем ошибки при парсинге JSON
      }
    });
    
    // Обновляем время последней очистки
    setItem(KEYS.LAST_CLEANUP, Date.now());
  } catch (error) {
    console.error('[LocalStorage] Ошибка при очистке хранилища:', error);
  }
}; 