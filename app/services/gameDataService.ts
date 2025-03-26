import type { GameState } from '../types/gameTypes';

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
 * Создает резервную копию состояния игры в localStorage
 * @param userId ID пользователя
 * @param state Состояние игры
 * @param version Версия сохранения
 * @returns boolean Успешно ли создана резервная копия
 */
export function createBackup(userId: string, state: GameState, version: number = 1): boolean {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  
  try {
    // Проверяем размер данных перед сохранением
    const backupData: BackupData = {
      gameState: state,
      timestamp: Date.now(),
      version
    };
    
    if (!checkBackupSize(backupData)) {
      console.error('[gameDataService] Резервная копия не создана из-за превышения размера');
      return false;
    }
    
    // Управляем резервными копиями (удаляем старые если нужно)
    manageBackups(userId);
    
    const timestamp = Date.now();
    const backupKey = `backup_gamestate_${userId}_${timestamp}`;
    
    // Сохраняем резервную копию
    localStorage.setItem(backupKey, JSON.stringify(backupData));
    
    // Обновляем метаданные
    let metadata: Record<string, BackupMetadata> = {};
    const metadataJson = localStorage.getItem(BACKUP_METADATA_KEY);
    
    if (metadataJson) {
      try {
        metadata = JSON.parse(metadataJson);
      } catch (e) {
        metadata = {};
      }
    }
    
    if (!metadata[userId]) {
      metadata[userId] = { backups: [] };
    }
    
    // Добавляем информацию о новой резервной копии
    metadata[userId].backups.push({
      key: backupKey,
      timestamp,
      version
    });
    
    // Сохраняем обновленные метаданные
    localStorage.setItem(BACKUP_METADATA_KEY, JSON.stringify(metadata));
    
    console.log(`[gameDataService] Создана резервная копия состояния игры для пользователя ${userId}`);
    return true;
  } catch (error) {
    console.error('[gameDataService] Ошибка при создании резервной копии:', error);
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
    
    // Проверка целостности состояния игры
    const inventoryCheck = validateObjectFields(
      state.inventory,
      ['snot', 'snotCoins', 'containerCapacity', 'fillingSpeed'],
      { snot: 'number', snotCoins: 'number', containerCapacity: 'number', fillingSpeed: 'number' }
    );
    
    if (!inventoryCheck.isValid) {
      console.error('[gameDataService] Невалидные данные инвентаря:', 
        inventoryCheck.missingFields.length > 0 ? `Отсутствуют поля: ${inventoryCheck.missingFields.join(', ')}` : '',
        inventoryCheck.wrongTypeFields.length > 0 ? `Неверные типы: ${inventoryCheck.wrongTypeFields.join(', ')}` : ''
      );
      
      // Исправляем данные перед сохранением через validateGameState
      state = validateGameState(state);
    }
    
    // Проверяем правильность userId в состоянии
    if (state._userId && state._userId !== userId) {
      console.warn(`[gameDataService] Несоответствие userId: ${state._userId} в состоянии не совпадает с ${userId}`);
      // Исправляем userId в состоянии
      state._userId = userId;
    }
    
    // Получаем токен из localStorage или иного хранилища
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
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
          userId,
          gameState: state,
          version: state._saveVersion || 1,
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
        createBackup(userId, state, state._saveVersion || 1);
        console.log('[gameDataService] Создана резервная копия из-за HTTP ошибки');
        
        throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
      }

      const result = await response.json();
      console.log(`[gameDataService] Успешно сохранено состояние для ${userId}`, result);
      
      // Создаем периодическую резервную копию (каждые N успешных сохранений)
      if ((state._saveVersion || 0) % 5 === 0) { // Создаем резервную копию каждые 5 версий
        createBackup(userId, state, result.version || state._saveVersion || 1);
      }
      
      return {
        success: true,
        version: result.progress?.version || result.version || 1
      };
    } catch (networkError) {
      console.error('[gameDataService] Сетевая ошибка при сохранении:', networkError);
      
      // Если не удалось сохранить из-за проблем с сетью, создаем резервную копию
      createBackup(userId, state, state._saveVersion || 1);
      
      return {
        success: false,
        error: networkError instanceof Error ? networkError.message : 'Сетевая ошибка при сохранении'
      };
    }
  } catch (error) {
    console.error('[gameDataService] Ошибка при сохранении состояния:', error);
    
    // В случае любой другой ошибки также пытаемся создать резервную копию
    if (userId && state && typeof window !== 'undefined' && window.localStorage) {
      createBackup(userId, state, state._saveVersion || 1);
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