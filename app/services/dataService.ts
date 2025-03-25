import type { GameState, ExtendedGameState } from "../types/gameTypes";
import { saveQueue, CompressedGameState, isCompressedGameState } from "../utils/saveQueue";

// Типы для кэша
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
  integrity: boolean;
}

// Константы для кэширования
const CACHE_TTL = 5 * 60 * 1000; // 5 минут
const SAVE_DEBOUNCE_TIME = 10 * 1000; // 10 секунд
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 секунда
const MAX_CACHE_SIZE = 50; // Увеличено с 10 до 50
const MAX_PENDING_SAVES = 20;
const INTEGRITY_CHECK_FIELDS = ['inventory'] as const;

// Кэш для данных игры
const gameStateCache = new Map<string, CacheEntry<ExtendedGameState>>();

// Отслеживание последних сохранений для предотвращения частых запросов
const lastSaveTimestamps = new Map<string, number>();

// Отслеживание версий для предотвращения конфликтов
const stateVersions = new Map<string, number>();

// Очередь сохранений для пакетной обработки
const pendingSaves = new Map<string, ExtendedGameState>();

// Таймер для пакетной обработки
let batchSaveTimer: NodeJS.Timeout | null = null;

// Хранилище резервных копий в памяти
const backupStore = new Map<string, {
  data: ExtendedGameState;
  timestamp: number;
}>();

/**
 * Сохраняет резервную копию состояния в памяти приложения
 */
