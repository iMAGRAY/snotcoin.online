import type { GameState, ExtendedGameState } from '../types/gameTypes';
import { localStorageService } from './storage/localStorageService';
import { isValidGameState } from '../utils/dataIntegrity';
import { signGameState, verifyDataSignature } from '../utils/dataIntegrity';
import { saveGameStateViaAPI } from './api/apiService';
import { getToken } from './auth/authenticationService';
import { saveGameStateBackup } from './storage/localStorageService';

interface SaveResponse {
  success: boolean;
  error?: string;
  version?: number;
}

interface LoadResponse {
  success: boolean;
  data?: GameState;
  error?: string;
  version?: number;
}

// Интерфейсы для работы с резервными копиями
interface BackupMetadata {
  backups: BackupInfo[];
}

interface BackupInfo {
  key: string;
  timestamp: number;
  version: number;
}

interface BackupData {
  gameState: GameState;
  timestamp: number;
  version: number;
}

// Экспортировать интерфейс SaveResponse
export type { SaveResponse };

/**
 * Проверяет наличие полей в объекте и их типы
 * @param obj Объект для проверки
 * @param fields Массив полей для проверки
 * @param expectedTypes Объект с ожидаемыми типами полей
 * @returns Объект с результатами проверки
 */
function validateObjectFields(
  obj: any, 
  fields: string[], 
  expectedTypes: Record<string, string> = {}
): { isValid: boolean; missingFields: string[]; wrongTypeFields: string[] } {
  const result = { 
    isValid: true, 
    missingFields: [] as string[], 
    wrongTypeFields: [] as string[] 
  };
  
  if (!obj || typeof obj !== 'object') {
    return { isValid: false, missingFields: ['object'], wrongTypeFields: [] };
  }
  
  for (const field of fields) {
    // Проверяем наличие поля
    if (obj[field] === undefined) {
      result.isValid = false;
      result.missingFields.push(field);
      continue;
    }
    
    // Проверяем тип поля, если указан ожидаемый тип
    const expectedType = expectedTypes[field];
    if (expectedType && typeof obj[field] !== expectedType) {
      result.isValid = false;
      result.wrongTypeFields.push(`${field} (expected ${expectedType}, got ${typeof obj[field]})`);
    }
  }
  
  return result;
}

// Максимальное количество резервных копий на одного пользователя
const MAX_BACKUPS_PER_USER = 3;

// Максимальный размер данных для сохранения в localStorage (в байтах, примерно 500 КБ)
const MAX_BACKUP_SIZE = 500 * 1024;

// Ключ для хранения метаданных о резервных копиях
const BACKUP_METADATA_KEY = 'backup_metadata';

// API роуты для сохранения и загрузки
export const API_ROUTES = {
  SAVE: '/api/game/save-progress',
  LOAD: '/api/game/load-progress',
};

/**
 * Очищает состояние игры от циклических ссылок и больших объектов
 * @param state Состояние игры для очистки
 * @returns Очищенное состояние
 */
