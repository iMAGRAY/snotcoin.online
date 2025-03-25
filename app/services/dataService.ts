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
function saveBackup(fid: number, gameState: ExtendedGameState, error?: unknown): void {
  try {
    if (gameState && fid) {
      backupStore.set(fid, {
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
function getBackup(fid: number): ExtendedGameState | null {
  try {
    const backup = backupStore.get(fid);
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
function restoreFromCache(fid: number, gameState: ExtendedGameState): ExtendedGameState {
  const cachedEntry = gameStateCache.get(fid);
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
export async function saveGameState(fid: number, gameState: ExtendedGameState): Promise<void> {
  try {
    if (!fid || !gameState) {
      throw new Error('Invalid arguments for saveGameState');
    }
    
    // Проверяем целостность данных перед сохранением
    const isDataValid = checkDataIntegrity(gameState);
    if (!isDataValid) {
      // Пытаемся восстановить данные из кэша
      gameState = restoreFromCache(fid, gameState);
    }
    
    // Обновляем версию состояния
    const currentVersion = stateVersions.get(fid) || 0;
    const newVersion = currentVersion + 1;
    stateVersions.set(fid, newVersion);
    
    // Подготавливаем состояние для сохранения
    const stateToSave = { 
      ...gameState,
      _saveVersion: newVersion,
      _lastSaved: new Date().toISOString()
    };
    
    // Обновляем кэш немедленно
    gameStateCache.set(fid, {
      data: stateToSave,
      timestamp: Date.now(),
      version: newVersion,
      integrity: checkDataIntegrity(stateToSave)
    });
    
    // Ограничиваем размер кэша
    limitCacheSize();
    
    // Проверяем, не слишком ли часто сохраняем
    const now = Date.now();
    const lastSave = lastSaveTimestamps.get(fid) || 0;
    
    // Если прошло меньше времени, чем SAVE_DEBOUNCE_TIME, добавляем в очередь
    if (now - lastSave < SAVE_DEBOUNCE_TIME) {
      // Если очередь слишком большая, удаляем старые записи
      if (pendingSaves.size >= MAX_PENDING_SAVES) {
        await processBatchSaves();
      }
      
      pendingSaves.set(fid, stateToSave);
      
      // Запускаем таймер для пакетного сохранения, если еще не запущен
      if (!batchSaveTimer) {
        batchSaveTimer = setTimeout(() => processBatchSaves(), SAVE_DEBOUNCE_TIME);
      }
      return;
    }
    
    // Обновляем временную метку последнего сохранения
    lastSaveTimestamps.set(fid, now);
    
    // Добавляем в очередь сохранений
    saveQueue.enqueue(async () => {
      await saveToPostgres(fid, stateToSave);
    });
    
    // Создаем резервную копию для восстановления в случае ошибки
    saveBackup(fid, stateToSave);
  } catch (error) {
    // Создаем резервную копию в случае ошибки
    saveBackup(fid, gameState, error);
    throw error;
  }
}

/**
 * Сохраняет состояние игры в PostgreSQL
 */
async function saveToPostgres(fid: number, gameState: ExtendedGameState, attempt = 1): Promise<void> {
  try {
    // Максимальное количество попыток
    if (attempt > MAX_RETRY_ATTEMPTS) {
      throw new Error(`Failed to save game state after ${MAX_RETRY_ATTEMPTS} attempts`);
    }
    
    // API для сохранения
    const response = await fetch('/api/game/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fid,
        gameState,
        clientTimestamp: Date.now(),
        saveVersion: gameState._saveVersion || 0
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error saving game state: ${response.status} ${errorText}`);
    }
    
    // Получаем и проверяем ответ
    const result = await response.json();
    if (!result.success) {
      throw new Error(`Error saving game state: ${result.message}`);
    }
    
    // Успешное сохранение - обновляем версию состояния
    if (result.saveVersion) {
      stateVersions.set(fid, result.saveVersion);
    }
  } catch (error) {
    // Если это не последняя попытка, пробуем еще раз с задержкой
    if (attempt < MAX_RETRY_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      return saveToPostgres(fid, gameState, attempt + 1);
    } else {
      // Добавляем в резервное хранилище
      saveBackup(fid, gameState, error);
      throw error;
    }
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
    
    savesToProcess.forEach((state, fid) => {
      // Создаем резервную копию перед сохранением
      saveBackup(fid, state);
      
      // Обновляем временную метку последнего сохранения
      lastSaveTimestamps.set(fid, Date.now());
      
      // Добавляем операцию в массив промисов с обработкой ошибок
      const savePromise = saveQueue.enqueue(async () => {
        try {
          await saveToPostgres(fid, state);
        } catch (saveError) {
          console.error(`Ошибка сохранения для пользователя ${fid}:`, saveError);
          // Сохраняем информацию о неудачном сохранении
          failedSaves.push([fid, state]);
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
      for (const [fid, state] of failedSaves) {
        pendingSaves.set(fid, state);
      }
      
      // Запускаем таймер для повторной попытки с меньшим интервалом
      batchSaveTimer = setTimeout(
        () => processBatchSaves(), 
        Math.floor(SAVE_DEBOUNCE_TIME / 2)
      );
    }
  } catch (batchError) {
    console.error('Критическая ошибка при пакетном сохранении:', batchError);
    
    // В случае критической ошибки, пробуем сохранить каждое состояние индивидуально
    try {
      const failedBatchIds = Array.from(pendingSaves.keys());
      console.warn(`Попытка индивидуального сохранения для ${failedBatchIds.length} пользователей`);
      
      // Очищаем текущую очередь
      pendingSaves.clear();
      
      // Запускаем индивидуальное сохранение для каждого пользователя с увеличенным таймаутом
      for (const [fid, state] of Array.from(pendingSaves.entries())) {
        saveQueue.enqueue(async () => {
          try {
            await saveToPostgres(fid, state);
          } catch (individualError) {
            console.error(`Индивидуальная ошибка сохранения для пользователя ${fid}:`, individualError);
            // Создаем резервную копию при окончательной неудаче
            saveBackup(fid, state, individualError);
          }
        });
      }
    } catch (finalError) {
      console.error('Критическая ошибка при индивидуальном сохранении:', finalError);
    }
  }
}

/**
 * Загружает состояние игры по идентификатору пользователя
 */
export async function loadGameState(fid: number): Promise<ExtendedGameState | null> {
  try {
    if (!fid) return null;
    
    // Проверяем наличие в кэше
    const cachedEntry = gameStateCache.get(fid);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL) {
      return cachedEntry.data;
    }
    
    // Если есть ожидающие сохранения, используем их данные
    if (pendingSaves.has(fid)) {
      const pendingState = pendingSaves.get(fid);
      if (pendingState) {
        return pendingState;
      }
    }
    
    // Если есть резервная копия, используем её как запасной вариант
    const backup = getBackup(fid);
    
    try {
      // Запрашиваем данные с сервера
      const response = await fetch(`/api/game/load?fid=${fid}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        // Если у нас есть резервная копия, используем её
        if (backup) {
          console.warn('Используем резервную копию из-за ошибки загрузки:', response.status);
          return backup;
        }
        throw new Error(`Error loading game state: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success || !result.gameState) {
        // Если нет данных, но есть резервная копия, используем её
        if (backup) {
          return backup;
        }
        
        return null;
      }
      
      // Получаем данные игры
      let gameState = result.gameState;
      
      // Проверяем целостность данных
      const isDataValid = checkDataIntegrity(gameState);
      
      // Если данные повреждены, но есть резервная копия, 
      // используем её для восстановления критических полей
      if (!isDataValid && backup) {
        gameState = {
          ...gameState,
          inventory: backup.inventory,
        };
      }
      
      // Обновляем кэш
      gameStateCache.set(fid, {
        data: gameState,
        timestamp: Date.now(),
        version: gameState._saveVersion || 0,
        integrity: checkDataIntegrity(gameState)
      });
      
      // Обновляем версию состояния
      if (gameState._saveVersion) {
        stateVersions.set(fid, gameState._saveVersion);
      }
      
      return gameState;
    } catch (error) {
      // Если есть резервная копия, возвращаем её при ошибке
      if (backup) {
        return backup;
      }
      throw error;
    }
  } catch (error) {
    console.error('Ошибка при загрузке состояния игры:', error);
    return null;
  }
}

/**
 * Принудительное сохранение состояния игры
 * Обходит проверку времени и сразу отправляет данные
 */
export async function forceSaveGameState(fid: number, gameState: ExtendedGameState): Promise<void> {
  if (!fid || !gameState) {
    throw new Error('Invalid arguments for forceSaveGameState');
  }
  
  try {
    // Обновляем версию состояния
    const currentVersion = stateVersions.get(fid) || 0;
    const newVersion = currentVersion + 1;
    stateVersions.set(fid, newVersion);
    
    // Подготавливаем состояние с дополнительной информацией
    const stateToSave = { 
      ...gameState,
      _saveVersion: newVersion,
      _lastSaved: new Date().toISOString(),
      _isForce: true // Маркер принудительного сохранения
    };
    
    // Обновляем кэш немедленно
    gameStateCache.set(fid, {
      data: stateToSave,
      timestamp: Date.now(),
      version: newVersion,
      integrity: checkDataIntegrity(stateToSave)
    });
    
    // Обновляем временную метку последнего сохранения и отправляем
    lastSaveTimestamps.set(fid, Date.now());
    
    // Выполняем сохранение напрямую, без очереди
    const savePromise = saveToPostgres(fid, stateToSave);
    
    // Создаем резервную копию на случай ошибки
    saveBackup(fid, stateToSave);
    
    await savePromise;
  } catch (error) {
    // Создаем резервную копию в случае ошибки
    saveBackup(fid, gameState, error);
    throw error;
  }
}

/**
 * Инвалидирует кэш для указанного пользователя
 */
export function invalidateCache(fid: number): void {
  gameStateCache.delete(fid);
  pendingSaves.delete(fid);
}

/**
 * Проверяет, есть ли ожидающие изменения для пользователя
 */
export function hasPendingChanges(fid: number): boolean {
  return pendingSaves.has(fid);
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
 * Настраивает обработчик события beforeunload для сохранения данных перед закрытием
 */
export function setupBeforeUnloadHandler(fid: number, getLatestState: () => ExtendedGameState): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    try {
      // Получаем последнее состояние игры
      const state = getLatestState();
      
      if (!state) return;
      
      // Сохраняем данные при закрытии
      saveBackup(fid, state);
      
      // Добавляем в очередь сохранений с высоким приоритетом
      const stateToSave = { 
        ...state,
        _isBeforeUnloadSave: true,
        _saveVersion: (state._saveVersion || 0) + 1,
        _lastSaved: new Date().toISOString()
      };
      
      // Устанавливаем признак синхронного сохранения
      try {
        // Используем localStorage для хранения информации о несохраненных данных
        localStorage.setItem(`game_pending_save_${fid}`, JSON.stringify({
          timestamp: Date.now(),
          saveVersion: stateToSave._saveVersion
        }));
      } catch (storageError) {
        // Игнорируем ошибки localStorage
      }
      
      // Добавляем в очередь сохранения с высоким приоритетом
      pendingSaves.set(fid, stateToSave);
      
      // Принудительно выполняем все ожидающие сохранения
      processBatchSaves();
      
      // Показываем подтверждение в некоторых браузерах
      event.preventDefault();
      event.returnValue = '';
      return 'Игра имеет несохраненный прогресс. Вы уверены, что хотите выйти?';
    } catch (error) {
      // Игнорируем ошибки в обработчике beforeunload
    }
  };
  
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