function saveBackup(userId: string, gameState: ExtendedGameState, error?: unknown): void {
  try {
    if (gameState && userId) {
      backupStore.set(userId, {
        data: gameState,
        timestamp: Date.now()
      });
      
      // Ограничиваем размер хранилища резервных копий
      if (backupStore.size > 50) {
        const oldestKey = Array.from(backupStore.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
        backupStore.delete(oldestKey);
      }
    }
  } catch (backupError) {
    // Ошибка создания резервной копии
  }
}

/**
 * Получает резервную копию из памяти приложения
 */
function getBackup(userId: string): ExtendedGameState | null {
  try {
    const backup = backupStore.get(userId);
    if (backup && backup.data) {
      return backup.data;
    }
    return null;
  } catch (error) {
    // Ошибка получения резервной копии
    return null;
  }
}

/**
 * Проверяет целостность данных
 */
function checkDataIntegrity(data: ExtendedGameState): boolean {
  if (!data) return false;
  
  // Проверяем наличие критически важных полей
  for (const field of INTEGRITY_CHECK_FIELDS) {
    if (!data[field]) {
      return false;
    }
  }
  
  // Проверка инвентаря
  if (data.inventory) {
    if (typeof data.inventory.snot !== 'number' || 
        typeof data.inventory.snotCoins !== 'number' ||
        typeof data.inventory.containerCapacity !== 'number') {
      return false;
    }
  }
  
  return true;
}

/**
 * Ограничивает размер кэша
 */
function limitCacheSize(): void {
  if (gameStateCache.size <= MAX_CACHE_SIZE) return;
  
  // Сортируем записи по времени последнего обновления
  const entries = Array.from(gameStateCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);
  
  // Удаляем самые старые записи
  const entriesToRemove = entries.slice(0, gameStateCache.size - MAX_CACHE_SIZE);
  for (const [key] of entriesToRemove) {
    gameStateCache.delete(key);
  }
}

/**
 * Восстанавливает данные из кэша
 */
function restoreFromCache(userId: string, gameState: ExtendedGameState): ExtendedGameState {
  const cachedEntry = gameStateCache.get(userId);
  if (cachedEntry && cachedEntry.integrity) {
    // Создаем новый объект с данными из кэша для критических полей
    return {
      ...gameState,
      inventory: gameState.inventory || cachedEntry.data.inventory
    };
  }
  return gameState;
}

/**
 * Сохраняет состояние игры с оптимизацией
 */
export async function saveGameState(userId: string, gameState: ExtendedGameState): Promise<void> {
  try {
    if (!userId || !gameState) {
      throw new Error('Invalid arguments for saveGameState');
    }
    
    // Проверяем целостность данных перед сохранением
    const isDataValid = checkDataIntegrity(gameState);
    if (!isDataValid) {
      // Пытаемся восстановить данные из кэша
      gameState = restoreFromCache(userId, gameState);
    }
    
    // Обновляем версию состояния
    const currentVersion = stateVersions.get(userId) || 0;
    const newVersion = currentVersion + 1;
    stateVersions.set(userId, newVersion);
    
    // Подготавливаем состояние для сохранения
    const stateToSave = { 
      ...gameState,
      _saveVersion: newVersion,
      _lastSaved: new Date().toISOString()
    };
    
    // Обновляем кэш немедленно
    gameStateCache.set(userId, {
      data: stateToSave,
      timestamp: Date.now(),
      version: newVersion,
      integrity: checkDataIntegrity(stateToSave)
    });
    
    // Ограничиваем размер кэша
    limitCacheSize();
    
    // Проверяем, не слишком ли часто сохраняем
    const now = Date.now();
    const lastSave = lastSaveTimestamps.get(userId) || 0;
    
    // Если прошло меньше времени, чем SAVE_DEBOUNCE_TIME, добавляем в очередь
    if (now - lastSave < SAVE_DEBOUNCE_TIME) {
      // Если очередь слишком большая, удаляем старые записи
      if (pendingSaves.size >= MAX_PENDING_SAVES) {
        await processBatchSaves();
      }
      
      pendingSaves.set(userId, stateToSave);
      
      // Запускаем таймер для пакетного сохранения, если еще не запущен
      if (!batchSaveTimer) {
        batchSaveTimer = setTimeout(() => processBatchSaves(), SAVE_DEBOUNCE_TIME);
      }
      return;
    }
    
    // Обновляем временную метку последнего сохранения
    lastSaveTimestamps.set(userId, now);
    
    // Добавляем в очередь сохранений
    saveQueue.enqueue(async () => {
      await saveToPostgres(userId, stateToSave);
    });
    
  } catch (error) {
    // Ошибка сохранения состояния
    saveBackup(userId, gameState, error);
    throw error;
  }
}

/**
 * Сохраняет состояние в PostgreSQL с повторными попытками
 */
async function saveToPostgres(userId: string, gameState: ExtendedGameState, attempt = 1): Promise<void> {
  try {
    // Проверка целостности данных перед отправкой
    if (!checkDataIntegrity(gameState)) {
      // Пытаемся восстановить данные из кэша перед отправкой
      gameState = restoreFromCache(userId, gameState);
      
      // Если после восстановления данные все еще некорректны, создаем резервную копию и выходим
      if (!checkDataIntegrity(gameState)) {
        saveBackup(userId, gameState, new Error('Data integrity check failed'));
        throw new Error('Data integrity check failed, unable to save to server');
      }
    }
    
    // Удаляем ненужные данные перед отправкой
    const cleanedState = { ...gameState };
    
    // Удаляем предыдущие состояния, если они есть
    if ((cleanedState as any)._previousState) {
      delete (cleanedState as any)._previousState;
    }
    
    // Удаляем другие большие или временные данные
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
    
    fieldsToClean.forEach(field => {
      if ((cleanedState as any)[field]) {
        delete (cleanedState as any)[field];
      }
    });
    
    // Проверяем размер данных перед отправкой
    const serializedState = JSON.stringify(cleanedState);
    const dataSize = serializedState.length;
    
    let stateToSend: ExtendedGameState | CompressedGameState = cleanedState;
    let isCompressed = false;
    
    // Если данные слишком большие, сжимаем их
    if (dataSize > 1000000) { // ~1MB
      console.warn(`Данные слишком большие (${dataSize} байт), выполняем сжатие`);
      
      // Удаляем неважные данные
      const nonCriticalFields = [
        'settings.debug', 
        'soundSettings.audioBuffers', 
        'history', 
        'logs', 
        'analytics'
      ];
      
      for (const field of nonCriticalFields) {
        const parts = field.split('.');
        let current: any = stateToSend;
        
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current || typeof current !== 'object') break;
          current = current[parts[i]];
        }
        
        if (current && typeof current === 'object') {
          const lastPart = parts[parts.length - 1];
          if (current[lastPart] !== undefined) {
            delete current[lastPart];
          }
        }
      }
      
      // Если после очистки данные все еще большие, применяем сжатие
      const cleanedJson = JSON.stringify(stateToSend);
      if (cleanedJson.length > 800000) { // Все еще больше 800KB
        try {
          const LZString = await import('lz-string');
          const compressed = LZString.compressToUTF16(cleanedJson);
          
          stateToSend = {
            _isCompressed: true,
            _compressedData: compressed,
            _originalSize: cleanedJson.length,
            _compressedSize: compressed.length,
            _compression: 'lz-string-utf16',
            _compressedAt: new Date().toISOString(),
            _integrity: {
              userId,
              saveVersion: gameState._saveVersion,
              snot: gameState.inventory?.snot,
              snotCoins: gameState.inventory?.snotCoins
            }
          };
          
          isCompressed = true;
          console.log(`Данные сжаты: ${cleanedJson.length} -> ${compressed.length} байт`);
        } catch (compressionError) {
          console.error('Ошибка при сжатии данных:', compressionError);
          // Продолжаем с несжатыми данными, но предупреждаем об этом
        }
      }
    }
    
    // Добавляем метку времени отправки
    if (!isCompressed) {
      (stateToSend as ExtendedGameState)._clientSentAt = new Date().toISOString();
    }
    
    // Отправляем данные на сервер с таймаутом
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-секундный таймаут
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/game/save-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ 
          userId, 
          gameState: stateToSend,
          clientTimestamp: new Date().toISOString(),
          isCompressed
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save game progress');
      }
      
      const result = await response.json();
      
      // Обновляем версию на основе ответа сервера
      if (result.version) {
        stateVersions.set(userId, result.version);
      }
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
    
  } catch (error) {
    // Проверяем на ошибки сети
    const isNetworkError = error instanceof Error && 
      (error.message.includes('network') || 
       error.message.includes('abort') || 
       error.message.includes('timeout'));
    
    // Повторяем попытку, если не превышено максимальное количество
    if (attempt < MAX_RETRY_ATTEMPTS && (isNetworkError || error instanceof TypeError)) {
      const retryDelay = RETRY_DELAY * Math.pow(2, attempt - 1); // Экспоненциальная задержка
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return saveToPostgres(userId, gameState, attempt + 1);
    }
    
    // Создаем резервную копию при окончательной неудаче
    saveBackup(userId, gameState, error);
    throw error;
  }
}

