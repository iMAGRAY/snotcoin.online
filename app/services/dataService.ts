import { supabase } from "../utils/supabase";
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
const gameStateCache = new Map<number, CacheEntry<ExtendedGameState>>();

// Отслеживание последних сохранений для предотвращения частых запросов
const lastSaveTimestamps = new Map<number, number>();

// Отслеживание версий для предотвращения конфликтов
const stateVersions = new Map<number, number>();

// Очередь сохранений для пакетной обработки
const pendingSaves = new Map<number, ExtendedGameState>();

// Таймер для пакетной обработки
let batchSaveTimer: NodeJS.Timeout | null = null;

// Хранилище резервных копий в памяти
const backupStore = new Map<number, {
  data: ExtendedGameState;
  timestamp: number;
}>();

/**
 * Сохраняет резервную копию состояния в памяти приложения
 */
function saveBackup(telegramId: number, gameState: ExtendedGameState, error?: unknown): void {
  try {
    if (gameState && telegramId) {
      backupStore.set(telegramId, {
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
function getBackup(telegramId: number): ExtendedGameState | null {
  try {
    const backup = backupStore.get(telegramId);
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
function restoreFromCache(telegramId: number, gameState: ExtendedGameState): ExtendedGameState {
  const cachedEntry = gameStateCache.get(telegramId);
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
export async function saveGameState(telegramId: number, gameState: ExtendedGameState): Promise<void> {
  try {
    if (!telegramId || !gameState) {
      throw new Error('Invalid arguments for saveGameState');
    }
    
    // Проверяем целостность данных перед сохранением
    const isDataValid = checkDataIntegrity(gameState);
    if (!isDataValid) {
      // Пытаемся восстановить данные из кэша
      gameState = restoreFromCache(telegramId, gameState);
    }
    
    // Обновляем версию состояния
    const currentVersion = stateVersions.get(telegramId) || 0;
    const newVersion = currentVersion + 1;
    stateVersions.set(telegramId, newVersion);
    
    // Подготавливаем состояние для сохранения
    const stateToSave = { 
      ...gameState,
      _saveVersion: newVersion,
      _lastSaved: new Date().toISOString()
    };
    
    // Обновляем кэш немедленно
    gameStateCache.set(telegramId, {
      data: stateToSave,
      timestamp: Date.now(),
      version: newVersion,
      integrity: checkDataIntegrity(stateToSave)
    });
    
    // Ограничиваем размер кэша
    limitCacheSize();
    
    // Проверяем, не слишком ли часто сохраняем
    const now = Date.now();
    const lastSave = lastSaveTimestamps.get(telegramId) || 0;
    
    // Если прошло меньше времени, чем SAVE_DEBOUNCE_TIME, добавляем в очередь
    if (now - lastSave < SAVE_DEBOUNCE_TIME) {
      // Если очередь слишком большая, удаляем старые записи
      if (pendingSaves.size >= MAX_PENDING_SAVES) {
        await processBatchSaves();
      }
      
      pendingSaves.set(telegramId, stateToSave);
      
      // Запускаем таймер для пакетного сохранения, если еще не запущен
      if (!batchSaveTimer) {
        batchSaveTimer = setTimeout(() => processBatchSaves(), SAVE_DEBOUNCE_TIME);
      }
      return;
    }
    
    // Обновляем временную метку последнего сохранения
    lastSaveTimestamps.set(telegramId, now);
    
    // Добавляем в очередь сохранений
    saveQueue.enqueue(async () => {
      await saveToSupabase(telegramId, stateToSave);
    });
    
  } catch (error) {
    // Ошибка сохранения состояния
    saveBackup(telegramId, gameState, error);
    throw error;
  }
}

/**
 * Сохраняет состояние в Supabase с повторными попытками
 */
async function saveToSupabase(telegramId: number, gameState: ExtendedGameState, attempt = 1): Promise<void> {
  try {
    // Проверка целостности данных перед отправкой
    if (!checkDataIntegrity(gameState)) {
      // Пытаемся восстановить данные из кэша перед отправкой
      gameState = restoreFromCache(telegramId, gameState);
      
      // Если после восстановления данные все еще некорректны, создаем резервную копию и выходим
      if (!checkDataIntegrity(gameState)) {
        saveBackup(telegramId, gameState, new Error('Data integrity check failed'));
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
              telegramId,
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
      const response = await fetch('/api/game/save-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          telegramId, 
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
        stateVersions.set(telegramId, result.version);
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
      return saveToSupabase(telegramId, gameState, attempt + 1);
    }
    
    // Создаем резервную копию при окончательной неудаче
    saveBackup(telegramId, gameState, error);
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
    const failedSaves: [number, ExtendedGameState][] = [];
    
    // Обрабатываем каждое сохранение
    const savePromises: Promise<void>[] = [];
    
    savesToProcess.forEach((state, telegramId) => {
      // Создаем резервную копию перед сохранением
      saveBackup(telegramId, state);
      
      // Обновляем временную метку последнего сохранения
      lastSaveTimestamps.set(telegramId, Date.now());
      
      // Добавляем операцию в массив промисов с обработкой ошибок
      const savePromise = saveQueue.enqueue(async () => {
        try {
          await saveToSupabase(telegramId, state);
        } catch (saveError) {
          console.error(`Ошибка сохранения для пользователя ${telegramId}:`, saveError);
          // Сохраняем информацию о неудачном сохранении
          failedSaves.push([telegramId, state]);
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
      for (const [telegramId, state] of failedSaves) {
        pendingSaves.set(telegramId, state);
      }
      
      // Запускаем таймер для повторной попытки с меньшим интервалом
      batchSaveTimer = setTimeout(
        () => processBatchSaves(), 
        Math.floor(SAVE_DEBOUNCE_TIME / 2)
      );
    }
  } catch (error) {
    console.error('Критическая ошибка при пакетном сохранении:', error);
    
    // В случае полной ошибки обработки всего пакета пытаемся восстановить данные и 
    // выполнить сохранения поочередно через короткое время
    setTimeout(() => {
      try {
        pendingSaves.forEach((state, telegramId) => {
          // Гарантированно сохраняем резервную копию
          saveBackup(telegramId, state);
          
          // Добавляем в очередь сохранений с индивидуальной обработкой ошибок
          saveQueue.enqueue(async () => {
            try {
              await saveToSupabase(telegramId, state);
            } catch (individualError) {
              console.error(`Индивидуальная ошибка сохранения для пользователя ${telegramId}:`, individualError);
              // Сохраняем резервную копию и планируем индивидуальную повторную попытку
              saveBackup(telegramId, state, individualError);
              setTimeout(() => {
                pendingSaves.set(telegramId, state);
                if (!batchSaveTimer) {
                  batchSaveTimer = setTimeout(() => processBatchSaves(), SAVE_DEBOUNCE_TIME);
                }
              }, RETRY_DELAY);
            }
          });
        });
      } catch (recoveryError) {
        console.error('Критическая ошибка при попытке восстановления после сбоя:', recoveryError);
      }
    }, RETRY_DELAY);
  }
}

/**
 * Загружает состояние игры с кэшированием
 */
export async function loadGameState(telegramId: number): Promise<ExtendedGameState | null> {
  try {
    if (!telegramId) {
      return null;
    }
    
    // Проверяем кэш
    const cachedEntry = gameStateCache.get(telegramId);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL) {
      // Проверяем целостность кэшированных данных
      if (cachedEntry.integrity) {
        return cachedEntry.data;
      }
    }
    
    // Пробуем загрузить резервную копию из памяти, если загрузка с сервера не удалась
    let backupData: ExtendedGameState | null = null;
    try {
      backupData = getBackup(telegramId);
    } catch (backupError) {
      // Ошибка чтения резервной копии
    }
    
    // Загружаем данные с сервера
    // Устанавливаем таймаут для запроса
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-секундный таймаут
    
    try {
      const response = await fetch(`/api/game/load-progress?telegramId=${telegramId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // В случае 404 (пользователь не найден) возвращаем резервную копию или null
      if (response.status === 404) {
        return backupData;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load game progress');
      }
      
      const data = await response.json();
      
      // Проверяем, является ли полученный результат сжатым состоянием
      let typedData: ExtendedGameState;
      
      if (isCompressedGameState(data)) {
        try {
          // Распаковываем сжатые данные
          const { decompressGameState } = await import('../utils/saveQueue');
          const decompressedData = await decompressGameState(data);
          
          console.log('Данные успешно распакованы из сжатого формата');
          typedData = decompressedData as ExtendedGameState;
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
      gameStateCache.set(telegramId, {
        data: typedData,
        timestamp: Date.now(),
        version: typedData._saveVersion || 0,
        integrity: isDataValid
      });
      
      // Ограничиваем размер кэша
      limitCacheSize();
      
      // Обновляем версию
      stateVersions.set(telegramId, typedData._saveVersion || 0);
      
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
    const cachedEntry = gameStateCache.get(telegramId);
    if (cachedEntry) {
      return cachedEntry.data;
    }
    
    return null;
  }
}

/**
 * Принудительно сохраняет состояние игры
 */
export async function forceSaveGameState(telegramId: number, gameState: ExtendedGameState): Promise<void> {
  try {
    if (!telegramId || !gameState) {
      throw new Error('Invalid arguments for forceSaveGameState');
    }
    
    // Проверяем целостность данных перед сохранением
    const isDataValid = checkDataIntegrity(gameState);
    if (!isDataValid) {
      gameState = restoreFromCache(telegramId, gameState);
    }
    
    // Обновляем версию состояния
    const currentVersion = stateVersions.get(telegramId) || 0;
    const newVersion = currentVersion + 1;
    stateVersions.set(telegramId, newVersion);
    
    // Подготавливаем состояние для сохранения
    const stateToSave = { 
      ...gameState,
      _saveVersion: newVersion,
      _lastSaved: new Date().toISOString(),
      _isForceSave: true,
      _isBeforeUnloadSave: true
    };
    
    // Создаем резервную копию в памяти при принудительном сохранении
    saveBackup(telegramId, stateToSave);
    
    // Обновляем кэш
    gameStateCache.set(telegramId, {
      data: stateToSave,
      timestamp: Date.now(),
      version: newVersion,
      integrity: checkDataIntegrity(stateToSave)
    });
    
    // Обновляем временную метку последнего сохранения
    lastSaveTimestamps.set(telegramId, Date.now());
    
    // Очищаем очередь ожидающих сохранений
    if (pendingSaves.has(telegramId)) {
      pendingSaves.delete(telegramId);
    }
    
    // Сохраняем напрямую, без очереди и с таймаутом
    const savePromise = saveToSupabase(telegramId, stateToSave);
    
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
    saveBackup(telegramId, gameState, error);
    throw error;
  }
}

/**
 * Очищает кэш для пользователя
 */
export function invalidateCache(telegramId: number): void {
  gameStateCache.delete(telegramId);
}

/**
 * Проверяет, есть ли несохраненные изменения
 */
export function hasPendingChanges(telegramId: number): boolean {
  return pendingSaves.has(telegramId);
}

/**
 * Сохраняет все несохраненные изменения
 */
export async function saveAllPendingChanges(): Promise<void> {
  if (pendingSaves.size > 0) {
    await processBatchSaves();
  }
}

/**
 * Настраивает обработчики событий для сохранения при выходе
 */
export function setupBeforeUnloadHandler(telegramId: number, getLatestState: () => ExtendedGameState): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    try {
      const state = getLatestState();
      
      // Устанавливаем флаг для сохранения перед закрытием
      state._isBeforeUnloadSave = true;
      
      // Сохраняем в память как резервную копию
      saveBackup(telegramId, state);
      
      // Используем Beacon API для надежной отправки перед закрытием
      if (navigator.sendBeacon) {
        const data = JSON.stringify({
          telegramId,
          gameState: state,
          clientTimestamp: new Date().toISOString()
        });
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
 * Очищает все кэши и очереди
 */
export function clearAllCaches(): void {
  gameStateCache.clear();
  lastSaveTimestamps.clear();
  stateVersions.clear();
  pendingSaves.clear();
  
  if (batchSaveTimer) {
    clearTimeout(batchSaveTimer);
    batchSaveTimer = null;
  }
  
  saveQueue.clear();
}

// Удаляем проверку энергии при загрузке
export function validateGameData(data: any): boolean {
  if (!data || 
      !data.inventory || 
      data.inventory.snotCoins === undefined ||
      !data.container ||
      !data.upgrades ||
      !data.settings ||
      !data.soundSettings) {
    console.error("Невозможно загрузить данные игры: данные некорректны или отсутствуют");
    return false;
  }

  // Проверяем основные поля инвентаря
  const requiredFields = ['snot', 'snotCoins', 'containerSnot', 'containerCapacity'];
  for (const field of requiredFields) {
    if (typeof data.inventory[field] !== 'number' || isNaN(data.inventory[field])) {
      console.error(`Некорректное значение поля ${field} в инвентаре:`, data.inventory[field]);
      return false;
    }
  }

  // Удаляем проверку энергии
  
  return true;
}

/**
 * Отменяет все текущие запросы и очищает очереди
 */
export function cancelAllRequests(): void {
  try {
    // Очищаем все сохранения в очереди
    saveQueue.clear();
    
    // Очищаем ожидающие сохранения
    pendingSaves.clear();
    
    // Очищаем таймер пакетного сохранения
    if (batchSaveTimer) {
      clearTimeout(batchSaveTimer);
      batchSaveTimer = null;
    }
    
    // Сбрасываем временные метки для предотвращения троттлинга после выхода
    lastSaveTimestamps.clear();
    
    // Не очищаем кэш и резервные копии, так как они могут быть полезны
    // при повторном входе
  } catch (error) {
    console.error("Error cancelling requests:", error);
  }
} 