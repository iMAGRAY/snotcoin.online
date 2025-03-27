/**
 * storageService.ts
 * Универсальный сервис для работы с хранилищами (localStorage и IndexedDB)
 * Автоматически выбирает подходящее хранилище в зависимости от размера данных
 */

import * as indexedDB from './indexedDBService';
import * as localStorageManager from './localStorageManager';

// Константы для определения стратегии хранения
const MAX_LOCALSTORAGE_ITEM_SIZE = 300 * 1024; // 300KB - максимальный рекомендуемый размер для localStorage
const LOCALSTORAGE_USAGE_THRESHOLD = 70; // Процент заполнения localStorage, при котором начинаем использовать IndexedDB

// Типы хранилищ
export enum StorageType {
  LOCAL_STORAGE = 'localStorage',
  INDEXED_DB = 'indexedDB',
  HYBRID = 'hybrid' // Гибридный режим: метаданные в localStorage, большие данные в IndexedDB
}

// Интерфейс для конфигурации хранилища
export interface StorageConfig {
  preferredStorage: StorageType;
  hybridThreshold?: number; // Размер в байтах, после которого данные переходят в IndexedDB
  autoCleanup?: boolean;
  maxBackups?: number;
  enableCompression?: boolean;
}

// Глобальная конфигурация хранилища
let storageConfig: StorageConfig = {
  preferredStorage: StorageType.HYBRID,
  hybridThreshold: 307200, // 300 КБ
  autoCleanup: true,
  maxBackups: 3,
  enableCompression: false
};

// Состояние инициализации
let isInitialized = false;

/**
 * Инициализация хранилища
 * @param config Конфигурация хранилища
 */
export const initStorage = async (config: Partial<StorageConfig>): Promise<void> => {
  try {
    // Обновляем конфигурацию
    storageConfig = {
      ...storageConfig,
      ...config
    };
    
    // Инициализируем IndexedDB
    if (storageConfig.preferredStorage === StorageType.INDEXED_DB || 
        storageConfig.preferredStorage === StorageType.HYBRID) {
      try {
        await indexedDB.initDatabase();
        console.log('[storageService] IndexedDB успешно инициализирован');
      } catch (error) {
        console.error('[storageService] Ошибка при инициализации IndexedDB:', error);
        
        // Если не удалось инициализировать IndexedDB, переходим на localStorage
        if (storageConfig.preferredStorage === StorageType.INDEXED_DB) {
          console.warn('[storageService] Переключение на localStorage из-за ошибки IndexedDB');
          storageConfig.preferredStorage = StorageType.LOCAL_STORAGE;
        }
      }
    }
    
    isInitialized = true;
  } catch (error) {
    console.error('[storageService] Ошибка при инициализации хранилища:', error);
    throw error;
  }
};

/**
 * Получение текущей конфигурации хранилища
 */
export const getStorageConfig = (): StorageConfig => {
  return { ...storageConfig };
};

/**
 * Сохранение игрового состояния
 * @param userId ID пользователя
 * @param data Данные для сохранения
 * @param version Версия сохранения
 */