export function sanitizeGameState(state: GameState): GameState {
  if (!state) return state;
  
  try {
    // Создаем копию для безопасного изменения
    const cleanState = JSON.parse(JSON.stringify(state));
    
    // Список полей для удаления
    const fieldsToRemove = [
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
    fieldsToRemove.forEach(field => {
      if (cleanState[field] !== undefined) {
        delete cleanState[field];
      }
    });
    
    // Проверяем размер массивов и при необходимости ограничиваем
    if (cleanState.achievements?.unlockedAchievements && 
        Array.isArray(cleanState.achievements.unlockedAchievements) && 
        cleanState.achievements.unlockedAchievements.length > 1000) {
      console.warn(`[gameDataService] Слишком много достижений (${cleanState.achievements.unlockedAchievements.length}), обрезаем до 1000`);
      cleanState.achievements.unlockedAchievements = cleanState.achievements.unlockedAchievements.slice(0, 1000);
    }
    
    if (cleanState.items && Array.isArray(cleanState.items) && cleanState.items.length > 1000) {
      console.warn(`[gameDataService] Слишком много предметов (${cleanState.items.length}), обрезаем до 1000`);
      cleanState.items = cleanState.items.slice(0, 1000);
    }
    
    // Проверка на корректность числовых значений в инвентаре
    if (cleanState.inventory) {
      const numericFields = [
        'snot', 'snotCoins', 'containerCapacity', 'containerSnot',
        'fillingSpeed', 'collectionEfficiency', 'Cap',
        'containerCapacityLevel', 'fillingSpeedLevel'
      ];
      
      numericFields.forEach(field => {
        if (cleanState.inventory[field] !== undefined) {
          // Если значение не является числом или бесконечность, сбрасываем к безопасному значению
          if (
            typeof cleanState.inventory[field] !== 'number' || 
            !isFinite(cleanState.inventory[field]) ||
            cleanState.inventory[field] < 0 || 
            cleanState.inventory[field] > Number.MAX_SAFE_INTEGER
          ) {
            console.warn(`[gameDataService] Некорректное значение поля ${field} в инвентаре: ${cleanState.inventory[field]}, сбрасываем`);
            
            // Устанавливаем безопасные значения по умолчанию
            switch (field) {
              case 'snot':
              case 'snotCoins':
              case 'containerSnot':
                cleanState.inventory[field] = 0;
                break;
              case 'containerCapacity':
              case 'Cap':
                cleanState.inventory[field] = 100;
                break;
              case 'fillingSpeed':
              case 'collectionEfficiency':
                cleanState.inventory[field] = 1;
                break;
              case 'containerCapacityLevel':
              case 'fillingSpeedLevel':
                cleanState.inventory[field] = 1;
                break;
              default:
                cleanState.inventory[field] = 0;
            }
          }
        }
      });
    }
    
    // Ограничиваем размер вложенных объектов
    const pruneDeepObjects = (obj: any, maxDepth: number = 10, currentDepth: number = 0) => {
      if (currentDepth >= maxDepth) return null;
      if (!obj || typeof obj !== 'object') return obj;
      
      const result: any = Array.isArray(obj) ? [] : {};
      
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key];
          if (value && typeof value === 'object') {
            result[key] = pruneDeepObjects(value, maxDepth, currentDepth + 1);
          } else {
            result[key] = value;
          }
        }
      }
      
      return result;
    };
    
    // Применяем ограничение глубины для предотвращения больших вложенных структур
    return pruneDeepObjects(cleanState, 15);
    
  } catch (error) {
    console.error('[gameDataService] Ошибка при очистке состояния игры:', error);
    return state; // Возвращаем исходное состояние, если не удалось очистить
  }
}

/**
 * Проверяет и исправляет состояние игры
 * @param state Состояние игры
 * @returns Исправленное состояние игры
 */
