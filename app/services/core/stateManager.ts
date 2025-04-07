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
import { createInitialGameState } from '@/app/constants/gameConstants';
import { verifyLocalSaveIntegrity } from '@/app/utils/localSaveChecker';
import { logTiming } from '@/app/lib/logger';
import { compress } from '@/app/utils/compression';
import { calculateGameLogic } from '@/app/utils/gameLogic';
import { prepareStateForSaving } from '@/app/services/dataServiceModular';

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
  private activeUserId: string | null = null;
  private lastLoadedState: ExtendedGameState | null = null;
  private isInitialized = false;
  private localStorageCacheKey = 'game_state_cache';
  private localStoragePrefix = 'game_state_';
  
  /**
   * Конструктор менеджера состояния
   * @param options Опции менеджера состояния
   */
  constructor(options: StateManagerOptions = {}) {
    this.compressionEnabled = options.enableCompression ?? true;
    this.minimumSaveInterval = options.minimumSaveInterval ?? 5000;
    this.criticalSaveInterval = options.criticalSaveInterval ?? 2000;
    this.unloadProtection = options.unloadProtection ?? true;
    this.isInitialized = true;
    console.log('[StateManager] Инициализирован');
  }
  
  /**
   * Загружает состояние игры для пользователя
   * @param userId ID пользователя
   * @returns Состояние игры или null
   */
  async loadGameState(userId: string): Promise<ExtendedGameState | null> {
    try {
      console.log(`[StateManager] Запрос данных для пользователя ${userId}`);
      
      const startTime = performance.now();
      const apiState = await api.loadGameState(userId);
      logTiming('StateManager.loadFromAPI', performance.now() - startTime);
      
      if (apiState) {
        console.log(`[StateManager] Данные получены из API`);
        
        this.activeUserId = userId;
        this.lastLoadedState = apiState;
        
        // Кэшируем полученное состояние в localStorage
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(
              `${this.localStoragePrefix}${userId}`, 
              JSON.stringify({ 
                state: apiState, 
                timestamp: Date.now() 
              })
            );
          } catch (cacheError) {
            console.warn('[StateManager] Не удалось кэшировать состояние в localStorage:', cacheError);
          }
        }
        
        return apiState;
      }
      
      // Если не удалось загрузить из API, пробуем локальный кэш
      console.log(`[StateManager] Не удалось получить данные из API, проверяем локальный кэш`);
      
      if (typeof window !== 'undefined') {
        try {
          const cachedData = localStorage.getItem(`${this.localStoragePrefix}${userId}`);
          
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            
            if (parsed && parsed.state) {
              const localState = parsed.state;
              
              // Проверяем целостность
              if (verifyLocalSaveIntegrity(localState)) {
                console.log(`[StateManager] Использую данные из локального кэша`);
                
                this.activeUserId = userId;
                this.lastLoadedState = localState;
                
                return localState;
              } else {
                console.warn('[StateManager] Локальный кэш поврежден, создаю новое состояние');
              }
            }
          }
        } catch (localError) {
          console.warn('[StateManager] Ошибка при чтении локального кэша:', localError);
        }
      }
      
      // Если ничего не помогло, создаем новое состояние
      console.log(`[StateManager] Создаю новое состояние игры для пользователя ${userId}`);
      
      const initialState = createInitialGameState(userId);
      this.activeUserId = userId;
      this.lastLoadedState = initialState;
      
      return initialState;
    } catch (error) {
      console.error('[StateManager] Ошибка при получении состояния:', error);
      
      // В случае ошибки, возвращаем начальное состояние
      const initialState = createInitialGameState(userId);
      this.activeUserId = userId;
      this.lastLoadedState = initialState;
      
      return initialState;
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
  ): Promise<boolean> {
    try {
      if (!userId) {
        console.error('[StateManager] Не указан userId для сохранения');
        return false;
      }
      
      if (!gameState) {
        console.error('[StateManager] Пустое состояние игры');
        return false;
      }
      
      // Обновляем логику игры перед сохранением
      calculateGameLogic(gameState);
      
      // Подготавливаем состояние к сохранению
      const processedData = prepareStateForSaving(gameState);
      
      // Сохраняем через API
      const saveResult = await api.saveGameState(userId, processedData, isCritical);
      
      if (!saveResult) {
        console.error('[StateManager] Ошибка при сохранении через API');
        return false;
      }
      
      // Обновляем локальный кэш если успешно сохранили в API
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            `${this.localStoragePrefix}${userId}`, 
            JSON.stringify({ 
              state: processedData, 
              timestamp: Date.now() 
            })
          );
        } catch (cacheError) {
          console.warn('[StateManager] Не удалось обновить локальный кэш:', cacheError);
          // Продолжаем выполнение даже при ошибке кэширования
        }
      }
      
      return true;
    } catch (error) {
      console.error('[StateManager] Ошибка при сохранении состояния:', error);
      return false;
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
        api.saveGameState(userId, safeState)
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