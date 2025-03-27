/**
 * Модульная версия dataService, использующая новые модульные сервисы
 */
import type { ExtendedGameState } from "../types/gameTypes";
import { isCompressedGameState } from "../types/saveTypes";

// Импорт сервисов хранения
import * as memoryStorage from './storage/memoryStorageService';
import * as localStorage from './storage/localStorageService';

// Импорт сервисов проверки данных
import * as dataIntegrity from './validation/dataIntegrityService';

// Импорт сервисов компрессии
import * as compression from './compression/compressionService';

// Импорт сервисов API
import * as api from './api/apiService';

// Импорт сервисов очереди
import * as saveQueue from './queue/saveQueueService';

// Импорт сервиса Redis
import { redisService } from './redis';

// Импорт сервиса аутентификации
import { authService } from './auth/authService';

// Импорт функции создания начального состояния игры
import { createInitialGameState } from '../constants/gameConstants';

// Флаги для управления поведением сервиса
let compressionEnabled = true;

/**
 * Загружает состояние игры
 * @param userId ID пользователя
 * @returns Состояние игры или null
 */
export async function loadGameState(userId: string): Promise<ExtendedGameState | null> {
  try {
    console.log(`[DataService] Загрузка игрового состояния для пользователя ${userId}`);
    
    // Проверяем минимальный интервал между загрузками
    const now = Date.now();
    const lastLoadTime = memoryStorage.getLastLoadTime(userId);
    const MIN_LOAD_INTERVAL = 2000; // 2 секунды между загрузками
    
    if (now - lastLoadTime < MIN_LOAD_INTERVAL) {
      console.log(`[DataService] Слишком частые загрузки для пользователя ${userId}, ожидаем ${MIN_LOAD_INTERVAL - (now - lastLoadTime)}мс`);
      
      // Возвращаем кэшированные данные, если они есть
      const cachedState = memoryStorage.getFromCache(userId);
      if (cachedState) {
        console.log(`[DataService] Возвращаем данные из кэша для ${userId}`);
        return cachedState;
      }
      
      return null;
    }
    
    // Обновляем время последней загрузки
    memoryStorage.updateLastLoadTime(userId);
    
    // Проверяем, запущены ли мы в браузере для загрузки из Redis через API
    if (typeof window !== 'undefined') {
      console.log(`[DataService] Попытка загрузить данные из Redis через API`);
      try {
        const cachedState = await api.loadGameStateFromRedisViaAPI(userId);
        if (cachedState) {
          console.log(`[DataService] Использую данные из Redis через API`);
          
          // Проверяем целостность данных
          if (!dataIntegrity.checkDataIntegrity(cachedState)) {
            console.warn(`[DataService] Данные из Redis не прошли проверку целостности`);
            
            // Проверяем наличие данных в кэше
            const localCachedState = memoryStorage.getFromCache(userId);
            if (localCachedState && memoryStorage.checkCacheIntegrity(userId)) {
              console.log(`[DataService] Использую данные из локального кэша`);
              return localCachedState;
            }
            
            console.warn(`[DataService] Нет валидных данных в кэше, создаю новое состояние`);
            return null;
          }
          
          // Если данные сжаты, распаковываем их
          if (isCompressedGameState(cachedState)) {
            console.log(`[DataService] Распаковка сжатых данных`);
            const decompressedState = compression.decompressGameState(cachedState);
            
            // Сохраняем в кэш
            memoryStorage.saveToCache(userId, decompressedState, true);
            
            return decompressedState;
          }
          
          // Сохраняем в кэш
          memoryStorage.saveToCache(userId, cachedState, true);
          
          return cachedState;
        }
      } catch (apiError) {
        console.warn(`[DataService] Ошибка при получении данных из Redis через API:`, apiError);
        // Продолжаем выполнение для получения из основного источника
      }
    }
    
    // Проверяем наличие кэшированных данных
    const cachedState = memoryStorage.getFromCache(userId);
    if (cachedState && memoryStorage.checkCacheIntegrity(userId)) {
      console.log(`[DataService] Использую данные из локального кэша`);
      return cachedState;
    }
    
    // Проверяем наличие резервной копии в localStorage
    const backupState = localStorage.loadGameStateBackup(userId);
    if (backupState) {
      console.log(`[DataService] Использую данные из резервной копии в localStorage`);
      
      // Валидируем состояние
      const validatedState = dataIntegrity.validateLoadedGameState(backupState, userId);
      
      // Сохраняем в кэш
      memoryStorage.saveToCache(userId, validatedState, true);
      
      // Очищаем резервную копию
      localStorage.clearGameStateBackup();
      
      return validatedState;
    }
    
    // Пробуем загрузить с сервера через API
    try {
      const serverState = await api.loadGameStateViaAPI(userId);
      if (serverState) {
        console.log(`[DataService] Использую данные с сервера`);
        
        // Валидируем состояние
        const validatedState = dataIntegrity.validateLoadedGameState(serverState, userId);
        
        // Сохраняем в кэш
        memoryStorage.saveToCache(userId, validatedState, true);
        
        return validatedState;
      }
    } catch (serverError) {
      console.error(`[DataService] Ошибка при загрузке с сервера:`, serverError);
    }
    
    console.log(`[DataService] Не удалось загрузить данные для ${userId}, возвращаем null`);
    return null;
  } catch (error) {
    console.error(`[DataService] Критическая ошибка при загрузке данных:`, error);
    return null;
  }
}