export function validateGameState(state: any): GameState {
  if (!state) {
    console.error('[gameDataService] validateGameState: Отсутствует состояние для валидации');
    return createDefaultGameState();
  }
  
  try {
    // Проверяем и исправляем основные поля
    if (!state.inventory) {
      console.warn('[gameDataService] validateGameState: Отсутствует inventory, будет создан');
      state.inventory = {
        snot: 0,
        snotCoins: 0,
        containerCapacity: 100,
        containerSnot: 0,
        fillingSpeed: 1,
        containerCapacityLevel: 1,
        fillingSpeedLevel: 1,
        collectionEfficiency: 1,
        Cap: 100,
        lastUpdateTimestamp: Date.now()
      };
    } else {
      // Проверяем типы полей инвентаря
      state.inventory.snot = Number(state.inventory.snot || 0);
      state.inventory.snotCoins = Number(state.inventory.snotCoins || 0);
      state.inventory.containerCapacity = Number(state.inventory.containerCapacity || 100);
      state.inventory.containerSnot = Number(state.inventory.containerSnot || 0);
      state.inventory.fillingSpeed = Number(state.inventory.fillingSpeed || 1);
      state.inventory.collectionEfficiency = Number(state.inventory.collectionEfficiency || 1);
      state.inventory.Cap = Number(state.inventory.Cap || 100);
      state.inventory.containerCapacityLevel = Number(state.inventory.containerCapacityLevel || 1);
      state.inventory.fillingSpeedLevel = Number(state.inventory.fillingSpeedLevel || 1);
      
      // Проверка на отрицательные значения
      if (state.inventory.snot < 0) state.inventory.snot = 0;
      if (state.inventory.snotCoins < 0) state.inventory.snotCoins = 0;
      if (state.inventory.containerCapacity < 1) state.inventory.containerCapacity = 100;
      if (state.inventory.containerSnot < 0) state.inventory.containerSnot = 0;
      if (state.inventory.fillingSpeed < 0.1) state.inventory.fillingSpeed = 1;
      if (state.inventory.collectionEfficiency < 0.1) state.inventory.collectionEfficiency = 1;
      if (state.inventory.Cap < 1) state.inventory.Cap = 100;
      if (state.inventory.containerCapacityLevel < 1) state.inventory.containerCapacityLevel = 1;
      if (state.inventory.fillingSpeedLevel < 1) state.inventory.fillingSpeedLevel = 1;
      
      // Добавляем timestamp, если отсутствует
      if (!state.inventory.lastUpdateTimestamp) {
        state.inventory.lastUpdateTimestamp = Date.now();
      }
    }
    
    if (!state.container) {
      console.warn('[gameDataService] validateGameState: Отсутствует container, будет создан');
      state.container = {
        level: 1,
        capacity: 100,
        currentAmount: 0,
        fillRate: 1
      };
    } else {
      // Проверяем типы полей контейнера
      state.container.level = Number(state.container.level || 1);
      state.container.capacity = Number(state.container.capacity || 100);
      state.container.currentAmount = Number(state.container.currentAmount || 0);
      state.container.fillRate = Number(state.container.fillRate || 1);
      
      // Проверка на отрицательные значения
      if (state.container.level < 1) state.container.level = 1;
      if (state.container.capacity < 1) state.container.capacity = 100;
      if (state.container.currentAmount < 0) state.container.currentAmount = 0;
      if (state.container.fillRate < 0.1) state.container.fillRate = 1;
      
      // Проверка на превышение ёмкости
      if (state.container.currentAmount > state.container.capacity) {
        state.container.currentAmount = state.container.capacity;
      }
    }
    
    if (!state.upgrades) {
      console.warn('[gameDataService] validateGameState: Отсутствуют upgrades, будут созданы');
      state.upgrades = {
        containerLevel: 1,
        fillingSpeedLevel: 1,
        collectionEfficiencyLevel: 1,
        clickPower: { level: 1, value: 1 },
        passiveIncome: { level: 1, value: 0.1 }
      };
    } else {
      // Проверяем типы полей улучшений
      state.upgrades.containerLevel = Number(state.upgrades.containerLevel || 1);
      state.upgrades.fillingSpeedLevel = Number(state.upgrades.fillingSpeedLevel || 1);
      state.upgrades.collectionEfficiencyLevel = Number(state.upgrades.collectionEfficiencyLevel || 1);
      
      // Проверка на отрицательные значения
      if (state.upgrades.containerLevel < 1) state.upgrades.containerLevel = 1;
      if (state.upgrades.fillingSpeedLevel < 1) state.upgrades.fillingSpeedLevel = 1;
      if (state.upgrades.collectionEfficiencyLevel < 1) state.upgrades.collectionEfficiencyLevel = 1;
      
      // Проверяем clickPower
      if (!state.upgrades.clickPower) {
        state.upgrades.clickPower = { level: 1, value: 1 };
      } else {
        state.upgrades.clickPower.level = Number(state.upgrades.clickPower.level || 1);
        state.upgrades.clickPower.value = Number(state.upgrades.clickPower.value || 1);
        
        if (state.upgrades.clickPower.level < 1) state.upgrades.clickPower.level = 1;
        if (state.upgrades.clickPower.value < 0.1) state.upgrades.clickPower.value = 1;
      }
      
      // Проверяем passiveIncome
      if (!state.upgrades.passiveIncome) {
        state.upgrades.passiveIncome = { level: 1, value: 0.1 };
      } else {
        state.upgrades.passiveIncome.level = Number(state.upgrades.passiveIncome.level || 1);
        state.upgrades.passiveIncome.value = Number(state.upgrades.passiveIncome.value || 0.1);
        
        if (state.upgrades.passiveIncome.level < 1) state.upgrades.passiveIncome.level = 1;
        if (state.upgrades.passiveIncome.value < 0) state.upgrades.passiveIncome.value = 0.1;
      }
    }
    
    // Проверяем наличие поля achievements и создаем его при необходимости
    if (!state.achievements) {
      state.achievements = { unlockedAchievements: [] };
    } else if (!state.achievements.unlockedAchievements) {
      state.achievements.unlockedAchievements = [];
    }
    
    // Проверяем наличие поля stats и создаем его при необходимости
    if (!state.stats) {
      state.stats = {
        highestLevel: 1,
        clickCount: 0,
        totalSnot: 0,
        totalSnotCoins: 0,
        playTime: 0,
        startDate: new Date().toISOString(),
        consecutiveLoginDays: 0
      };
    } else {
      // Проверяем типы полей статистики
      state.stats.highestLevel = Number(state.stats.highestLevel || 1);
      state.stats.clickCount = Number(state.stats.clickCount || 0);
      state.stats.totalSnot = Number(state.stats.totalSnot || 0);
      state.stats.totalSnotCoins = Number(state.stats.totalSnotCoins || 0);
      state.stats.playTime = Number(state.stats.playTime || 0);
      state.stats.consecutiveLoginDays = Number(state.stats.consecutiveLoginDays || 0);
      
      // Проверка на отрицательные значения
      if (state.stats.highestLevel < 1) state.stats.highestLevel = 1;
      if (state.stats.clickCount < 0) state.stats.clickCount = 0;
      if (state.stats.totalSnot < 0) state.stats.totalSnot = 0;
      if (state.stats.totalSnotCoins < 0) state.stats.totalSnotCoins = 0;
      if (state.stats.playTime < 0) state.stats.playTime = 0;
      if (state.stats.consecutiveLoginDays < 0) state.stats.consecutiveLoginDays = 0;
      
      // Проверяем формат даты
      if (!state.stats.startDate || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(state.stats.startDate)) {
        state.stats.startDate = new Date().toISOString();
      }
    }
    
    // Проверяем наличие служебных полей
    if (!state._saveVersion) state._saveVersion = 1;
    if (!state._savedAt) state._savedAt = new Date().toISOString();
    
    return state;
  } catch (error) {
    console.error('[gameDataService] Ошибка при валидации состояния игры:', error);
    return createDefaultGameState();
  }
}

