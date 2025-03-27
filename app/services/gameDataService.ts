import type { GameState } from '../types/gameTypes';

interface SaveResponse {
  success: boolean;
  error?: string;
  version?: number;
  message?: string;
  data?: any;
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

// Тип для безопасной работы с userId
type UserId = string;

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
 * Проверяет структуру объекта GameState и исправляет/устанавливает поля с некорректными значениями
 * @param state Состояние игры для проверки
 * @returns Проверенное и исправленное состояние игры
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
      state.inventory.fillingSpeed = Number(state.inventory.fillingSpeed || 1);
    }
    
    if (!state.container) {
      console.warn('[gameDataService] validateGameState: Отсутствует container, будет создан');
      state.container = {
        level: 1,
        capacity: 100,
        currentAmount: 0,
        fillRate: 1
      };
    }
    
    if (!state.upgrades) {
      console.warn('[gameDataService] validateGameState: Отсутствует upgrades, будет создан');
      state.upgrades = {
        containerLevel: 1,
        fillingSpeedLevel: 1,
        clickPower: { level: 1, value: 1 },
        passiveIncome: { level: 1, value: 0.1 },
        collectionEfficiencyLevel: 1
      };
    }
    
    return state as GameState;
  } catch (error) {
    console.error('[gameDataService] Ошибка при валидации состояния:', error);
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
 * Безопасная обертка над функцией createBackup, которая правильно обрабатывает undefined userId
 * @param userId ID пользователя (может быть undefined)
 * @param state Состояние для сохранения
 * @param version Версия сохранения
 * @returns Успешность операции
 */
export function safeCreateBackup(userId: string | undefined, state: GameState, version: number = 1): boolean {
  if (!userId) {
    console.warn('[GameDataService] Попытка создать резервную копию с undefined userId');
    return false;
  }
  
  // Теперь мы гарантированно передаем строку в createBackup
  return createBackup(userId, state, version);
}

/**
 * Создает резервную копию состояния игры в localStorage с обработкой ошибок
 * @param userId ID пользователя
 * @param state Состояние для сохранения
 * @param version Версия сохранения
 * @returns Успешность операции
 */
export function createBackup(userId: UserId, state: GameState, version: number = 1): boolean {
  // Проверяем, что userId является строкой и не пустой
  if (!userId || typeof userId !== 'string' || !state) return false;
  
  try {
    // Проверяем доступность localStorage
    if (typeof window === 'undefined' || !window.localStorage) {
      console.warn('[GameDataService] localStorage недоступен для создания резервной копии');
      return false;
    }
    
    // Расчет примерного размера localStorage
    const getLocalStorageSize = (): number => {
      let totalSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key) || '';
          totalSize += key.length + value.length;
        }
      }
      return totalSize * 2; // Примерный размер в байтах (2 байта на символ в UTF-16)
    };
    
    // Проверка процента заполнения localStorage
    const checkLocalStorageUsage = (): number => {
      try {
        const totalSize = getLocalStorageSize();
        // Средний размер квоты localStorage ~5MB
        const estimatedQuota = 5 * 1024 * 1024;
        const usagePercent = (totalSize / estimatedQuota) * 100;
        return usagePercent;
      } catch (error) {
        console.error('[GameDataService] Ошибка при проверке использования localStorage:', error);
        return 0;
      }
    };
    
    // Агрессивная очистка старых резервных копий, если хранилище заполнено более чем на 70%
    const usagePercent = checkLocalStorageUsage();
    if (usagePercent > 70) {
      console.warn(`[GameDataService] Высокое использование localStorage: ${usagePercent.toFixed(2)}%. Выполняется агрессивная очистка.`);
      try {
        // Собираем все ключи резервных копий
        const allBackupKeys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('backup_')) {
            allBackupKeys.push(key);
          }
        }
        
        // Оставляем только последние 2 копии для текущего пользователя, удаляем все остальные
        const currentUserBackups = allBackupKeys.filter(key => key.includes(userId));
        const otherBackups = allBackupKeys.filter(key => !key.includes(userId));
        
        // Сортируем по времени (самые новые в конце)
        currentUserBackups.sort((a, b) => {
          const timeA = parseInt(a.split('_').pop() || '0', 10);
          const timeB = parseInt(b.split('_').pop() || '0', 10);
          return timeA - timeB;
        });
        
        // Удаляем старые копии текущего пользователя, оставляя последние 2
        if (currentUserBackups.length > 2) {
          for (let i = 0; i < currentUserBackups.length - 2; i++) {
            localStorage.removeItem(currentUserBackups[i]);
            console.log(`[GameDataService] Удалена старая резервная копия: ${currentUserBackups[i]}`);
          }
        }
        
        // При критическом заполнении также удаляем копии других пользователей
        if (usagePercent > 85) {
          for (const key of otherBackups) {
            if (key && !key.endsWith('_latest')) {
              localStorage.removeItem(key);
              console.log(`[GameDataService] Удалена резервная копия другого пользователя: ${key}`);
            }
          }
        }
      } catch (cleanupError) {
        console.error('[GameDataService] Ошибка при агрессивной очистке резервных копий:', cleanupError);
      }
    } else {
      // Обычная очистка при нормальном заполнении хранилища
      try {
        // Очищаем все старые резервные копии, кроме последней
        const keysToCheck: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`backup_${userId}_`) && key !== `backup_${userId}_latest`) {
            keysToCheck.push(key);
          }
        }
        
        // Сортируем ключи по времени создания (старые первыми)
        keysToCheck.sort((a, b) => {
          const timeA = parseInt(a.split('_')[2] || '0', 10);
          const timeB = parseInt(b.split('_')[2] || '0', 10);
          return timeA - timeB;
        });
        
        // Оставляем только последнюю копию, удаляем все остальные
        if (keysToCheck.length > 1) {
          // Удаляем все, кроме самой новой
          for (let i = 0; i < keysToCheck.length - 1; i++) {
            localStorage.removeItem(keysToCheck[i]);
            console.log(`[GameDataService] Удалена старая резервная копия: ${keysToCheck[i]}`);
          }
        }
      } catch (cleanupError) {
        console.error('[GameDataService] Ошибка при очистке старых резервных копий:', cleanupError);
      }
    }
    
    // Очищаем данные перед сохранением
    const cleanState = { ...state };
    
    // Удаляем ненужные для сохранения поля
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
      '_particleSystem',
      '_animationSystem',
      '_eventEmitter',
      '_soundSystem',
      '_renderSystem',
      '_messageQueue',
      '_cache'
    ];
    
    fieldsToRemove.forEach(field => {
      if (field in cleanState) {
        delete (cleanState as any)[field];
      }
    });
    
    // Создаем резервную копию с обновленной версией
    const backupKey = `backup_${userId}_${Date.now()}`;
    
    // Создаем минимальную версию состояния при высоком заполнении хранилища
    let stateData;
    if (usagePercent > 85) {
      // Создаем сверхкомпактную версию с минимумом данных
      const minimalState = {
        _userId: state._userId || userId,
        _saveVersion: version,
        inventory: {
          snot: state.inventory?.snot || 0,
          snotCoins: state.inventory?.snotCoins || 0,
          containerCapacity: state.inventory?.containerCapacity || 100,
          fillingSpeed: state.inventory?.fillingSpeed || 1
        },
        _lastSaved: state._lastSaved || new Date().toISOString(),
        _timestamp: Date.now()
      };
      
      stateData = {
        state: minimalState,
        version,
        timestamp: Date.now()
      };
      
      console.log('[GameDataService] Создана минимальная версия сохранения из-за высокого заполнения хранилища');
    } else {
      // Пытаемся сжать JSON перед сохранением
      stateData = {
        state: cleanState,
        version,
        timestamp: Date.now()
      };
    }
    
    // Используем try-catch для обнаружения ошибок квоты
    try {
      const stateJson = JSON.stringify(stateData);
      localStorage.setItem(backupKey, stateJson);
      
      // Обновляем указатель на последнюю резервную копию
      localStorage.setItem(`backup_${userId}_latest`, backupKey);
      
      console.log(`[GameDataService] Создана резервная копия данных: ${backupKey}`);
      return true;
    } catch (storageError) {
      console.error('[GameDataService] Ошибка при сохранении в localStorage:', storageError);
      
      // В случае ошибки квоты используем сокращенные данные
      try {
        // Создаем супер минимальную версию состояния с только критичными данными
        const minimalState = {
          _userId: state._userId || userId,
          _saveVersion: state._saveVersion,
          inventory: {
            snot: state.inventory?.snot || 0,
            snotCoins: state.inventory?.snotCoins || 0,
            containerCapacity: state.inventory?.containerCapacity || 100,
            fillingSpeed: state.inventory?.fillingSpeed || 1
          },
          _lastSaved: state._lastSaved || new Date().toISOString(),
          _timestamp: Date.now()
        };
        
        const minimalJson = JSON.stringify({
          state: minimalState,
          version,
          timestamp: Date.now()
        });
        
        // Удаляем предыдущий ключ
        localStorage.removeItem(backupKey);
        
        // Очищаем еще больше старых данных
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('backup_')) {
            localStorage.removeItem(key);
          }
        }
        
        // Сохраняем минимальную версию
        const minimalBackupKey = `backup_${userId}_minimal_${Date.now()}`;
        localStorage.setItem(minimalBackupKey, minimalJson);
        localStorage.setItem(`backup_${userId}_latest`, minimalBackupKey);
        
        console.log(`[GameDataService] Создана минимальная резервная копия данных: ${minimalBackupKey}`);
        return true;
      } catch (minimalError) {
        console.error('[GameDataService] Ошибка при создании минимальной резервной копии:', minimalError);
        
        // Последняя попытка: удаляем все из localStorage и сохраняем только базовые данные
        try {
          // Очищаем весь localStorage
          localStorage.clear();
          
          // Сохраняем только самые базовые данные
          const basicState = {
            _userId: state._userId || userId,
            inventory: {
              snot: state.inventory?.snot || 0,
              snotCoins: state.inventory?.snotCoins || 0
            }
          };
          
          const basicKey = `backup_${userId}_basic_${Date.now()}`;
          localStorage.setItem(basicKey, JSON.stringify({ state: basicState }));
          localStorage.setItem(`backup_${userId}_latest`, basicKey);
          
          console.log(`[GameDataService] Создана базовая резервная копия после очистки хранилища: ${basicKey}`);
          return true;
        } catch (finalError) {
          console.error('[GameDataService] Не удалось создать резервную копию даже после очистки:', finalError);
          return false;
        }
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

/**
 * Сохраняет состояние игры с проверкой целостности
 * @param userId ID пользователя
 * @param gameState Состояние игры для сохранения
 * @returns Результат операции сохранения
 */
export async function saveGameStateWithIntegrity(userId: string, gameState: any): Promise<SaveResponse> {
  try {
    // Проверка наличия userId
    if (!userId) {
      console.error('[gameDataService] Отсутствует userId при сохранении');
      return {
        success: false,
        error: 'Отсутствует userId'
      };
    }
    
    // Проверка токена авторизации
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const tokenType = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token_type') : null;
    
    // Для локальных токенов используем локальное сохранение
    if (!token || tokenType === 'local' || (token && token.startsWith('local_'))) {
      console.log('[gameDataService] Используется локальный токен, сохраняем в localStorage');
      
      // Очищаем старые данные перед сохранением
      try {
        if (typeof localStorage !== 'undefined') {
          const keysToDelete: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('backup_') && !key.includes('_latest') && !key.includes(userId)) {
              keysToDelete.push(key);
            }
          }
          
          // Удаляем старые резервные копии
          keysToDelete.forEach(key => {
            localStorage.removeItem(key);
            console.log(`[gameDataService] Удалена старая резервная копия: ${key}`);
          });
        }
      } catch (cleanupError) {
        console.warn('[gameDataService] Ошибка при очистке localStorage:', cleanupError);
      }
      
      // Создаем очищенную версию состояния для резервной копии
      const cleanState = { ...gameState };
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
        '_particleSystem',
        '_animationSystem',
        '_eventEmitter',
        '_soundSystem',
        '_renderSystem',
        '_messageQueue',
        '_cache'
      ];
      
      fieldsToRemove.forEach(field => {
        if (field in cleanState) {
          delete (cleanState as any)[field];
        }
      });
      
      // Сохраняем в localStorage
      if (typeof localStorage !== 'undefined') {
        try {
          const backupKey = `backup_${userId}_${Date.now()}`;
          localStorage.setItem(backupKey, JSON.stringify({
            gameState: cleanState,
            timestamp: Date.now(),
            version: cleanState._saveVersion || 1
          }));
          
          // Обновляем ключ последней резервной копии
          localStorage.setItem(`backup_${userId}_latest`, backupKey);
          
          return {
            success: true,
            message: 'Игра сохранена локально',
            data: { backupKey }
          };
        } catch (localError) {
          console.error('[gameDataService] Ошибка при локальном сохранении:', localError);
          
          // Пытаемся создать резервную копию с минимальными данными
          try {
            // Создаем чистое сохранение без лишних данных
            const backupKey = `backup_${userId}_minimal_${Date.now()}`;
            
            // Минимальная версия состояния
            const minimalState = {
              _userId: gameState._userId,
              _saveVersion: gameState._saveVersion || 1,
              inventory: {
                snot: gameState.inventory?.snot || 0,
                snotCoins: gameState.inventory?.snotCoins || 0,
                containerCapacity: gameState.inventory?.containerCapacity || 100,
                fillingSpeed: gameState.inventory?.fillingSpeed || 1
              }
            };
            
            // Очищаем localStorage от старых данных
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('backup_') && !key.includes('_latest')) {
                localStorage.removeItem(key);
              }
            }
            
            // Сохраняем минимальную версию
            localStorage.setItem(backupKey, JSON.stringify({
              gameState: minimalState,
              timestamp: Date.now(),
              version: gameState._saveVersion || 1
            }));
            localStorage.setItem(`backup_${userId}_latest`, backupKey);
            
            console.log('[gameDataService] Создано минимальное сохранение из-за ошибки квоты');
            
            return {
              success: true,
              message: 'Создано минимальное сохранение игры',
              data: { backupKey }
            };
          } catch (minimalError) {
            console.error('[gameDataService] Ошибка при создании минимального сохранения:', minimalError);
            
            // Информируем о проблеме
            return {
              success: false,
              error: 'LOCAL_STORAGE_ERROR',
              message: 'Недостаточно места в локальном хранилище. Рекомендуется очистить кэш браузера.'
            };
          }
        }
      }
      
      return {
        success: false,
        error: 'NO_TOKEN',
        message: 'Токен авторизации отсутствует, локальное сохранение не выполнено'
      };
    }
    
    // Проверка наличия состояния игры
    if (!gameState) {
      console.error('[gameDataService] Отсутствует состояние игры при сохранении');
      return {
        success: false,
        error: 'Отсутствует состояние игры'
      };
    }
    
    // Проверка целостности состояния игры
    const inventoryCheck = validateObjectFields(
      gameState.inventory,
      ['snot', 'snotCoins', 'containerCapacity', 'fillingSpeed'],
      { snot: 'number', snotCoins: 'number', containerCapacity: 'number', fillingSpeed: 'number' }
    );
    
    if (!inventoryCheck.isValid) {
      console.error('[gameDataService] Невалидные данные инвентаря:', 
        inventoryCheck.missingFields.length > 0 ? `Отсутствуют поля: ${inventoryCheck.missingFields.join(', ')}` : '',
        inventoryCheck.wrongTypeFields.length > 0 ? `Неверные типы: ${inventoryCheck.wrongTypeFields.join(', ')}` : ''
      );
      
      // Исправляем данные перед сохранением через validateGameState
      gameState = validateGameState(gameState);
    }
    
    // Проверяем правильность userId в состоянии
    if (gameState._userId && gameState._userId !== userId) {
      console.warn(`[gameDataService] Несоответствие userId: ${gameState._userId} в состоянии не совпадает с ${userId}`);
      // Исправляем userId в состоянии
      gameState._userId = userId;
    }
    
    // Получаем токен из localStorage или иного хранилища
    console.log(`[gameDataService] Токен ${token ? 'найден' : 'не найден'} при сохранении для ${userId}`);
    
    try {
      // Используем константы для API путей
      const response = await fetch(API_ROUTES.SAVE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          userId: userId,
          gameState: {
            ...gameState,
            _provider: userId.startsWith('farcaster_') ? 'farcaster' : 
                      userId.startsWith('google_') ? 'google' : 
                      userId.startsWith('local_') ? 'local' : ''
          },
          version: gameState._saveVersion || 1,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[gameDataService] HTTP ошибка при сохранении! Статус: ${response.status}, Ответ: ${errorText}`);
        
        // В случае 401 ошибки (Неавторизован), попробуем обновить токен
        if (response.status === 401 && typeof window !== 'undefined') {
          console.log('[gameDataService] Ошибка авторизации при сохранении, возможно истек токен');
          // Отправляем событие для обновления токена
          const authEvent = new CustomEvent('auth-token-expired');
          window.dispatchEvent(authEvent);
        }
        
        // Создаем резервную копию при любой ошибке HTTP
        safeCreateBackup(userId, gameState, gameState._saveVersion || 1);
        console.log('[gameDataService] Создана резервная копия из-за HTTP ошибки');
        
        throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
      }

      const result = await response.json();
      console.log(`[gameDataService] Успешно сохранено состояние для ${userId}`, result);
      
      // Создаем периодическую резервную копию (каждые N успешных сохранений)
      if ((gameState._saveVersion || 0) % 5 === 0) { // Создаем резервную копию каждые 5 версий
        safeCreateBackup(userId, gameState, result.version || gameState._saveVersion || 1);
      }
      
      return {
        success: true,
        version: result.progress?.version || result.version || 1
      };
    } catch (networkError) {
      console.error('[gameDataService] Сетевая ошибка при сохранении:', networkError);
      
      // Если не удалось сохранить из-за проблем с сетью, создаем резервную копию
      safeCreateBackup(userId, gameState, gameState._saveVersion || 1);
      
      return {
        success: false,
        error: networkError instanceof Error ? networkError.message : 'Сетевая ошибка при сохранении'
      };
    }
  } catch (error) {
    console.error('[gameDataService] Ошибка при сохранении состояния:', error);
    
    // В случае любой другой ошибки также пытаемся создать резервную копию
    if (userId && gameState && typeof window !== 'undefined' && window.localStorage) {
      safeCreateBackup(userId, gameState, gameState._saveVersion || 1);
      console.log('[gameDataService] Создана резервная копия из-за ошибки при сохранении');
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
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
    if (token) {
      // Проверяем на валидность без раскрытия полной информации
      console.log(`[gameDataService] Токен формат: ${typeof token}, длина: ${token.length}, начинается с: ${token.substring(0, 10)}...`);
    } else {
      console.warn('[gameDataService] Внимание! Запрос будет выполнен без токена авторизации.');
    }
    
    try {
      // Используем константы для API путей
      const apiUrl = `${API_ROUTES.LOAD}?userId=${userId}`;
      console.log(`[gameDataService] Отправка запроса на: ${apiUrl}`);
      
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(apiUrl, {
        headers
      });

      console.log(`[gameDataService] Получен ответ с кодом: ${response.status}`);

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

/**
 * Очищает localStorage от ненужных данных при превышении указанного порога заполнения
 * @param threshold Порог заполнения в процентах (0-100)
 * @param userId ID текущего пользователя для сохранения его критичных данных
 * @returns true если очистка выполнена, false если очистка не требуется или произошла ошибка
 */
export function cleanupLocalStorage(threshold: number = 80, userId?: string | undefined): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  
  try {
    // Расчет примерного размера localStorage
    let totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        totalSize += key.length + value.length;
      }
    }
    
    // Примерный размер в байтах (2 байта на символ в UTF-16)
    const sizeInBytes = totalSize * 2;
    // Типичный размер квоты localStorage ~5MB
    const estimatedQuota = 5 * 1024 * 1024;
    const usagePercent = (sizeInBytes / estimatedQuota) * 100;
    
    console.log(`[gameDataService] Использование localStorage: ${(sizeInBytes / 1024 / 1024).toFixed(2)}MB (${usagePercent.toFixed(2)}%)`);
    
    // Если хранилище заполнено менее чем на указанный порог, очистка не требуется
    if (usagePercent < threshold) {
      return false;
    }
    
    console.warn(`[gameDataService] Критическое заполнение localStorage: ${usagePercent.toFixed(2)}%, выполняется агрессивная очистка`);
    
    // Список ключей, которые нужно сохранить в любом случае
    const criticalKeys = [
      'user_id',
      'userId',
      'game_id',
      'auth_token',
      'auth_token_type',
      'isAuthenticated',
      // Если есть userId, добавляем его последнюю резервную копию
      ...(userId ? [`backup_${userId}_latest`] : [])
    ];
    
    // Собираем все ключи для удаления
    const keysToRemove: string[] = [];
    const keysToKeep: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        // Проверяем, не является ли ключ критичным
        if (criticalKeys.includes(key)) {
          keysToKeep.push(key);
          continue;
        }
        
        // Сохраняем последнюю резервную копию текущего пользователя, если userId указан
        if (userId && key === `backup_${userId}_latest`) {
          keysToKeep.push(key);
          continue;
        }
        
        // Получаем фактическое значение последней резервной копии
        const latestBackupKey = userId ? localStorage.getItem(`backup_${userId}_latest`) : null;
        if (latestBackupKey && key === latestBackupKey) {
          keysToKeep.push(key);
          continue;
        }
        
        // Все остальные ключи помечаем на удаление
        keysToRemove.push(key);
      }
    }
    
    // Удаляем все помеченные ключи
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
    
    // Подсчитываем новый размер после очистки
    totalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        totalSize += key.length + value.length;
      }
    }
    
    const newSizeInBytes = totalSize * 2;
    const newUsagePercent = (newSizeInBytes / estimatedQuota) * 100;
    
    console.log(`[gameDataService] Очистка localStorage выполнена. Удалено ${keysToRemove.length} ключей. Новое использование: ${(newSizeInBytes / 1024 / 1024).toFixed(2)}MB (${newUsagePercent.toFixed(2)}%)`);
    console.log(`[gameDataService] Сохранено ${keysToKeep.length} критичных ключей: ${keysToKeep.join(', ')}`);
    
    return true;
  } catch (error) {
    console.error('[gameDataService] Ошибка при очистке localStorage:', error);
    return false;
  }
} 