/**
 * Сохраняет состояние игры
 * @param userId ID пользователя
 * @param gameState Состояние игры
 * @param isCritical Флаг критичности сохранения
 */
export async function saveGameState(
  userId: string, 
  gameState: ExtendedGameState, 
  isCritical = false
): Promise<void> {
  try {
    // Импортируем и используем stateManager
    const { stateManager } = await import('./core/stateManager');
    await stateManager.saveGameState(userId, gameState, isCritical);
  } catch (error) {
    console.error(`[DataService] Ошибка при использовании stateManager:`, error);
    
    // Создаем резервную копию в localStorage при ошибке
    const { saveGameStateBackup } = await import('./storage/localStorageService');
    saveGameStateBackup(userId, gameState);
  }
}

/**
 * Резервная функция сохранения состояния игры
 * Используется только если не удалось загрузить stateManager
 */
async function fallbackSaveGameState(
  userId: string, 
  gameState: ExtendedGameState, 
  isCritical = false
): Promise<void> {
  try {
    console.log(`[DataService] Резервное сохранение игрового состояния для пользователя ${userId}`);
    
    // Минимально необходимая логика для сохранения прогресса
    const memoryStorage = await import('./storage/memoryStorageService');
    const localStorage = await import('./storage/localStorageService');
    
    // Сохраняем в кэш
    memoryStorage.saveToCache(userId, gameState, true);
    
    // Создаем резервную копию
    localStorage.saveGameStateBackup(userId, gameState);
  } catch (fallbackError) {
    console.error(`[DataService] Критическая ошибка при резервном сохранении:`, fallbackError);
  }
}

/**
 * Принудительное сохранение состояния игры
 * @param userId ID пользователя
 * @param state Состояние игры
 */