/**
 * Создает дефолтное состояние игры для случаев, когда валидация не удалась
 */
function createDefaultGameState(): GameState {
  return {
    inventory: {
      snot: 0,
      snotCoins: 0,
      containerCapacity: 100,
      containerSnot: 0,
      fillingSpeed: 1,
      containerCapacityLevel: 1,
      fillingSpeedLevel: 1,
      collectionEfficiency: 1,
      Cap: 100,
      lastUpdateTimestamp: Date.now()
    },
    container: {
      level: 1,
      capacity: 100,
      currentAmount: 0,
      fillRate: 1
    },
    upgrades: {
      containerLevel: 1,
      fillingSpeedLevel: 1,
      clickPower: { level: 1, value: 1 },
      passiveIncome: { level: 1, value: 0.1 },
      collectionEfficiencyLevel: 1
    },
    _skipSave: false,
    _lastSaved: new Date().toISOString(),
    _saveVersion: 1
  } as GameState;
}

/**
 * Управляет резервными копиями для пользователя, удаляя старые если превышен лимит
 * @param userId ID пользователя
 * @returns boolean Успешно ли выполнена операция
 */
export function manageBackups(userId: string): boolean {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  
  try {
    // Получаем метаданные о резервных копиях
    let metadata: Record<string, BackupMetadata> = {};
    const metadataJson = localStorage.getItem(BACKUP_METADATA_KEY);
    
    if (metadataJson) {
      try {
        metadata = JSON.parse(metadataJson);
      } catch (e) {
        console.error('[gameDataService] Ошибка при разборе метаданных резервных копий:', e);
        metadata = {};
      }
    }
    
    // Создаем запись для пользователя, если её нет
    if (!metadata[userId]) {
      metadata[userId] = { backups: [] };
      localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
      return true;
    }
    
    // Проверяем количество резервных копий и удаляем старые, если превышен лимит
    if (metadata[userId].backups && metadata[userId].backups.length > MAX_BACKUPS_PER_USER) {
      // Сортируем по времени (от старых к новым)
      const backups = [...metadata[userId].backups];
      backups.sort((a, b) => a.timestamp - b.timestamp);
      
      // Удаляем старые копии, оставляя только MAX_BACKUPS_PER_USER
      const backupsToRemove = backups.slice(0, backups.length - MAX_BACKUPS_PER_USER);
      
      // Удаляем данные из localStorage
      backupsToRemove.forEach(backup => {
        if (backup.key) {
          localStorage.removeItem(backup.key);
        }
      });
      
      // Обновляем метаданные
      metadata[userId].backups = backups.slice(backups.length - MAX_BACKUPS_PER_USER);
      localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
      
      console.log(`[gameDataService] Удалено ${backupsToRemove.length} старых резервных копий для пользователя ${userId}`);
    }
    
    return true;
  } catch (error) {
    console.error('[gameDataService] Ошибка при управлении резервными копиями:', error);
    return false;
  }
}

