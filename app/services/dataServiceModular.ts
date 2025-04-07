/**
 * ВНИМАНИЕ! Этот файл устарел и будет удален в ближайшее время.
 * Вместо него используйте систему сохранений из каталога saveSystem:
 * - saveManager - из app/services/saveSystem/index
 * - useSaveManager - из app/contexts/SaveManagerProvider
 */

/**
 * Модульный сервис для управления данными игры
 * Поддерживает загрузку, сохранение и синхронизацию состояния игры
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

// Импорт сервиса аутентификации
import { authService } from './auth/authService';

// Импорт функции создания начального состояния игры
import { createInitialGameState } from '../constants/gameConstants';

// Флаги для управления поведением сервиса
let compressionEnabled = true;

/**
 * Функция для преобразования GameState в ExtendedGameState
 * @param state Базовое состояние игры
 * @returns Расширенное состояние игры
 */
function extendGameState(state: ExtendedGameState): ExtendedGameState {
  // Преобразуем GameState в ExtendedGameState, добавляя необходимые поля
  const extendedState: ExtendedGameState = {
    ...state,
    _loadedAt: new Date().toISOString(),
    _dataSource: 'memory',
    _integrityVerified: true
  };
  
  return extendedState;
}

/**
 * Подготавливает состояние для сохранения, удаляя циклические ссылки
 * @param state Игровое состояние
 */
function prepareStateForSaving(state: any): any {
  // Создаем копию объекта
  const cleanedState = { ...state };
  
  // Список полей, которые могут вызвать проблемы при сериализации
  const fieldsToClean = [
    '_tempData',
    '_skipSave',
    '_savePromise',
    '_saveTimeout',
    '_saveTimeoutId',
    '_savePending',
    '_saveError',
    '_saveRetry',
    '_saveRetryCount',
    '_saveMaxRetry'
  ];
  
  // Удаляем проблемные поля
  fieldsToClean.forEach(field => {
    if ((cleanedState as any)[field]) {
      delete (cleanedState as any)[field];
    }
  });
  
  return cleanedState;
}

/**
 * Загружает состояние игры с сервера или локального хранилища
 * @param userId Идентификатор пользователя
 * @returns Состояние игры или null если не найдено
 */
export async function loadGameState(userId: string): Promise<ExtendedGameState | null> {
  try {
    console.log(`[DataService] Загрузка состояния игры для пользователя ${userId}`);
    
    // Проверяем наличие авторизации
    if (!userId) {
      console.warn(`[DataService] Отсутствует идентификатор пользователя`);
      return null;
    }
    
    // Проверяем, запущены ли мы в браузере для загрузки через API
    if (typeof window !== 'undefined') {
      console.log(`[DataService] Попытка загрузить данные через API`);
      try {
        const state = await api.loadGameState(userId);
        if (state) {
          console.log(`[DataService] Использую данные из API`);
          
          // Проверяем целостность данных
          if (!dataIntegrity.checkDataIntegrity(state)) {
            console.warn(`[DataService] Данные из API не прошли проверку целостности`);
            
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
          if (isCompressedGameState(state)) {
            console.log(`[DataService] Распаковка сжатых данных`);
            const decompressedState = compression.decompressGameState(state);
            
            // Сохраняем в кэш
            memoryStorage.saveToCache(userId, decompressedState, true);
            
            return decompressedState;
          }
          
          // Сохраняем в кэш
          memoryStorage.saveToCache(userId, state, true);
          
          return state;
        }
      } catch (apiError) {
        console.warn(`[DataService] Ошибка при получении данных из API:`, apiError);
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
    
    // Если все предыдущие методы не дали результата, загружаем начальное состояние
    console.log(`[DataService] Создаю новое состояние игры`);
    const initialState = createInitialGameState(userId) as unknown as ExtendedGameState;
    
    // Сохраняем в кэш
    memoryStorage.saveToCache(userId, initialState, true);
    
    return initialState;
  } catch (error) {
    console.error(`[DataService] Ошибка при загрузке состояния:`, error);
    
    // Создаем новое состояние при ошибке
    console.warn(`[DataService] Возвращаю новое состояние из-за ошибки`);
    const initialState = createInitialGameState(userId) as unknown as ExtendedGameState;
    
    return initialState;
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
 * Принудительно сохраняет состояние игры
 * Используется для сохранения при выгрузке страницы
 * @param userId Идентификатор пользователя
 * @param state Состояние игры
 */
export async function forceSaveGameState(userId: string, state: ExtendedGameState): Promise<void> {
  try {
    console.log(`[DataService] Принудительное сохранение для ${userId}`);
    
    if (!userId || !state) {
      console.warn(`[DataService] Невозможно сохранить: отсутствует userId или state`);
      return;
    }
    
    // Переменные для контроля выполнения
    let isCompleted = false;
    let timer: NodeJS.Timeout | null = null;
    
    // В режиме выгрузки страницы используем короткий таймаут
    const timeoutMs = 2000;
    
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
      api.saveGameState(safeState)
        .then(() => {
          isCompleted = true;
          if (timer) clearTimeout(timer);
          resolve();
        })
        .catch((error: Error) => {
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
    
    console.log(`[DataService] Принудительное сохранение завершено для ${userId}`);
  } catch (error) {
    console.error(`[DataService] Ошибка при принудительном сохранении: ${error}`);
    
    // Создаем резервную копию в localStorage при ошибке
    localStorage.saveGameStateBackup(userId, state);
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

export async function saveGameStateWithIntegrity(userId: string, state: ExtendedGameState): Promise<SaveResponse> {
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

import type { ExtendedGameState } from '../types/gameTypes';

interface SaveResponse {
  success: boolean;
  error?: string;
  version?: number;
}

interface LoadResponse {
  success: boolean;
  data?: ExtendedGameState;
  error?: string;
  version?: number;
}

export async function validateGameState(state: ExtendedGameState): Promise<boolean> {
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