export const saveGameState = async (
  userId: string,
  data: any,
  version: number
): Promise<{ success: boolean; storageType: StorageType }> => {
  // Проверяем инициализацию
  if (!isInitialized) {
    await initStorage(storageConfig);
  }
  
  try {
    // Преобразуем данные в строку для определения размера
    const dataString = JSON.stringify(data);
    const dataSize = dataString.length;
    
    // Выбираем хранилище в зависимости от размера и конфигурации
    let targetStorage = StorageType.LOCAL_STORAGE;
    
    if (storageConfig.preferredStorage === StorageType.INDEXED_DB) {
      targetStorage = StorageType.INDEXED_DB;
    } else if (storageConfig.preferredStorage === StorageType.HYBRID) {
      // В гибридном режиме выбираем хранилище в зависимости от размера
      if (dataSize > (storageConfig.hybridThreshold || 102400)) {
        targetStorage = StorageType.INDEXED_DB;
      }
    }
    
    // Выводим информацию о размере данных и выбранном хранилище
    console.log(`[storageService] Сохранение данных пользователя ${userId}, размер: ${(dataSize / 1024).toFixed(2)}KB, хранилище: ${targetStorage}`);
    
    // Сохраняем данные в выбранное хранилище
    if (targetStorage === StorageType.INDEXED_DB) {
      await indexedDB.saveGameData(userId, data, version);
    } else {
      // Используем безопасное сохранение с автоматической очисткой при необходимости
      await localStorageManager.safeSetItem(`gameState_${userId}`, dataString, storageConfig.autoCleanup);
      
      // Также сохраняем метаданные для быстрого доступа
      const metadata = {
        lastSaved: new Date().toISOString(),
        version,
        size: dataSize
      };
      
      await localStorageManager.safeSetItem(`gameState_${userId}_meta`, JSON.stringify(metadata), false);
    }
    
    return {
      success: true,
      storageType: targetStorage
    };
  } catch (error) {
    console.error(`[storageService] Ошибка при сохранении данных пользователя ${userId}:`, error);
    
    // В случае ошибки пытаемся использовать альтернативное хранилище
    try {
      if (storageConfig.preferredStorage !== StorageType.LOCAL_STORAGE) {
        console.log(`[storageService] Попытка сохранения в альтернативное хранилище (localStorage)`);
        
        // Преобразуем данные в строку, если еще не сделали
        const dataString = typeof data === 'string' ? data : JSON.stringify(data);
        
        // Пытаемся очистить место перед сохранением
        if (storageConfig.autoCleanup) {
          await localStorageManager.aggressiveCleanupLocalStorage(userId, 0.7, storageConfig.maxBackups || 3);
        }
        
        // Сохраняем в localStorage
        await localStorageManager.safeSetItem(`gameState_${userId}`, dataString, true);
        
        return {
          success: true,
          storageType: StorageType.LOCAL_STORAGE
        };
      }
    } catch (fallbackError) {
      console.error(`[storageService] Ошибка при сохранении в альтернативное хранилище:`, fallbackError);
    }
    
    return {
      success: false,
      storageType: storageConfig.preferredStorage
    };
  }
};

/**
 * Загрузка игрового состояния
 * @param userId ID пользователя
 */
export const loadGameState = async (
  userId: string
): Promise<{ data: any | null; source: StorageType }> => {
  // Проверяем инициализацию
  if (!isInitialized) {
    await initStorage(storageConfig);
  }
  
  try {
    console.log(`[storageService] Загрузка данных пользователя ${userId}`);
    
    // Определяем, откуда загружать данные
    if (storageConfig.preferredStorage === StorageType.INDEXED_DB) {
      // Пробуем загрузить из IndexedDB
      try {
        const data = await indexedDB.getGameData(userId);
        if (data) {
          return { data, source: StorageType.INDEXED_DB };
        }
      } catch (idbError) {
        console.warn(`[storageService] Ошибка при загрузке из IndexedDB:`, idbError);
      }
    } else if (storageConfig.preferredStorage === StorageType.LOCAL_STORAGE) {
      // Загружаем из localStorage
      try {
        const dataString = localStorage.getItem(`gameState_${userId}`);
        if (dataString) {
          return { data: JSON.parse(dataString), source: StorageType.LOCAL_STORAGE };
        }
      } catch (lsError) {
        console.warn(`[storageService] Ошибка при загрузке из localStorage:`, lsError);
      }
    } else {
      // Гибридный режим - сначала пробуем localStorage для быстрого доступа
      try {
        const dataString = localStorage.getItem(`gameState_${userId}`);
        if (dataString) {
          return { data: JSON.parse(dataString), source: StorageType.LOCAL_STORAGE };
        }
      } catch (lsError) {
        console.warn(`[storageService] Ошибка при загрузке из localStorage в гибридном режиме:`, lsError);
      }
      
      // Затем пробуем IndexedDB
      try {
        const data = await indexedDB.getGameData(userId);
        if (data) {
          return { data, source: StorageType.INDEXED_DB };
        }
      } catch (idbError) {
        console.warn(`[storageService] Ошибка при загрузке из IndexedDB в гибридном режиме:`, idbError);
      }
    }
    
    // Если данные не найдены в приоритетных хранилищах, проверяем резервные копии
    console.log(`[storageService] Данные не найдены в основных хранилищах, проверяем резервные копии`);
    
    // Сначала проверяем бэкапы в localStorage
    try {
      const latestBackup = localStorageManager.getLatestBackup(userId);
      if (latestBackup) {
        return { data: latestBackup.gameState, source: StorageType.LOCAL_STORAGE };
      }
    } catch (backupError) {
      console.warn(`[storageService] Ошибка при загрузке резервной копии из localStorage:`, backupError);
    }
    
    // Затем проверяем бэкапы в IndexedDB
    if (isInitialized || storageConfig.preferredStorage !== StorageType.LOCAL_STORAGE) {
      try {
        const backup = await indexedDB.getLatestBackup(userId);
        if (backup) {
          return { data: backup.data, source: StorageType.INDEXED_DB };
        }
      } catch (idbBackupError) {
        console.warn(`[storageService] Ошибка при загрузке резервной копии из IndexedDB:`, idbBackupError);
      }
    }
    
    // Если ничего не найдено
    console.log(`[storageService] Данные пользователя ${userId} не найдены ни в одном хранилище`);
    return { data: null, source: StorageType.LOCAL_STORAGE };
  } catch (error) {
    console.error(`[storageService] Критическая ошибка при загрузке данных пользователя ${userId}:`, error);
    return { data: null, source: StorageType.LOCAL_STORAGE };
  }
};