/**
 * Проверяет размер данных перед сохранением в localStorage
 * @param data Данные для сохранения
 * @returns boolean - true если размер допустимый
 */
function checkBackupSize(data: any): boolean {
  try {
    const jsonString = JSON.stringify(data);
    const size = new Blob([jsonString]).size;
    
    if (size > MAX_BACKUP_SIZE) {
      console.warn(`[gameDataService] Слишком большой размер резервной копии: ${(size / 1024).toFixed(2)} КБ (макс ${MAX_BACKUP_SIZE / 1024} КБ)`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[gameDataService] Ошибка при проверке размера резервной копии:', error);
    return false;
  }
}

/**
 * Создает резервную копию состояния игры в localStorage с обработкой ошибок
 * @param userId ID пользователя
 * @param state Состояние для сохранения
 * @param version Версия сохранения
 * @returns Успешность операции
 */
export function createBackup(userId: string, state: GameState, version: number = 1): boolean {
  if (!userId || !state) return false;
  
  try {
    // Проверяем доступность localStorage
    if (typeof window === 'undefined' || !window.localStorage) {
      console.warn('[GameDataService] localStorage недоступен для создания резервной копии');
      return false;
    }
    
    // Проверяем оставшееся место в localStorage
    let remainingSpace;
    try {
      // Проверка оставшегося места в localStorage
      let testKey = '_storage_test_' + Date.now();
      localStorage.setItem(testKey, '0');
      let i = 0;
      try {
        // Увеличиваем размер тестовых данных, пока не получим ошибку
        for (i = 0; i < 10000; i++) {
          localStorage.setItem(testKey, '0'.repeat(i * 1024)); // Добавляем по 1KB за раз
        }
      } catch (e) {
        // Место в localStorage закончилось
      }
      localStorage.removeItem(testKey);
      remainingSpace = i * 1024;
    } catch (e) {
      // В случае ошибки при проверке места
      remainingSpace = 0;
    }
    
    // Проверяем, достаточно ли места
    const stateJson = JSON.stringify({
      state,
      version,
      timestamp: Date.now()
    });
    
    if (stateJson.length > remainingSpace) {
      console.warn(`[GameDataService] Недостаточно места в localStorage: нужно ${stateJson.length}, доступно ${remainingSpace}`);
      
      // Если места недостаточно, очищаем старые данные
      try {
        // Находим и удаляем старые резервные копии
        const keysToDelete: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('backup_')) {
            keysToDelete.push(key);
          }
        }
        
        // Сортируем ключи по времени создания (старые первыми)
        keysToDelete.sort((a, b) => {
          const timeA = parseInt(a.split('_')[2] || '0', 10);
          const timeB = parseInt(b.split('_')[2] || '0', 10);
          return timeA - timeB;
        });
        
        // Удаляем старые резервные копии до тех пор, пока не освободится достаточно места
        while (keysToDelete.length > 0 && stateJson.length > remainingSpace) {
          const keyToDelete = keysToDelete.shift();
          if (keyToDelete) {
            const oldItem = localStorage.getItem(keyToDelete) || '';
            remainingSpace += oldItem.length;
            localStorage.removeItem(keyToDelete);
            console.log(`[GameDataService] Удалена старая резервная копия: ${keyToDelete}`);
          }
        }
      } catch (cleanupError) {
        console.error('[GameDataService] Ошибка при очистке localStorage:', cleanupError);
      }
    }
    
    // Создаем резервную копию с обновленной версией
    const backupKey = `backup_${userId}_${Date.now()}`;
    
    // Используем try-catch для обнаружения ошибок квоты
    try {
      localStorage.setItem(backupKey, stateJson);
      
      // Ограничиваем количество резервных копий
      const MAX_BACKUPS = 3;
      
      const backupKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`backup_${userId}_`)) {
          backupKeys.push(key);
        }
      }
      
      // Если количество резервных копий превышает лимит, удаляем самые старые
      if (backupKeys.length > MAX_BACKUPS) {
        backupKeys.sort((a, b) => {
          const timeA = parseInt(a.split('_')[2] || '0', 10);
          const timeB = parseInt(b.split('_')[2] || '0', 10);
          return timeA - timeB;
        });
        
        // Удаляем старые копии
        for (let i = 0; i < backupKeys.length - MAX_BACKUPS; i++) {
          localStorage.removeItem(backupKeys[i]);
          console.log(`[GameDataService] Удалена устаревшая резервная копия: ${backupKeys[i]}`);
        }
      }
      
      console.log(`[GameDataService] Создана резервная копия данных: ${backupKey}`);
      return true;
    } catch (storageError) {
      console.error('[GameDataService] Ошибка при сохранении в localStorage:', storageError);
      
      // В случае ошибки квоты используем сокращенные данные
      try {
        // Создаем минимальную версию состояния с только критичными данными
        const minimalState = {
          _userId: state._userId,
          _saveVersion: state._saveVersion,
          inventory: state.inventory,
          _lastSaved: state._lastSaved || new Date().toISOString(),
          _timestamp: Date.now()
        };
        
        const minimalJson = JSON.stringify({
          state: minimalState,
          version,
          timestamp: Date.now()
        });
        
        localStorage.setItem(backupKey, minimalJson);
        console.log(`[GameDataService] Создана минимальная резервная копия данных: ${backupKey}`);
        return true;
      } catch (minimalError) {
        console.error('[GameDataService] Ошибка при создании минимальной резервной копии:', minimalError);
        return false;
      }
    }
  } catch (error) {
    console.error('[GameDataService] Критическая ошибка при работе с localStorage:', error);
    return false;
  }
}

