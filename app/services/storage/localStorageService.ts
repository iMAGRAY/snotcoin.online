/**
 * Сервис для работы с localStorage
 * Обеспечивает сохранение и загрузку игровых данных в локальном хранилище браузера
 */
import type { ExtendedGameState } from '../../types/gameTypes';
import { signGameState, verifyDataSignature } from '../../utils/dataIntegrity';

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
 * @returns true если операция успешна
 */
export const saveGameStateBackup = (userId: string, gameState: ExtendedGameState): boolean => {
  if (!userId) {
    console.error('[LocalStorage] Ошибка создания резервной копии: отсутствует userId');
    return false;
  }
  
  if (!gameState) {
    console.error('[LocalStorage] Ошибка создания резервной копии: отсутствует gameState');
    return false;
  }
  
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      console.warn('[LocalStorage] localStorage недоступен для создания резервной копии');
      return false;
    }
    
    // Получаем метаданные о резервных копиях или создаем новые
    const metadataKey = KEYS.GAME_STATE_BACKUP;
    let metadata: BackupMetadata = {};
    
    try {
      const metadataJson = localStorage.getItem(metadataKey);
      if (metadataJson) {
        metadata = JSON.parse(metadataJson);
      }
    } catch (parseError) {
      console.error('[LocalStorage] Ошибка при чтении метаданных резервных копий:', parseError);
      // Создаем новые метаданные, если не удалось прочитать
      metadata = {};
    }
    
    // Инициализируем данные пользователя, если это первая резервная копия
    if (!metadata[userId]) {
      metadata[userId] = {
        backups: [],
        lastBackupTime: 0
      };
    }
    
    // Создаем глубокую копию состояния, чтобы не модифицировать оригинал
    let cleanedState: ExtendedGameState;
    try {
      cleanedState = JSON.parse(JSON.stringify(gameState));
    } catch (cloneError) {
      console.error('[LocalStorage] Ошибка при создании копии состояния:', cloneError);
      
      // Создаем минимальную копию, содержащую только критические данные
      cleanedState = {
        inventory: { ...gameState.inventory },
        upgrades: { ...gameState.upgrades },
        container: gameState.container || {
          level: 1,
          capacity: 100,
          currentAmount: 0,
          fillRate: 1
        },
        achievements: gameState.achievements,
        stats: gameState.stats,
        settings: gameState.settings,
        _userId: userId,
        _saveVersion: gameState._saveVersion || 1,
        _savedAt: new Date().toISOString(),
        user: gameState.user
      };
      console.warn('[LocalStorage] Создана упрощенная копия состояния из-за ошибки клонирования');
    }
    
    // Удаляем проблемные поля перед сохранением
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
      '_frameData',
      '_callbacks',
      '_handlers',
      '_listeners',
      '_events',
      '_subscriptions',
      '_reactInternals',
      '_internalRoot',
      'logs',
      'analytics'
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
    
    // Обновляем версию сохранения при создании резервной копии, если не задана
    if (!cleanedState._saveVersion) {
      cleanedState._saveVersion = 1;
    }
    
    // Добавляем метку времени последнего изменения
    cleanedState._lastModified = Date.now();
    
    // Добавляем подпись для проверки целостности
    // Проверяем, нет ли уже существующей подписи
    if (!cleanedState._dataSignature) {
      cleanedState = signGameState(userId, cleanedState);
    }
    
    // Создаем контрольную сумму для проверки целостности данных
    const checksum = generateSimpleChecksum(JSON.stringify(cleanedState));
    
    // Генерируем ключ для хранения резервной копии
    const timestamp = Date.now();
    const backupKey = `backup_${userId}_${timestamp}`;
    
    // Создаем объект с данными резервной копии
    const backupData: BackupData = {
      timestamp,
      version: cleanedState._saveVersion || 1,
      gameState: cleanedState,
      checksum // Добавляем контрольную сумму
    };
    
    try {
      // Преобразуем в JSON и сохраняем
      const backupJson = JSON.stringify(backupData);
      localStorage.setItem(backupKey, backupJson);
      
      // Обновляем метаданные
      metadata[userId].backups.push({
        key: backupKey,
        timestamp,
        version: backupData.version,
        size: backupJson.length,
        checksum // Дублируем контрольную сумму в метаданных
      });
      
      // Сохраняем время последнего резервного копирования
      metadata[userId].lastBackupTime = timestamp;
      
      // Обновляем метаданные
      localStorage.setItem(metadataKey, JSON.stringify(metadata));
      
      // Запускаем очистку старых резервных копий
      try {
        manageBackups(userId, metadata);
      } catch (cleanupError) {
        console.warn('[LocalStorage] Ошибка при очистке старых резервных копий:', cleanupError);
      }
      
      // Логируем успешное сохранение
      console.log(`[LocalStorage] Создана резервная копия ${backupKey}`);
      return true;
    } catch (storageError) {
      // Проверяем, не превышен ли лимит хранилища
      if (storageError instanceof DOMException && 
          (storageError.name === 'QuotaExceededError' || storageError.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        console.error('[LocalStorage] Превышен лимит localStorage при создании резервной копии');
        
        // Пытаемся очистить место
        try {
          manageBackups(userId, metadata, true);
          
          // После очистки пробуем снова сохранить
          try {
            localStorage.setItem(backupKey, JSON.stringify(backupData));
            
            // Обновляем метаданные
            metadata[userId].backups.push({
              key: backupKey,
              timestamp,
              version: backupData.version,
              size: JSON.stringify(backupData).length,
              checksum
            });
            
            metadata[userId].lastBackupTime = timestamp;
            localStorage.setItem(metadataKey, JSON.stringify(metadata));
            
            console.log(`[LocalStorage] Создана резервная копия ${backupKey} после очистки`);
            return true;
          } catch (retryError) {
            console.error('[LocalStorage] Не удалось создать резервную копию после очистки:', retryError);
            return false;
          }
        } catch (cleanupError) {
          console.error('[LocalStorage] Ошибка при очистке localStorage для освобождения места:', cleanupError);
          return false;
        }
      } else {
        console.error('[LocalStorage] Ошибка при сохранении резервной копии:', storageError);
        return false;
      }
    }
  } catch (error) {
    console.error('[LocalStorage] Критическая ошибка при создании резервной копии:', error);
    return false;
  }
};