/**
 * Создание резервной копии игрового состояния
 * @param userId ID пользователя
 * @param data Данные для резервного копирования
 * @param version Версия сохранения
 */
export const createBackup = async (
  userId: string,
  data: any,
  version: number
): Promise<{ success: boolean; storageType: StorageType }> => {
  // Проверяем инициализацию
  if (!isInitialized) {
    await initStorage(storageConfig);
  }
  
  try {
    // Создаем метаданные для резервной копии
    const timestamp = Date.now();
    const backupKey = `backup_${userId}_${timestamp}`;
    
    // Преобразуем данные в строку для определения размера
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const dataSize = dataString.length;
    
    // Выбираем хранилище в зависимости от размера и конфигурации
    let targetStorage = StorageType.LOCAL_STORAGE;
    
    if (storageConfig.preferredStorage === StorageType.INDEXED_DB) {
      targetStorage = StorageType.INDEXED_DB;
    } else if (storageConfig.preferredStorage === StorageType.HYBRID) {
      // В гибридном режиме выбираем хранилище в зависимости от размера
      if (dataSize > (storageConfig.hybridThreshold || 102400)) {
        targetStorage = StorageType.INDEXED_DB;
      }
    }
    
    // Сохраняем резервную копию в выбранное хранилище
    if (targetStorage === StorageType.INDEXED_DB) {
      // Перед сохранением очищаем старые резервные копии, если это настроено
      if (storageConfig.autoCleanup) {
        await indexedDB.cleanupBackups(userId, storageConfig.maxBackups || 3);
      }
      
      // Сохраняем резервную копию в IndexedDB
      await indexedDB.createBackup(userId, data, version, timestamp);
      
      // Также сохраняем метаданные в localStorage для быстрого доступа
      const metadata = {
        timestamp,
        version,
        size: dataSize,
        storage: 'indexedDB'
      };
      
      localStorage.setItem(`backup_${userId}_meta`, JSON.stringify(metadata));
      localStorage.setItem(`backup_${userId}_latest`, String(timestamp));
    } else {
      // Перед сохранением очищаем старые резервные копии, если это настроено
      if (storageConfig.autoCleanup) {
        await localStorageManager.cleanupBackups(userId, storageConfig.maxBackups || 3);
      }
      
      // Создаем объект резервной копии
      const backup = {
        gameState: data,
        timestamp,
        version
      };
      
      // Сохраняем резервную копию в localStorage
      await localStorageManager.safeSetItem(backupKey, JSON.stringify(backup), true);
      
      // Обновляем ссылку на последнюю резервную копию
      localStorage.setItem(`backup_${userId}_latest`, backupKey);
    }
    
    return {
      success: true,
      storageType: targetStorage
    };
  } catch (error) {
    console.error(`[storageService] Ошибка при создании резервной копии для пользователя ${userId}:`, error);
    
    // В случае ошибки пытаемся использовать альтернативное хранилище
    try {
      if (storageConfig.preferredStorage !== StorageType.LOCAL_STORAGE) {
        console.log(`[storageService] Попытка создания резервной копии в альтернативное хранилище (localStorage)`);
        
        // Создаем минимальную резервную копию (только важные данные)
        const minimalData = createMinimalBackup(data);
        
        // Перед сохранением очищаем старые резервные копии
        await localStorageManager.cleanupBackups(userId, 1); // Оставляем только 1 копию
        
        // Создаем объект резервной копии
        const timestamp = Date.now();
        const backupKey = `backup_${userId}_${timestamp}`;
        const backup = {
          gameState: minimalData,
          timestamp,
          version,
          isMinimal: true
        };
        
        // Сохраняем минимальную резервную копию
        await localStorageManager.safeSetItem(backupKey, JSON.stringify(backup), true);
        
        // Обновляем ссылку на последнюю резервную копию
        localStorage.setItem(`backup_${userId}_latest`, backupKey);
        
        return {
          success: true,
          storageType: StorageType.LOCAL_STORAGE
        };
      }
    } catch (fallbackError) {
      console.error(`[storageService] Ошибка при создании резервной копии в альтернативное хранилище:`, fallbackError);
    }
    
    return {
      success: false,
      storageType: storageConfig.preferredStorage
    };
  }
};