/**
 * Получает последнюю резервную копию состояния игры из localStorage
 * @param userId ID пользователя
 * @returns {gameState: GameState, version: number} | null Состояние игры или null если копия не найдена
 */
export function getLatestBackup(userId: string): {gameState: GameState, version: number} | null {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  
  try {
    // Получаем метаданные о резервных копиях
    const metadataJson = localStorage.getItem(BACKUP_METADATA_KEY);
    if (!metadataJson) {
      return null;
    }
    
    const metadata = JSON.parse(metadataJson);
    if (!metadata[userId] || !metadata[userId].backups || metadata[userId].backups.length === 0) {
      return null;
    }
    
    // Сортируем по времени (от новых к старым)
    const backups = [...metadata[userId].backups];
    backups.sort((a, b) => b.timestamp - a.timestamp);
    
    // Получаем ключ последней резервной копии
    const latestBackup = backups[0];
    if (!latestBackup || !latestBackup.key) {
      return null;
    }
    
    // Получаем данные резервной копии
    const backupJson = localStorage.getItem(latestBackup.key);
    if (!backupJson) {
      return null;
    }
    
    const backup: BackupData = JSON.parse(backupJson);
    if (!backup || !backup.gameState) {
      return null;
    }
    
    console.log(`[gameDataService] Загружена последняя резервная копия от ${new Date(latestBackup.timestamp).toLocaleString()} для пользователя ${userId}`);
    return {
      gameState: validateGameState(backup.gameState),
      version: backup.version || 1
    };
  } catch (error) {
    console.error('[gameDataService] Ошибка при загрузке последней резервной копии:', error);
    return null;
  }
}

// Создаем карту последних сохранений для предотвращения дублирования
const lastSaveMap = new Map<string, {timestamp: number, version: number, inProgress: boolean}>();

/**
 * Сохраняет состояние игры с проверкой целостности данных
 * @param userId ID пользователя
 * @param state Состояние игры
 * @returns Promise<SaveResponse> Результат сохранения
 */