export async function forceSaveGameState(userId: string, state: ExtendedGameState): Promise<void> {
  try {
    if (!userId) {
      console.error('[DataService] Отсутствует ID пользователя для принудительного сохранения');
      return Promise.reject(new Error('Missing userId for force save'));
    }
    
    console.log(`[DataService] Выполняем принудительное сохранение состояния игры для ${userId}`);
    
    // Проверяем минимальный интервал между сохранениями, но с меньшим ограничением для принудительных сохранений
    const now = Date.now();
    const lastSaveTime = memoryStorage.getLastSaveTime(userId);
    const MIN_SAVE_INTERVAL = 2000; // 2 секунды между принудительными сохранениями
    
    if (now - lastSaveTime < MIN_SAVE_INTERVAL) {
      console.log(`[DataService] Слишком частые сохранения для пользователя ${userId}, ожидаем ${MIN_SAVE_INTERVAL - (now - lastSaveTime)}мс`);
      return Promise.resolve(); // Для принудительных сохранений не возвращаем ошибку, а просто пропускаем
    }
    
    // Обновляем время последнего сохранения
    memoryStorage.updateLastSaveTime(userId);
    
    // Создаем контрольный таймер для отслеживания длительности операции
    const timeoutMs = 5000; // 5 секунд максимум на сохранение
    let timer: NodeJS.Timeout | null = null;
    let isCompleted = false;
    
    // Обеспечиваем отсутствие циклических ссылок в state
    const safeState = prepareStateForSaving(state);
    
    // Создаем Promise с таймаутом
    const savePromise = new Promise<void>((resolve, reject) => {
      // Устанавливаем таймаут для автоматического отклонения Promise через 5 секунд
      timer = setTimeout(() => {
        if (!isCompleted) {
          console.log(`[DataService] Таймаут принудительного сохранения для ${userId}, полагаемся на резервную копию`);
          resolve(); // Резолвим промис вместо отклонения, чтобы не блокировать выгрузку страницы
        }
      }, timeoutMs);
      
      // Вызываем API для сохранения
      api.saveGameStateToRedisViaAPI(userId, safeState)
        .then(() => {
          isCompleted = true;
          if (timer) clearTimeout(timer);
          resolve();
        })
        .catch((error) => {
          isCompleted = true;
          if (timer) clearTimeout(timer);
          
          // Логируем ошибку, но не отклоняем промис при принудительном сохранении
          console.error(`[DataService] Ошибка при принудительном сохранении через API: ${error}`);
          
          // Создаем резервную копию в localStorage при ошибке
          localStorage.saveGameStateBackup(userId, state);
          
          resolve(); // Резолвим даже при ошибке, чтобы не блокировать выгрузку страницы
        });
    });
    
    await savePromise;
    
    if (isCompleted) {
      console.log(`[DataService] Принудительное сохранение для ${userId} завершено успешно`);
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error(`[DataService] Критическая ошибка при принудительном сохранении: ${error}`);
    
    // Создаем резервную копию в localStorage при ошибке
    localStorage.saveGameStateBackup(userId, state);
    
    return Promise.resolve(); // Резолвим даже при ошибке, чтобы не блокировать выгрузку страницы
  }
}

/**
 * Инвалидирует кэш для пользователя
 * @param userId ID пользователя
 */
export function invalidateCache(userId: string): void {
  memoryStorage.invalidateCache(userId);
}

/**
 * Проверяет, есть ли ожидающие изменения для данного пользователя
 * @param userId ID пользователя
 */
export function hasPendingChanges(userId: string): boolean {
  return saveQueue.hasPendingChanges(userId);
}

/**
 * Сохраняет все ожидающие изменения немедленно
 */
export async function saveAllPendingChanges(): Promise<void> {
  if (saveQueue.getPendingSavesCount() > 0) {
    await saveQueue.processBatchSaves();
  }
}

/**
 * Настраивает обработчик для события beforeunload
 * @param userId ID пользователя
 * @param getLatestState Функция получения актуального состояния
 */
export function setupBeforeUnloadHandler(
  userId: string, 
  getLatestState: () => ExtendedGameState
): () => void {
  if (typeof window === 'undefined') return () => {};
  
  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    try {
      const state = getLatestState();
      
      // Устанавливаем флаг для сохранения перед закрытием
      state._isBeforeUnloadSave = true;
      
      // Сохраняем резервную копию в localStorage
      localStorage.saveGameStateBackup(userId, state);
      
      // Используем Beacon API для надежной отправки перед закрытием
      if (navigator.sendBeacon) {
        // Получаем JWT-токен
        const token = authService.getToken();
        
        // Если токена нет, не отправляем запрос
        if (!token) {
          console.warn('[DataService] JWT-токен отсутствует при сохранении перед закрытием страницы');
          return;
        }
        
        // Подготавливаем данные для отправки
        const payload = {
          userId,
          gameState: prepareStateForSaving(state),
          clientTimestamp: new Date().toISOString(),
          version: state._saveVersion || 1,
          isCompressed: false
        };
        
        // Создаем заголовки для Beacon API (хотя они не могут быть напрямую использованы)
        // Добавляем токен в URL в качестве обходного решения
        const data = JSON.stringify(payload);
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon(`/api/game/save-progress?token=${encodeURIComponent(token)}`, blob);
      }
      
      // Отменяем стандартное сообщение подтверждения выхода
      event.preventDefault();
      // Chrome требует возврата значения
      event.returnValue = '';
    } catch (error) {
      console.error('[DataService] Ошибка в обработчике beforeUnload:', error);
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
  memoryStorage.clearAllCaches();
  localStorage.clearGameStateBackup();
  saveQueue.clearSaveQueue();
}

/**
 * Валидирует данные игры
 * @param data Данные
 */
export function validateGameData(data: any): boolean {
  return dataIntegrity.validateGameData(data);
}

/**
 * Отменяет все активные запросы
 */
export function cancelAllRequests(): void {
  api.cancelAllRequests();
}

/**
 * Подготавливает состояние для сохранения, удаляя циклические ссылки
 * @param state Игровое состояние
 */
function prepareStateForSaving(state: any): any {
  // Создаем копию объекта
  const cleanedState = { ...state };
  
  // Список полей, которые следует удалить
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
  
  return cleanedState;
}

// Оставляем только последние версии
export async function loadGameStateWithIntegrity(userId: string): Promise<LoadResponse> {
  try {
    const response = await fetch(`/api/game/load/${userId}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Неизвестная ошибка при загрузке');
    }

    return {
      success: true,
      data: result.data,
      version: result.version
    };
  } catch (error) {
    console.error('[DataService] Ошибка при загрузке состояния:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    };
  }
}

export async function saveGameStateWithIntegrity(userId: string, state: GameState): Promise<SaveResponse> {
  try {
    const response = await fetch(`/api/game/save/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state,
        version: state._saveVersion || 1,
        timestamp: Date.now()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      version: result.version
    };
  } catch (error) {
    console.error('[DataService] Ошибка при сохранении состояния:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка'
    };
  }
}

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

export async function validateGameState(state: GameState): Promise<boolean> {
  try {
    // Проверяем наличие обязательных полей
    if (!state.inventory || !state.container || !state.upgrades) {
      return false;
    }

    // Проверяем корректность значений
    if (state.inventory.snot < 0 || 
        state.inventory.snotCoins < 0 || 
        state.inventory.containerCapacity < 0 ||
        state.inventory.fillingSpeed < 0) {
      return false;
    }

    if (state.container.level < 1 || 
        state.container.capacity < 0 || 
        state.container.currentAmount < 0) {
      return false;
    }

    if (state.upgrades.containerLevel < 1 || 
        state.upgrades.fillingSpeedLevel < 1) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('[DataService] Ошибка при валидации состояния:', error);
    return false;
  }
} 