/**
 * Обрабатывает пакетные сохранения
 */
async function processBatchSaves(): Promise<void> {
  try {
    // Копируем текущие ожидающие сохранения и очищаем очередь
    const savesToProcess = new Map(pendingSaves);
    pendingSaves.clear();
    
    // Сбрасываем таймер
    if (batchSaveTimer) {
      clearTimeout(batchSaveTimer);
      batchSaveTimer = null;
    }

    // Создаем локальную резервную копию всех сохранений для восстановления
    const backupSaves = new Map(savesToProcess);
    
    // Массив для отслеживания сбойных сохранений
    const failedSaves: [string, ExtendedGameState][] = [];
    
    // Обрабатываем каждое сохранение
    const savePromises: Promise<void>[] = [];
    
    savesToProcess.forEach((state, userId) => {
      // Создаем резервную копию перед сохранением
      saveBackup(userId, state);
      
      // Обновляем временную метку последнего сохранения
      lastSaveTimestamps.set(userId, Date.now());
      
      // Добавляем операцию в массив промисов с обработкой ошибок
      const savePromise = saveQueue.enqueue(async () => {
        try {
          await saveToPostgres(userId, state);
        } catch (saveError) {
          console.error(`Ошибка сохранения для пользователя ${userId}:`, saveError);
          // Сохраняем информацию о неудачном сохранении
          failedSaves.push([userId, state]);
        }
      }) as Promise<void>;
      
      savePromises.push(savePromise);
    });
    
    // Ждем завершения всех операций сохранения
    await Promise.allSettled(savePromises);
    
    // Если есть неудачные сохранения, добавляем их обратно в очередь pendingSaves
    // с короткой задержкой перед следующей попыткой
    if (failedSaves.length > 0) {
      console.warn(`${failedSaves.length} сохранений не удалось выполнить, планируем повторную попытку`);
      
      // Добавляем неудачные сохранения обратно в очередь
      for (const [userId, state] of failedSaves) {
        pendingSaves.set(userId, state);
      }
      
      // Запускаем таймер для повторной попытки с меньшим интервалом
      batchSaveTimer = setTimeout(
        () => processBatchSaves(), 
        Math.min(SAVE_DEBOUNCE_TIME / 2, 5000)
      );
    }
  } catch (error) {
    console.error('Ошибка в процессе пакетной обработки сохранений:', error);
    
    // Пробуем индивидуально сохранить каждое состояние при ошибке пакетной обработки
    for (const [userId, state] of Array.from(pendingSaves.entries())) {
      try {
        await saveToPostgres(userId, state);
      } catch (individualError) {
        console.error(`Индивидуальная ошибка сохранения для пользователя ${userId}:`, individualError);
        // Создаем резервную копию при ошибке
        saveBackup(userId, state, individualError);
      }
    }
    
    // Очищаем очередь после индивидуальных попыток
    pendingSaves.clear();
  }
}