export async function saveGameStateWithIntegrity(userId: string, state: GameState): Promise<SaveResponse> {
  try {
    // Проверка наличия userId
    if (!userId) {
      console.error('[gameDataService] Отсутствует userId при сохранении');
      return {
        success: false,
        error: 'Отсутствует userId'
      };
    }
    
    // Проверка наличия состояния игры
    if (!state) {
      console.error('[gameDataService] Отсутствует состояние игры при сохранении');
      return {
        success: false,
        error: 'Отсутствует состояние игры'
      };
    }
    
    // Проверка соответствия userId в состоянии игры, если оно там есть
    if ((state as ExtendedGameState)._userId && (state as ExtendedGameState)._userId !== userId) {
      console.error('[gameDataService] Несоответствие userId в состоянии игры', {
        requestUserId: userId,
        stateUserId: (state as ExtendedGameState)._userId
      });
      return {
        success: false,
        error: 'Несоответствие userId в состоянии игры'
      };
    }
    
    // Очищаем состояние от проблемных данных
    const cleanedState = sanitizeGameState(state);
    
    // Проверяем целостность базовой структуры состояния
    if (!isValidGameState(cleanedState)) {
      console.error('[gameDataService] Некорректная структура состояния игры');
      
      // Пытаемся восстановить структуру
      const validatedState = validateGameState(cleanedState);
      
      // Проверяем еще раз после восстановления
      if (!isValidGameState(validatedState)) {
        return {
          success: false,
          error: 'Невозможно восстановить структуру состояния игры'
        };
      }
      
      // Используем восстановленное состояние
      cleanedState._wasRepaired = true;
      Object.assign(cleanedState, validatedState);
    }
    
    // Проверяем и исправляем версию сохранения
    if (!(cleanedState as ExtendedGameState)._saveVersion) {
      (cleanedState as ExtendedGameState)._saveVersion = 1;
    }
    
    // Устанавливаем метку времени последнего изменения
    (cleanedState as ExtendedGameState)._lastModified = Date.now();
    (cleanedState as ExtendedGameState)._savedAt = new Date().toISOString();
    
    // Если данные имеют подпись, проверяем ее
    if ((cleanedState as ExtendedGameState)._dataSignature) {
      const isValid = verifyDataSignature(userId, cleanedState as ExtendedGameState, (cleanedState as ExtendedGameState)._dataSignature as string);
      if (!isValid) {
        console.error('[gameDataService] Нарушение целостности данных (неверная подпись)');
        
        // Удаляем неверную подпись
        delete (cleanedState as ExtendedGameState)._dataSignature;
      }
    }
    
    // Проверяем, не выполняется ли уже сохранение для этого userId
    const now = Date.now();
    const currentSaveVersion = (cleanedState as ExtendedGameState)._saveVersion || 1;
    
    const lastSaveInfo = lastSaveMap.get(userId);
    if (lastSaveInfo) {
      // Если сохранение в процессе, возвращаем успех чтобы избежать дублирования
      if (lastSaveInfo.inProgress) {
        console.log(`[gameDataService] Сохранение уже выполняется для ${userId}, пропускаем дублирующий запрос`);
        return {
          success: true,
          version: lastSaveInfo.version
        };
      }
      
      // Проверяем по времени и версии
      // Увеличен интервал с 500мс до 2000мс (2 секунды) для предотвращения частых сохранений
      if (now - lastSaveInfo.timestamp < 2000 && lastSaveInfo.version === currentSaveVersion) {
        console.log(`[gameDataService] Дублирующий запрос на сохранение для ${userId}, пропускаем (${now - lastSaveInfo.timestamp}мс)`);
        return {
          success: true,
          version: lastSaveInfo.version
        };
      }
    }
    
    // Отмечаем, что сохранение началось
    lastSaveMap.set(userId, {
      timestamp: now,
      version: currentSaveVersion,
      inProgress: true
    });
    
    try {
      // Создаем резервную копию перед отправкой на сервер
      const backupCreated = createBackup(userId, cleanedState, currentSaveVersion);
      if (!backupCreated) {
        console.warn('[gameDataService] Не удалось создать резервную копию перед сохранением');
      }
      
      // Устанавливаем userId в состоянии
      (cleanedState as ExtendedGameState)._userId = userId;
      
      // Подписываем данные перед отправкой
      const stateWithSignature = signGameState(userId, cleanedState as ExtendedGameState);
      
      // Вызываем API для сохранения
      const apiResult = await saveGameStateViaAPI(stateWithSignature, false);
      
      // Обновляем статус сохранения - завершено успешно
      const resultVersion = apiResult.progress?.version || currentSaveVersion;
      lastSaveMap.set(userId, {
        timestamp: Date.now(), // Обновляем timestamp после завершения запроса
        version: resultVersion,
        inProgress: false
      });
      
      return {
        success: true,
        version: resultVersion
      };
    } catch (error) {
      console.error('[gameDataService] Ошибка при сохранении состояния:', error);
      
      // Обновляем статус сохранения - завершено с ошибкой
      lastSaveMap.set(userId, {
        timestamp: now,
        version: currentSaveVersion,
        inProgress: false
      });
      
      // Создаем резервную копию локально при ошибке API
      const backupCreated = saveGameStateBackup(userId, cleanedState as ExtendedGameState);
      if (backupCreated) {
        console.log('[gameDataService] Создана локальная резервная копия из-за ошибки API');
      } else {
        console.error('[gameDataService] Не удалось создать локальную резервную копию при ошибке API');
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка'
      };
    }
  } catch (error) {
    console.error('[gameDataService] Критическая ошибка при сохранении:', error);
    // Пытаемся сохранить критические данные локально
    try {
      if (state && userId) {
        const simplifiedState: Partial<ExtendedGameState> = {
          inventory: state.inventory,
          upgrades: state.upgrades,
          container: state.container,
          _userId: userId,
          _saveVersion: (state as ExtendedGameState)._saveVersion || 1,
          _savedAt: new Date().toISOString(),
          _isCriticalBackup: true,
          user: undefined // Для соответствия типу, хотя поле необязательное
        };
        saveGameStateBackup(userId, simplifiedState as ExtendedGameState);
        console.log('[gameDataService] Создана упрощенная резервная копия при критической ошибке');
      }
    } catch (backupError) {
      console.error('[gameDataService] Ошибка при создании упрощенной резервной копии:', backupError);
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Критическая ошибка'
    };
  }
}