/**
 * Создает простую контрольную сумму для строки
 * @param data Строка данных
 * @returns Контрольная сумма
 */
function generateSimpleChecksum(data: string): string {
  let hash = 0;
  
  if (data.length === 0) return hash.toString(16);
  
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return hash.toString(16);
}

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

/**
 * Интерфейс для метаданных о резервных копиях
 */
interface BackupMetadata {
  [userId: string]: {
    backups: BackupInfo[];
    lastBackupTime: number;
  };
}

/**
 * Информация о резервной копии
 */
interface BackupInfo {
  key: string;
  timestamp: number;
  version: number;
  size: number;
  checksum?: string;
}

/**
 * Данные резервной копии
 */
interface BackupData {
  timestamp: number;
  version: number;
  gameState: ExtendedGameState;
  checksum?: string;
}

/**
 * Управляет резервными копиями для пользователя
 * @param userId ID пользователя
 * @param metadata Метаданные о резервных копиях
 * @param aggressiveCleanup Флаг агрессивной очистки (удаляет больше копий)
 * @returns Успешность операции
 */
function manageBackups(userId: string, metadata: BackupMetadata, aggressiveCleanup: boolean = false): boolean {
  try {
    // Получаем список резервных копий для пользователя
    const backups = metadata[userId]?.backups || [];
    
    // Если нет резервных копий, выходим
    if (backups.length === 0) return true;
    
    // Максимальное количество резервных копий для хранения
    const MAX_BACKUPS = aggressiveCleanup ? 5 : 10;
    
    // Сортируем резервные копии по времени (новые в конце)
    backups.sort((a, b) => a.timestamp - b.timestamp);
    
    // Если количество копий больше максимального, удаляем старые
    if (backups.length > MAX_BACKUPS) {
      // Выбираем копии для удаления
      const backupsToRemove = backups.slice(0, backups.length - MAX_BACKUPS);
      
      // Удаляем их из localStorage
      backupsToRemove.forEach(backup => {
        if (backup.key) {
          localStorage.removeItem(backup.key);
        }
      });
      
      // Обновляем список оставшихся копий
      metadata[userId].backups = backups.slice(backups.length - MAX_BACKUPS);
      
      // Сохраняем обновленные метаданные
      localStorage.setItem(KEYS.GAME_STATE_BACKUP, JSON.stringify(metadata));
      
      console.log(`[LocalStorage] Удалено ${backupsToRemove.length} старых резервных копий для пользователя ${userId}`);
    }
    
    return true;
  } catch (error) {
    console.error('[LocalStorage] Ошибка при управлении резервными копиями:', error);
    return false;
  }
}