/**
 * Загружает состояние игры с оптимизацией
 */
export async function loadGameState(userId: string): Promise<ExtendedGameState | null> {
  try {
    if (!userId) {
      throw new Error('Invalid userId for loadGameState');
    }
    
    // Проверяем кэш сначала
    const cachedEntry = gameStateCache.get(userId);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL) && cachedEntry.integrity) {
      return cachedEntry.data;
    }
    
    // Переменная для хранения резервной копии
    let backupData: ExtendedGameState | null = null;
    
    // Проверяем, есть ли резервная копия
    backupData = getBackup(userId);
    
    // Настраиваем таймаут для запроса
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-секундный таймаут
    
    try {
      // Получаем токен авторизации, если он есть
      const token = localStorage.getItem('auth_token');
      
      // Делаем запрос к API
      const response = await fetch(`/api/game/load-progress?userId=${userId}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // Если ответ не 200 OK, используем резервную копию
        if (backupData) {
          return backupData;
        }
        
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load game progress');
      }
      
      // Получаем данные из ответа
      const data = await response.json();
      
      if (!data.progress) {
        // Если данных нет, используем резервную копию
        if (backupData) {
          return backupData;
        }
        
        return null;
      }
      
      // Создаем правильно типизированную переменную
      let typedData: ExtendedGameState;
      
      // Проверяем, сжаты ли данные
      if (isCompressedGameState(data)) {
        // Распаковываем сжатые данные
        try {
          const LZString = await import('lz-string');
          const decompressed = LZString.decompressFromUTF16(data._compressedData);
          
          if (!decompressed) {
            throw new Error('Decompression failed, got empty result');
          }
          
          typedData = JSON.parse(decompressed) as ExtendedGameState;
        } catch (decompressError) {
          console.error('Ошибка при распаковке сжатых данных:', decompressError);
          // В случае ошибки распаковки, возвращаем резервную копию
          if (backupData) {
            return backupData;
          }
          throw decompressError;
        }
      } else {
        typedData = data as ExtendedGameState;
      }
      
      // Проверяем целостность загруженных данных
      const isDataValid = checkDataIntegrity(typedData);
      
      if (!isDataValid && backupData) {
        // Если данные с сервера некорректны, но есть резервная копия - используем ее
        return backupData;
      }
      
      // Обновляем кэш
      gameStateCache.set(userId, {
        data: typedData,
        timestamp: Date.now(),
        version: typedData._saveVersion || 0,
        integrity: isDataValid
      });
      
      // Ограничиваем размер кэша
      limitCacheSize();
      
      // Обновляем версию
      stateVersions.set(userId, typedData._saveVersion || 0);
      
      return typedData;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      // Ошибка получения данных с сервера
      
      // В случае ошибки, возвращаем резервную копию, если она есть
      if (backupData) {
        return backupData;
      }
      
      throw fetchError;
    }
  } catch (error) {
    // Ошибка загрузки состояния игры
    
    // В случае критической ошибки, пробуем вернуть данные из кэша, даже если они просрочены
    const cachedEntry = gameStateCache.get(userId);
    if (cachedEntry) {
      return cachedEntry.data;
    }
    
    return null;
  }
}

/**
 * Принудительно сохраняет состояние игры
 */
export async function forceSaveGameState(userId: string, gameState: ExtendedGameState): Promise<void> {
  try {
    if (!userId || !gameState) {
      throw new Error('Invalid arguments for forceSaveGameState');
    }
    
    // Проверяем целостность данных перед сохранением
    const isDataValid = checkDataIntegrity(gameState);
    if (!isDataValid) {
      gameState = restoreFromCache(userId, gameState);
    }
    
    // Обновляем версию состояния
    const currentVersion = stateVersions.get(userId) || 0;
    const newVersion = currentVersion + 1;
    stateVersions.set(userId, newVersion);
    
    // Подготавливаем состояние для сохранения
    const stateToSave = { 
      ...gameState,
      _saveVersion: newVersion,
      _lastSaved: new Date().toISOString(),
      _isForceSave: true,
      _isBeforeUnloadSave: true
    };
    
    // Создаем резервную копию в памяти при принудительном сохранении
    saveBackup(userId, stateToSave);
    
    // Обновляем кэш
    gameStateCache.set(userId, {
      data: stateToSave,
      timestamp: Date.now(),
      version: newVersion,
      integrity: checkDataIntegrity(stateToSave)
    });
    
    // Обновляем временную метку последнего сохранения
    lastSaveTimestamps.set(userId, Date.now());
    
    // Очищаем очередь ожидающих сохранений
    if (pendingSaves.has(userId)) {
      pendingSaves.delete(userId);
    }
    
    // Сохраняем напрямую, без очереди и с таймаутом
    const savePromise = saveToPostgres(userId, stateToSave);
    
    // Устанавливаем максимальное время ожидания для принудительного сохранения
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Force save timeout'));
      }, 3000); // Уменьшаем таймаут до 3 секунд для быстрого выхода
    });
    
    // Используем Promise.race для ограничения времени ожидания
    try {
      await Promise.race([savePromise, timeoutPromise]);
    } catch (raceError) {
      // Полагаемся на резервную копию в памяти
    }
  } catch (error) {
    // Ошибка принудительного сохранения
    
    // Создаем резервную копию в памяти
    saveBackup(userId, gameState, error);
    throw error;
  }
}

/**
 * Очищает кэш для пользователя
 */
export function invalidateCache(userId: string): void {
  gameStateCache.delete(userId);
}

/**
 * Проверяет, есть ли ожидающие изменения для данного пользователя
 */
export function hasPendingChanges(userId: string): boolean {
  return pendingSaves.has(userId);
}

/**
 * Сохраняет все ожидающие изменения немедленно
 */
export async function saveAllPendingChanges(): Promise<void> {
  if (pendingSaves.size > 0) {
    await processBatchSaves();
  }
}

/**
 * Настраивает обработчик для события beforeunload
 */
export function setupBeforeUnloadHandler(userId: string, getLatestState: () => ExtendedGameState): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    try {
      const state = getLatestState();
      
      // Устанавливаем флаг для сохранения перед закрытием
      state._isBeforeUnloadSave = true;
      
      // Сохраняем в память как резервную копию
      saveBackup(userId, state);
      
      // Используем Beacon API для надежной отправки перед закрытием
      if (navigator.sendBeacon) {
        // Получаем JWT-токен
        const token = localStorage.getItem('auth_token');
        
        // Подготавливаем данные для отправки
        const payload = {
          userId,
          gameState: state,
          clientTimestamp: new Date().toISOString(),
          token: token // Добавляем токен напрямую в данные, так как нельзя установить заголовки в sendBeacon
        };
        
        const data = JSON.stringify(payload);
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon('/api/game/save-progress', blob);
      }
      
      // Отменяем стандартное сообщение подтверждения выхода
      event.preventDefault();
      // Chrome требует возврата значения
      event.returnValue = '';
    } catch (error) {
      // Ошибка в обработчике beforeUnload
    }
  };
  
  // Добавляем обработчик
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  // Возвращаем функцию для удаления обработчика
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}

/**
 * Очищает все кэши и состояния
 */
export function clearAllCaches(): void {
  gameStateCache.clear();
  lastSaveTimestamps.clear();
  stateVersions.clear();
  pendingSaves.clear();
  backupStore.clear();
  
  if (batchSaveTimer) {
    clearTimeout(batchSaveTimer);
    batchSaveTimer = null;
  }
}

/**
 * Валидирует данные игры
 */
export function validateGameData(data: any): boolean {
  // Базовая проверка
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  // Проверка обязательных полей
  if (!data.inventory || !data.user || !data.container) {
    return false;
  }
  
  // Проверка типов данных
  if (typeof data.inventory.snot !== 'number' || 
      typeof data.inventory.snotCoins !== 'number') {
    return false;
  }
  
  // Проверка пользовательских данных
  if (!data.user.id) {
    return false;
  }
  
  return true;
}

/**
 * Отменяет все активные запросы
 */
export function cancelAllRequests(): void {
  // Можно реализовать с помощью AbortController, если необходимо
  console.warn('cancelAllRequests: Not implemented');
} 