/**
 * Загружает состояние игры с проверкой целостности данных
 * @param userId ID пользователя
 * @returns Promise<LoadResponse> Результат загрузки
 */
export async function loadGameStateWithIntegrity(userId: string): Promise<LoadResponse> {
  try {
    // Проверка наличия userId
    if (!userId) {
      console.error('[gameDataService] Отсутствует userId при загрузке');
      return {
        success: false,
        error: 'Отсутствует userId'
      };
    }
    
    // Пытаемся получить последнюю резервную копию
    const backupData = getLatestBackup(userId);
    
    // Получаем токен из localStorage или иного хранилища
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
    console.log(`[gameDataService] Токен ${token ? 'найден' : 'не найден'} при загрузке для ${userId}`);
    
    try {
      // Используем константы для API путей
      const response = await fetch(`${API_ROUTES.LOAD}?userId=${userId}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[gameDataService] HTTP ошибка при загрузке! Статус: ${response.status}, Ответ: ${errorText}`);
        
        // В случае 401 ошибки (Неавторизован), попробуем обновить токен
        if (response.status === 401 && typeof window !== 'undefined') {
          console.log('[gameDataService] Ошибка авторизации при загрузке, возможно истек токен');
          // Отправляем событие для обновления токена
          const authEvent = new CustomEvent('auth-token-expired');
          window.dispatchEvent(authEvent);
        }
        
        // Если есть резервная копия, используем её
        if (backupData && backupData.gameState) {
          console.log('[gameDataService] Используем локальную резервную копию из-за HTTP ошибки');
          return {
            success: true,
            data: backupData.gameState,
            version: backupData.version
          };
        }
        
        throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success === false) {
        console.error('[gameDataService] Ошибка в ответе API при загрузке:', result.error || 'Неизвестная ошибка при загрузке');
        
        // Если есть резервная копия, используем её
        if (backupData && backupData.gameState) {
          console.log('[gameDataService] Используем локальную резервную копию из-за ошибки API');
          return {
            success: true,
            data: backupData.gameState,
            version: backupData.version
          };
        }
        
        throw new Error(result.error || 'Неизвестная ошибка при загрузке');
      }

      // Получаем данные из разных возможных структур ответа
      const gameState = result.data?.gameState || result.gameState || result.data;
      
      if (!gameState) {
        console.error('[gameDataService] В ответе нет данных состояния игры');
        
        // Если есть резервная копия, используем её
        if (backupData && backupData.gameState) {
          console.log('[gameDataService] Используем локальную резервную копию из-за отсутствия данных в ответе');
          return {
            success: true,
            data: backupData.gameState,
            version: backupData.version
          };
        }
        
        return {
          success: false,
          error: 'В ответе нет данных состояния игры'
        };
      }
      
      console.log(`[gameDataService] Успешно загружено состояние для ${userId}`);
      
      // Валидируем полученные данные
      const validatedState = validateGameState(gameState);
      
      // Убеждаемся, что userId установлен правильно
      validatedState._userId = userId;
      
      return {
        success: true,
        data: validatedState,
        version: result.data?.metadata?.version || result.metadata?.version || result.version || 1
      };
    } catch (networkError) {
      console.error('[gameDataService] Сетевая ошибка при загрузке:', networkError);
      
      // Если есть резервная копия и произошла сетевая ошибка, используем её
      if (backupData && backupData.gameState) {
        console.log('[gameDataService] Используем локальную резервную копию из-за сетевой ошибки');
        return {
          success: true,
          data: backupData.gameState,
          version: backupData.version
        };
      }
      
      return {
        success: false,
        error: networkError instanceof Error ? networkError.message : 'Сетевая ошибка при загрузке'
      };
    }
  } catch (error) {
    console.error('[gameDataService] Ошибка при загрузке состояния:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    };
  }
} 