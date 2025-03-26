/**
 * Сервис для управления состоянием игры
 * Обрабатывает операции загрузки, сохранения и обновления состояния
 */
import type { ExtendedGameState } from '../../types/gameTypes';
import { isCompressedGameState } from '../../types/saveTypes';

// Импорт модульных сервисов
import * as api from '../api/apiService';
import * as memoryStorage from '../storage/memoryStorageService';
import * as localStorage from '../storage/localStorageService';
import * as dataIntegrity from '../validation/dataIntegrityService';
import * as compression from '../compression/compressionService';
import * as saveQueue from '../queue/saveQueueService';

// Настройки менеджера состояния
interface StateManagerOptions {
  enableCompression?: boolean;
  cacheTimeout?: number;
  minimumSaveInterval?: number;
  criticalSaveInterval?: number;
  unloadProtection?: boolean;
}

/**
 * Класс менеджера состояния игры
 */
class StateManager {
  private compressionEnabled: boolean;
  private minimumSaveInterval: number;
  private criticalSaveInterval: number;
  private unloadProtection: boolean;
  
  /**
   * Конструктор менеджера состояния
   * @param options Опции менеджера состояния
   */
  constructor(options: StateManagerOptions = {}) {
    this.compressionEnabled = options.enableCompression ?? true;
    this.minimumSaveInterval = options.minimumSaveInterval ?? 5000;
    this.criticalSaveInterval = options.criticalSaveInterval ?? 2000;
    this.unloadProtection = options.unloadProtection ?? true;
  }
  