/**
 * Создание минимальной резервной копии с сохранением только критических данных
 * @param data Исходные данные
 * @returns Минимальная резервная копия
 */
const createMinimalBackup = (data: any): any => {
  // Если данные уже в строковом формате, преобразуем обратно в объект
  const gameData = typeof data === 'string' ? JSON.parse(data) : { ...data };
  
  // Создаем минимальную копию только с необходимыми полями
  const minimalData: Record<string, any> = {
    _userId: gameData._userId,
    _saveVersion: gameData._saveVersion || 1,
    _lastSaved: gameData._lastSaved || new Date().toISOString(),
    progress: gameData.progress || {},
    currency: gameData.currency || {},
    stats: gameData.stats || {}
  };
  
  // Добавляем критические данные, если они есть
  if (gameData.inventory) {
    minimalData.inventory = {
      coins: gameData.inventory.coins || 0,
      items: [] // Не сохраняем все предметы
    };
  }
  
  if (gameData.userData) {
    minimalData.userData = {
      id: gameData.userData.id,
      name: gameData.userData.name,
      level: gameData.userData.level || 1
    };
  }
  
  return minimalData;
};

/**
 * Удаляет все данные пользователя из всех хранилищ
 * @param userId ID пользователя
 */
export async function deleteAllUserData(userId: string): Promise<boolean> {
  try {
    if (!userId) {
      return false;
    }
    
    console.log(`[storageService] Удаление всех данных пользователя ${userId}`);
    
    // Удаляем данные из IndexedDB
    if (indexedDB.isIndexedDBAvailable()) {
      await indexedDB.deleteUserData(userId);
    }
    
    // Удаляем данные из localStorage
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes(`_${userId}_`) || 
        key.endsWith(`_${userId}`) || 
        key.startsWith(`backup_${userId}`) ||
        key.startsWith(`gameState_${userId}`)
      )) {
        keysToRemove.push(key);
      }
    }
    
    // Удаляем собранные ключи
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`[storageService] Удалено ${keysToRemove.length} записей из localStorage для пользователя ${userId}`);
    
    return true;
  } catch (error) {
    console.error('[storageService] Ошибка при удалении данных пользователя:', error);
    return false;
  }
}

/**
 * Получает информацию о хранилищах пользователя
 * @param userId ID пользователя
 */
export async function getUserStorageInfo(userId: string): Promise<{
  localStorage: {
    used: number;
    total: number;
    percent: number;
  };
  indexedDB: {
    gameDataSize: number;
    backupsCount: number;
    backupsSize: number;
    totalSize: number;
  };
  totalSize: number;
}> {
  try {
    // Получаем информацию о localStorage
    const { size, percent } = localStorageManager.getLocalStorageSize();
    const localStorageInfo = {
      used: size,
      total: 5 * 1024 * 1024, // Примерно 5MB
      percent
    };
    
    // Получаем информацию о IndexedDB
    let indexedDBInfo = {
      gameDataSize: 0,
      backupsCount: 0,
      backupsSize: 0,
      totalSize: 0
    };
    
    if (indexedDB.isIndexedDBAvailable() && userId) {
      const storageInfo = await indexedDB.getStorageInfo(userId);
      // Преобразуем данные из indexedDBService в формат, ожидаемый в storageService
      indexedDBInfo = {
        gameDataSize: storageInfo.size / 2, // Примерно половина размера для основных данных
        backupsCount: storageInfo.count,
        backupsSize: storageInfo.size / 2, // Примерно половина размера для бэкапов
        totalSize: storageInfo.size
      };
    }
    
    // Суммарный размер
    const totalSize = localStorageInfo.used + indexedDBInfo.totalSize;
    
    return {
      localStorage: localStorageInfo,
      indexedDB: indexedDBInfo,
      totalSize
    };
  } catch (error) {
    console.error('[storageService] Ошибка при получении информации о хранилищах:', error);
    
    // Возвращаем пустые данные в случае ошибки
    return {
      localStorage: {
        used: 0,
        total: 5 * 1024 * 1024,
        percent: 0
      },
      indexedDB: {
        gameDataSize: 0,
        backupsCount: 0,
        backupsSize: 0,
        totalSize: 0
      },
      totalSize: 0
    };
  }
} 