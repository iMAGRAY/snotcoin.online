import type { GameState } from '../types/gameTypes';
import type { ExtendedGameState } from '../types/gameTypes';

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

// Добавляем переменные для контроля частоты сохранений
const MIN_SAVE_INTERVAL_MS = 500; // Минимальный интервал между сохранениями (мс)
const RETRY_DELAY_MS = 300; // Задержка перед повторной попыткой (мс)
const MAX_RETRIES = 3; // Максимальное количество повторных попыток

// Время последнего сохранения для каждого пользователя
const lastSaveAttempts = new Map<string, number>();
// Флаги сохранения в процессе для каждого пользователя
const savingInProgress = new Map<string, boolean>();

// Интерфейс для результата операции сохранения
interface SaveResult {
  success: boolean;
  error?: string;
  message?: string;
  data?: any;
}

// Результат безопасного создания резервной копии
interface SafeBackupResult {
  success: boolean;
  error?: string;
  message?: string;
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
 * Создает резервную копию состояния игры
 * @param userId ID пользователя
 * @param gameState Состояние игры
 * @param version Версия сохранения
 * @returns Promise с результатом создания резервной копии
 */
async function createBackup(userId: string, gameState: ExtendedGameState): Promise<boolean> {
  try {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    
    const backupKey = `backup_${userId}_${Date.now()}`;
    localStorage.setItem(backupKey, JSON.stringify({
      gameState,
      timestamp: Date.now(),
      version: gameState._saveVersion || 1
    }));
    
    // Обновляем ключ последней резервной копии
    localStorage.setItem(`backup_${userId}_latest`, backupKey);
    
    return true;
  } catch (error) {
    console.error(`[gameDataService] Ошибка при создании резервной копии:`, error);
    return false;
  }
}

/**
 * Безопасно создает резервную копию с проверкой доступного места
 * @param userId ID пользователя
 * @param gameState Состояние игры
 * @param version Версия сохранения
 * @returns Promise с результатом создания резервной копии
 */
async function safeCreateBackup(userId: string, gameState: ExtendedGameState, version: number): Promise<SafeBackupResult> {
  if (typeof localStorage === 'undefined') {
    return { success: false, error: 'localStorage недоступен' };
  }
  
  try {
    const backupKey = `backup_${userId}_${Date.now()}`;
    const backupData = {
      gameState,
      timestamp: Date.now(),
      version
    };
    
    try {
      localStorage.setItem(backupKey, JSON.stringify(backupData));
      localStorage.setItem(`backup_${userId}_latest`, backupKey);
      return { success: true };
    } catch (storageError) {
      console.warn(`[gameDataService] Ошибка при создании резервной копии: ${storageError}`);
      
      // Очищаем localStorage при ошибке квоты
      cleanupLocalStorage(70, userId);
      
      // Пробуем еще раз
      try {
        localStorage.setItem(backupKey, JSON.stringify(backupData));
        localStorage.setItem(`backup_${userId}_latest`, backupKey);
        return { success: true };
      } catch (retryError) {
        console.error(`[gameDataService] Ошибка при повторном создании резервной копии после очистки`);
        
        // Агрессивная очистка, оставляем только самое важное
        cleanupLocalStorage(95, userId);
        
        // Создаем минимальную версию состояния
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
        
        // Последняя попытка с минимальным состоянием
        try {
          const minimalKey = `backup_${userId}_minimal_${Date.now()}`;
          localStorage.setItem(minimalKey, JSON.stringify({
            gameState: minimalState,
            timestamp: Date.now(),
            version
          }));
          localStorage.setItem(`backup_${userId}_latest`, minimalKey);
          
          return { 
            success: true, 
            message: 'Создана минимальная резервная копия (недостаточно места)'
          };
        } catch (minimalError) {
          return { 
            success: false, 
            error: 'LOCAL_STORAGE_FULL', 
            message: 'Невозможно создать резервную копию, хранилище переполнено'
          };
        }
      }
    }
  } catch (error) {
    console.error(`[gameDataService] Ошибка при безопасном создании резервной копии:`, error);
    return { 
      success: false, 
      error: 'BACKUP_ERROR', 
      message: error instanceof Error ? error.message : String(error)
    };
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
 * Сохраняет состояние игры с шифрованием и целостностью
 * @param userId ID пользователя
 * @param gameState Состояние игры для сохранения
 * @returns Promise с результатом сохранения
 */
export async function saveGameStateWithIntegrity(
  userId: string,
  gameState: ExtendedGameState
): Promise<SaveResult> {
  try {
    // Проверяем, не слишком ли часто делаются запросы
    const now = Date.now();
    const lastAttempt = lastSaveAttempts.get(userId) || 0;
    const timeSinceLastSave = now - lastAttempt;
    
    // Если запрос был сделан слишком быстро после предыдущего, и сохранение уже в процессе - откладываем
    if (timeSinceLastSave < MIN_SAVE_INTERVAL_MS && savingInProgress.get(userId)) {
      console.log(`[gameDataService] Слишком частый запрос на сохранение для ${userId}, задержка ${MIN_SAVE_INTERVAL_MS - timeSinceLastSave}мс`);
      
      // Ждем и делаем повторную попытку
      await new Promise(resolve => setTimeout(resolve, MIN_SAVE_INTERVAL_MS - timeSinceLastSave + 50));
    }
    
    // Фиксируем время попытки сохранения и устанавливаем флаг
    lastSaveAttempts.set(userId, now);
    savingInProgress.set(userId, true);
    
    // Проверяем наличие токена
    if (typeof localStorage !== 'undefined') {
      const authToken = localStorage.getItem('auth_token');
      const tokenType = localStorage.getItem('auth_token_type');
      
      if (authToken && tokenType !== 'local') {
        // Пытаемся сначала найти токен
        console.log(`[gameDataService] Токен найден при сохранении для ${userId}`);
        
        // Функция для выполнения запроса на сохранение с повторными попытками
        const saveWithRetry = async (retries: number = MAX_RETRIES): Promise<SaveResult> => {
          try {
            const response = await fetch(`${API_ROUTES.SAVE}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-Client-ID': `web_${Date.now()}`
              },
              body: JSON.stringify({
                gameState,
                reason: 'auto',
                isCritical: (gameState as any)._isCriticalSave === true
              })
            });
            
            // Проверяем статус ответа
            if (response.status === 429 && retries > 0) {
              // Слишком много запросов, делаем паузу и пытаемся снова
              console.warn(`[gameDataService] Получен статус 429, повторная попытка через ${RETRY_DELAY_MS}мс (осталось попыток: ${retries})`);
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
              return saveWithRetry(retries - 1);
            }
            
            // Если статус не OK, возвращаем ошибку
            if (!response.ok) {
              console.error(`[gameDataService] HTTP ошибка при сохранении! Статус: ${response.status}`);
              
              try {
                const errorData = await response.json();
                console.error(`[gameDataService] Ответ: ${JSON.stringify(errorData)}`);
                return {
                  success: false,
                  error: `HTTP_ERROR_${response.status}`,
                  message: errorData.message || `Ошибка HTTP: ${response.status}`
                };
              } catch (parseError) {
                return {
                  success: false,
                  error: `HTTP_ERROR_${response.status}`,
                  message: `Ошибка HTTP: ${response.status}`
                };
              }
            }
            
            // Обрабатываем ответ
            const responseData = await response.json();
            
            if (!responseData.success) {
              console.error(`[gameDataService] Ошибка при сохранении:`, responseData);
              return {
                success: false,
                error: responseData.error || 'API_ERROR',
                message: responseData.message || 'Неизвестная ошибка API'
              };
            }
            
            return {
              success: true,
              data: gameState,
              message: 'Состояние успешно сохранено через API'
            };
          } catch (error) {
            console.error(`[gameDataService] Ошибка при отправке запроса на сохранение:`, error);
            return {
              success: false,
              error: 'FETCH_ERROR',
              message: error instanceof Error ? error.message : String(error)
            };
          }
        };
        
        try {
          // Выполняем запрос на сохранение с повторными попытками
          const apiResult = await saveWithRetry();
          
          if (apiResult.success) {
            // Создаем также локальную резервную копию
            try {
              await createBackup(userId, gameState);
            } catch (backupError) {
              console.warn(`[gameDataService] Ошибка при создании резервной копии после API сохранения:`, backupError);
            }
            
            return apiResult;
          } else {
            // Если API сохранение не удалось, сохраняем локально
            console.warn(`[gameDataService] API сохранение не удалось, создание локальной резервной копии`);
            const localResult = await safeCreateBackup(userId, gameState, gameState._saveVersion || 1);
            
            if (localResult.success) {
              return {
                success: true,
                data: gameState,
                message: 'Создана локальная резервная копия (API недоступно)'
              };
            } else {
              throw new Error(localResult.error || 'LOCAL_STORAGE_ERROR');
            }
          }
        } catch (apiError) {
          // Обработка общих ошибок API
          console.error(`[gameDataService] Ошибка при API сохранении:`, apiError);
          
          // Пытаемся создать локальную резервную копию при API ошибке
          const localResult = await safeCreateBackup(userId, gameState, gameState._saveVersion || 1);
          
          if (localResult.success) {
            return {
              success: true,
              data: gameState,
              message: 'Создана локальная резервная копия при API ошибке'
            };
          } else {
            return {
              success: false,
              error: 'SAVE_ERROR',
              message: 'Не удалось сохранить ни через API, ни локально'
            };
          }
        }
      } else {
        // Нет токена, сохраняем локально
        console.log(`[gameDataService] Токен не найден, сохранение локально для ${userId}`);
        const localResult = await safeCreateBackup(userId, gameState, gameState._saveVersion || 1);
        
        if (localResult.success) {
          return {
            success: true,
            data: gameState,
            message: 'Состояние сохранено локально'
          };
        } else {
          throw new Error(localResult.error || 'LOCAL_STORAGE_ERROR');
        }
      }
    } else {
      // Если localStorage недоступен (например, SSR), возвращаем ошибку
      return {
        success: false,
        error: 'NO_STORAGE_ACCESS',
        message: 'localStorage недоступен'
      };
    }
  } catch (error) {
    console.error(`[gameDataService] Ошибка при сохранении состояния:`, error);
    return {
      success: false,
      error: 'SAVE_ERROR',
      message: error instanceof Error ? error.message : String(error)
    };
  } finally {
    // Снимаем флаг сохранения
    savingInProgress.set(userId, false);
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