  /**
   * Загружает состояние игры для пользователя
   * @param userId ID пользователя
   * @returns Состояние игры или null
   */
  async loadGameState(userId: string): Promise<ExtendedGameState | null> {
    try {
      console.log(`[StateManager] Загрузка игрового состояния для пользователя ${userId}`);
      
      // Проверяем минимальный интервал между загрузками
      const now = Date.now();
      const lastLoadTime = memoryStorage.getLastLoadTime(userId);
      const MIN_LOAD_INTERVAL = 2000; // 2 секунды между загрузками
      
      if (now - lastLoadTime < MIN_LOAD_INTERVAL) {
        console.log(`[StateManager] Слишком частые загрузки для пользователя ${userId}, ожидаем ${MIN_LOAD_INTERVAL - (now - lastLoadTime)}мс`);
        
        // Возвращаем кэшированные данные, если они есть
        const cachedState = memoryStorage.getFromCache(userId);
        if (cachedState) {
          console.log(`[StateManager] Возвращаем данные из кэша для ${userId}`);
          return cachedState;
        }
        
        return null;
      }
      
      // Обновляем время последней загрузки
      memoryStorage.updateLastLoadTime(userId);
      
      // Пытаемся загрузить из Redis через API
      if (typeof window !== 'undefined') {
        try {
          const redisState = await api.loadGameStateFromRedisViaAPI(userId);
          if (redisState) {
            console.log(`[StateManager] Данные получены из Redis через API`);
            
            // Проверяем целостность данных
            if (!dataIntegrity.checkDataIntegrity(redisState)) {
              console.warn(`[StateManager] Данные из Redis не прошли проверку целостности`);
              
              // Проверяем наличие данных в кэше
              const localCachedState = memoryStorage.getFromCache(userId);
              if (localCachedState && memoryStorage.checkCacheIntegrity(userId)) {
                console.log(`[StateManager] Использую данные из локального кэша вместо Redis`);
                return localCachedState;
              }
              
              console.warn(`[StateManager] Нет валидных данных в кэше, создаю новое состояние`);
              return null;
            }
            
            // Если данные сжаты, распаковываем их
            if (isCompressedGameState(redisState)) {
              console.log(`[StateManager] Распаковка сжатых данных из Redis`);
              const decompressedState = compression.decompressGameState(redisState);
              
              // Сохраняем в кэш
              memoryStorage.saveToCache(userId, decompressedState, true);
              
              return decompressedState;
            }
            
            // Сохраняем в кэш
            memoryStorage.saveToCache(userId, redisState, true);
            
            return redisState;
          }
        } catch (apiError) {
          console.warn(`[StateManager] Ошибка при получении данных из Redis через API:`, apiError);
          // Продолжаем выполнение для получения из основного источника
        }
      }
      
      // Проверяем наличие кэшированных данных
      const cachedState = memoryStorage.getFromCache(userId);
      if (cachedState && memoryStorage.checkCacheIntegrity(userId)) {
        console.log(`[StateManager] Использую данные из локального кэша`);
        return cachedState;
      }
      
      // Проверяем наличие резервной копии в localStorage
      const backupState = localStorage.loadGameStateBackup(userId);
      if (backupState) {
        console.log(`[StateManager] Использую данные из резервной копии в localStorage`);
        
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
          console.log(`[StateManager] Использую данные с сервера`);
          
          // Валидируем состояние
          const validatedState = dataIntegrity.validateLoadedGameState(serverState, userId);
          
          // Сохраняем в кэш
          memoryStorage.saveToCache(userId, validatedState, true);
          
          return validatedState;
        }
      } catch (serverError) {
        console.error(`[StateManager] Ошибка при загрузке с сервера:`, serverError);
      }
      
      console.log(`[StateManager] Не удалось загрузить данные для ${userId}, возвращаем null`);
      return null;
    } catch (error) {
      console.error(`[StateManager] Критическая ошибка при загрузке данных:`, error);
      return null;
    }
  }
  
  /**
   * Сохраняет состояние игры для пользователя
   * @param userId ID пользователя
   * @param gameState Состояние игры
   * @param isCritical Флаг критичности сохранения
   * @returns Promise<void>
   */
  async saveGameState(
    userId: string, 
    gameState: ExtendedGameState, 
    isCritical = false
  ): Promise<void> {
    try {
      console.log(`[StateManager] Сохранение игрового состояния для пользователя ${userId}`);
      
      // Проверяем минимальный интервал между сохранениями
      const now = Date.now();
      const lastSaveTime = memoryStorage.getLastSaveTime(userId);
      const MIN_SAVE_INTERVAL = isCritical ? this.criticalSaveInterval : this.minimumSaveInterval;
      
      if (now - lastSaveTime < MIN_SAVE_INTERVAL) {
        console.log(`[StateManager] Слишком частые сохранения для пользователя ${userId}, ожидаем ${MIN_SAVE_INTERVAL - (now - lastSaveTime)}мс`);
        
        // Если это не критическое сохранение, добавляем в очередь с низким приоритетом
        if (!isCritical) {
          saveQueue.addSaveToQueue(userId, gameState, 0, false);
        }
        
        return;
      }
      
      // Обновляем время последнего сохранения
      memoryStorage.updateLastSaveTime(userId);
      
      // Сохраняем в кэш
      memoryStorage.saveToCache(userId, gameState, dataIntegrity.checkDataIntegrity(gameState));
      
      // Сохраняем в Redis через API, если мы в браузере
      if (typeof window !== 'undefined') {
        try {
          // Обеспечиваем отсутствие циклических ссылок в объекте state
          const safeState = this.prepareStateForSaving(gameState);
          
          // Сжимаем данные перед отправкой, если включена компрессия
          const processedData = this.compressionEnabled 
            ? await compression.compressGameState(safeState)
            : safeState;
          
          // Сохраняем в Redis через API
          await api.saveGameStateToRedisViaAPI(userId, processedData, isCritical);
        } catch (redisError) {
          console.error(`[StateManager] Ошибка при сохранении в Redis:`, redisError);
          
          // Создаем резервную копию в localStorage при ошибке
          localStorage.saveGameStateBackup(userId, gameState);
        }
      }
      
      // Если это критическое сохранение или принудительное сохранение, сохраняем на сервер напрямую
      if (isCritical) {
        try {
          // Обеспечиваем отсутствие циклических ссылок в объекте state
          const safeState = this.prepareStateForSaving(gameState);
          
          // Сжимаем данные перед отправкой, если включена компрессия
          const processedData = this.compressionEnabled 
            ? await compression.compressGameState(safeState)
            : safeState;
          
          // Сохраняем на сервер через API
          await api.saveGameStateViaAPI(processedData as ExtendedGameState, true);
        } catch (serverError) {
          console.error(`[StateManager] Ошибка при сохранении на сервер:`, serverError);
          
          // Создаем резервную копию в localStorage при ошибке
          localStorage.saveGameStateBackup(userId, gameState);
        }
      } else {
        // Добавляем задачу сохранения в очередь
        saveQueue.addSaveToQueue(userId, gameState, 0, false);
      }
    } catch (error) {
      console.error(`[StateManager] Критическая ошибка при сохранении данных:`, error);
      
      // Создаем резервную копию в localStorage при ошибке
      localStorage.saveGameStateBackup(userId, gameState);
    }
  }
  
  /**
   * Принудительное сохранение состояния игры
   * @param userId ID пользователя
   * @param state Состояние игры
   * @returns Promise<void>
   */
  async forceSaveGameState(userId: string, state: ExtendedGameState): Promise<void> {
    try {
      if (!userId) {
        console.error('[StateManager] Отсутствует ID пользователя для принудительного сохранения');
        return Promise.reject(new Error('Missing userId for force save'));
      }
      
      console.log(`[StateManager] Выполняем принудительное сохранение состояния игры для ${userId}`);
      
      // Проверяем минимальный интервал между сохранениями
      const now = Date.now();
      const lastSaveTime = memoryStorage.getLastSaveTime(userId);
      
      if (now - lastSaveTime < this.criticalSaveInterval) {
        console.log(`[StateManager] Слишком частые сохранения для пользователя ${userId}, ожидаем ${this.criticalSaveInterval - (now - lastSaveTime)}мс`);
        return Promise.resolve(); // Для принудительных сохранений не возвращаем ошибку, а просто пропускаем
      }
      
      // Обновляем время последнего сохранения
      memoryStorage.updateLastSaveTime(userId);
      
      // Создаем контрольный таймер для отслеживания длительности операции
      const timeoutMs = 5000; // 5 секунд максимум на сохранение
      let timer: NodeJS.Timeout | null = null;
      let isCompleted = false;
      
      // Обеспечиваем отсутствие циклических ссылок в state
      const safeState = this.prepareStateForSaving(state);
      
      // Создаем Promise с таймаутом
      const savePromise = new Promise<void>((resolve, reject) => {
        // Устанавливаем таймаут для автоматического отклонения Promise через 5 секунд
        timer = setTimeout(() => {
          if (!isCompleted) {
            console.log(`[StateManager] Таймаут принудительного сохранения для ${userId}, полагаемся на резервную копию`);
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
            console.error(`[StateManager] Ошибка при принудительном сохранении через API: ${error}`);
            
            // Создаем резервную копию в localStorage при ошибке
            localStorage.saveGameStateBackup(userId, state);
            
            resolve(); // Резолвим даже при ошибке, чтобы не блокировать выгрузку страницы
          });
      });
      
      await savePromise;
      
      if (isCompleted) {
        console.log(`[StateManager] Принудительное сохранение для ${userId} завершено успешно`);
      }
      
      return Promise.resolve();
    } catch (error) {
      console.error(`[StateManager] Критическая ошибка при принудительном сохранении: ${error}`);
      
      // Создаем резервную копию в localStorage при ошибке
      localStorage.saveGameStateBackup(userId, state);
      
      return Promise.resolve(); // Резолвим даже при ошибке, чтобы не блокировать выгрузку страницы
    }
  }
  
  /**
   * Настраивает обработчик для события beforeunload
   * @param userId ID пользователя
   * @param getLatestState Функция получения актуального состояния
   * @returns Функция для удаления обработчика
   */
  setupBeforeUnloadHandler(
    userId: string, 
    getLatestState: () => ExtendedGameState
  ): () => void {
    if (typeof window === 'undefined' || !this.unloadProtection) return () => {};
    
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      try {
        const state = getLatestState();
        
        // Устанавливаем флаг для сохранения перед закрытием
        state._isBeforeUnloadSave = true;
        
        // Сохраняем резервную копию в localStorage
        localStorage.saveGameStateBackup(userId, state);
        
        // Используем Beacon API для надежной отправки перед закрытием
        if (navigator.sendBeacon) {
          try {
            // Подготавливаем данные для отправки
            const payload = {
              userId,
              gameState: this.prepareStateForSaving(state),
              clientTimestamp: new Date().toISOString(),
              version: state._saveVersion || 1,
              isCompressed: false
            };
            
            // Создаем данные для Beacon API
            const data = JSON.stringify(payload);
            const blob = new Blob([data], { type: 'application/json' });
            
            // Отправляем данные через Beacon API
            navigator.sendBeacon('/api/game/save-progress-beacon', blob);
          } catch (beaconError) {
            console.error('[StateManager] Ошибка при использовании Beacon API:', beaconError);
          }
        }
        
        // Отменяем стандартное сообщение подтверждения выхода
        event.preventDefault();
        // Chrome требует возврата значения
        event.returnValue = '';
      } catch (error) {
        console.error('[StateManager] Ошибка в обработчике beforeUnload:', error);
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
   * Инвалидирует кэш для пользователя
   * @param userId ID пользователя
   */
  invalidateCache(userId: string): void {
    memoryStorage.invalidateCache(userId);
  }
  
  /**
   * Проверяет, есть ли ожидающие изменения для данного пользователя
   * @param userId ID пользователя
   * @returns true если есть ожидающие изменения, иначе false
   */
  hasPendingChanges(userId: string): boolean {
    return saveQueue.hasPendingChanges(userId);
  }
  
  /**
   * Сохраняет все ожидающие изменения немедленно
   * @returns Promise<void>
   */
  async saveAllPendingChanges(): Promise<void> {
    if (saveQueue.getPendingSavesCount() > 0) {
      await saveQueue.processBatchSaves();
    }
  }
  
  /**
   * Очищает все кэши и состояния
   */
  clearAllCaches(): void {
    memoryStorage.clearAllCaches();
    localStorage.clearGameStateBackup();
    saveQueue.clearSaveQueue();
  }
  
  /**
   * Отменяет все активные запросы
   */
  cancelAllRequests(): void {
    api.cancelAllRequests();
  }
  
  /**
   * Валидирует данные игры
   * @param data Данные для валидации
   * @returns true если данные валидны, иначе false
   */
  validateGameData(data: any): boolean {
    return dataIntegrity.validateGameData(data);
  }
  
  /**
   * Подготавливает состояние для сохранения, удаляя циклические ссылки
   * @param state Игровое состояние
   * @returns Очищенное состояние
   */
  private prepareStateForSaving(state: any): any {
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
}

// Создаем и экспортируем экземпляр менеджера состояния
export const stateManager = new StateManager({
  enableCompression: true,
  minimumSaveInterval: 5000,
  criticalSaveInterval: 2000,
  unloadProtection: true
});

// Экспортируем класс для возможности создания дополнительных экземпляров
export { StateManager }; 