/**
 * Сервис для работы с локальным хранилищем
 */
export const localStorageService = {
  /**
   * Сохраняет объект в localStorage
   * @param key Ключ
   * @param value Значение
   */
  setItem(key: string, value: any): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('[LocalStorage] Ошибка при сохранении данных', error);
    }
  },

  /**
   * Получает объект из localStorage
   * @param key Ключ
   * @returns Значение или null
   */
  getItem<T>(key: string): T | null {
    try {
      if (typeof window === 'undefined') return null;
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('[LocalStorage] Ошибка при получении данных', error);
      return null;
    }
  },

  /**
   * Удаляет объект из localStorage
   * @param key Ключ
   */
  removeItem(key: string): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(key);
    } catch (error) {
      console.error('[LocalStorage] Ошибка при удалении данных', error);
    }
  },

  /**
   * Сохраняет состояние игры
   * @param userId ID пользователя
   * @param gameState Состояние игры
   * @returns Успешность операции
   */
  saveGameState(userId: string, gameState: ExtendedGameState): boolean {
    try {
      if (typeof window === 'undefined') return false;
      if (!userId || !gameState) {
        console.error('[LocalStorage] Невозможно сохранить состояние: отсутствуют данные');
        return false;
      }
      
      // Добавляем подпись для защиты данных от модификации
      const signedState = signGameState(userId, gameState);
      
      // Сохраняем с уникальным ключом для пользователя
      const key = `game_state_${userId}`;
      localStorage.setItem(key, JSON.stringify(signedState));
      
      // Сохраняем метаданные о времени последнего сохранения
      const metaKey = `game_state_meta_${userId}`;
      const meta = {
        savedAt: new Date().toISOString(),
        version: signedState._saveVersion || 1,
        clientId: this.getClientId()
      };
      localStorage.setItem(metaKey, JSON.stringify(meta));
      
      return true;
    } catch (error) {
      console.error('[LocalStorage] Ошибка при сохранении состояния игры', error);
      return false;
    }
  },

  /**
   * Загружает состояние игры
   * @param userId ID пользователя
   * @returns Состояние игры или null
   */
  loadGameState(userId: string): ExtendedGameState | null {
    try {
      if (typeof window === 'undefined') return null;
      if (!userId) {
        console.error('[LocalStorage] Невозможно загрузить состояние: отсутствует userId');
        return null;
      }
      
      const key = `game_state_${userId}`;
      const stateJson = localStorage.getItem(key);
      
      if (!stateJson) {
        console.log('[LocalStorage] Состояние игры не найдено');
        return null;
      }
      
      const state = JSON.parse(stateJson) as ExtendedGameState;
      
      // Проверяем целостность данных, если есть подпись
      if (state._dataSignature) {
        const isValid = verifyDataSignature(userId, state, state._dataSignature);
        if (!isValid) {
          console.error('[LocalStorage] Нарушение целостности данных при загрузке');
          this.removeItem(key); // Удаляем поврежденные данные
          return null;
        }
      }
      
      // Обновляем время загрузки
      state._loadedAt = new Date().toISOString();
      
      return state;
    } catch (error) {
      console.error('[LocalStorage] Ошибка при загрузке состояния игры', error);
      return null;
    }
  },
  
  /**
   * Получает уникальный идентификатор клиента
   * @returns ID клиента
   */
  getClientId(): string {
    if (typeof window === 'undefined') return '';
    
    const clientIdKey = 'client_id';
    let clientId = localStorage.getItem(clientIdKey);
    
    if (!clientId) {
      clientId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem(clientIdKey, clientId);
    }
    
    return clientId;
  }
}; 