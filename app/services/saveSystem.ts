/**
 * Система сохранения прогресса пользователя
 * Оптимизирована для работы с миллионом пользователей
 */

import { AsyncStorage, StorageKeys } from "../utils/asyncStorage";
import { SyncManager } from "../utils/syncManager";
import { validateAndRepairGameState } from "../utils/dataIntegrity";
import { 
  compressGameState, 
  decompressGameState, 
  estimateCompression,
  CompressionAlgorithm
} from "../utils/dataCompression";
import { createDelta, applyDelta } from "../utils/deltaCompression";
import { ExtendedGameState } from "../types/gameTypes";
import { StructuredGameSave, DeltaGameState, SyncInfo } from "../types/saveTypes";

/**
 * Настройки системы сохранения
 */
export interface SaveSystemOptions {
  // Автоматическое сохранение
  autoSave: boolean;
  
  // Интервал автосохранения (в миллисекундах)
  autoSaveInterval: number;
  
  // Сжимать данные перед сохранением
  compressData: boolean;
  
  // Синхронизировать с сервером
  syncWithServer: boolean;
  
  // Стратегия разрешения конфликтов
  conflictResolution: 'client-wins' | 'server-wins' | 'merge' | 'manual';
  
  // Режим отладки
  debugMode: boolean;
  
  // Тип хранилища
  storageType: "localStorage" | "sessionStorage" | "indexedDB" | "memory";
  
  // Максимальное количество локальных резервных копий
  maxLocalBackups: number;
  
  // Сохранять автоматически при закрытии страницы
  saveOnPageClose: boolean;
  
  // Оптимизировать сохранения (использовать дельта-сохранения)
  optimizeSaves: boolean;
  
  // Проверять целостность данных при загрузке
  validateOnLoad: boolean;
}

/**
 * Результат операции сохранения/загрузки
 */
export interface SaveResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  timestamp: number;
  metrics?: {
    duration: number;
    dataSize?: number;
    compressedSize?: number;
    compressionRatio?: number;
  };
}

/**
 * Информация о сохранении
 */
export interface SaveInfo {
  lastSaved: Date;
  version: number;
  saveCount: number;
  hasLocalBackup: boolean;
  hasSyncedBackup: boolean;
  lastSync?: Date;
  compressionStats?: {
    originalSize: number;
    compressedSize: number;
    ratio: number;
  };
}

/**
 * Система сохранения с поддержкой оптимизаций для миллиона пользователей
 */
export class SaveSystem {
  private options: SaveSystemOptions;
  private storage: AsyncStorage;
  private syncManager: SyncManager | null = null;
  private currentState: ExtendedGameState | null = null;
  private previousState: ExtendedGameState | null = null;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private saveCounter: number = 0;
  private lastSaveTime: number = 0;
  private isInitialized: boolean = false;
  private userId: string;
  private saveQueue: Array<() => Promise<void>> = [];
  private isSaving: boolean = false;
  
  /**
   * Создает экземпляр системы сохранения
   * @param userId ID пользователя
   * @param options Настройки системы сохранения
   */
  constructor(userId: string, options?: Partial<SaveSystemOptions>) {
    this.userId = userId;
    
    // Устанавливаем опции по умолчанию
    this.options = {
      autoSave: true,
      autoSaveInterval: 5 * 60 * 1000, // 5 минут
      compressData: true,
      syncWithServer: true,
      conflictResolution: 'merge',
      debugMode: false,
      storageType: "localStorage",
      maxLocalBackups: 3,
      saveOnPageClose: true,
      optimizeSaves: true,
      validateOnLoad: true,
      ...options
    };
    
    // Создаем хранилище
    this.storage = new AsyncStorage(userId, {
      storageType: this.options.storageType,
      autoCompress: this.options.compressData,
      validateBeforeSave: true,
      enableLogging: this.options.debugMode,
      maxBackups: this.options.maxLocalBackups
    });
    
    // Создаем менеджер синхронизации, если включена синхронизация
    if (this.options.syncWithServer) {
      this.syncManager = new SyncManager(userId, {
        conflictResolution: this.options.conflictResolution,
        compressData: this.options.compressData,
        enableLogging: this.options.debugMode,
        autoSyncInterval: this.options.autoSaveInterval * 2
      });
    }
    
    // Устанавливаем обработчик закрытия страницы
    if (this.options.saveOnPageClose && typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handlePageClose);
    }
    
    // Логируем создание системы сохранения
    if (this.options.debugMode) {
      console.log(`[SaveSystem] Создана система сохранения для пользователя ${userId}`, this.options);
    }
  }

  /**
   * Инициализирует систему сохранения
   * @returns Результат инициализации
   */
  public async initialize(): Promise<SaveResult> {
    const startTime = Date.now();
    
    try {
      // Загружаем данные
      const loadResult = await this.load();
      
      // Если загрузка не удалась, создаем новое состояние
      if (!loadResult.success || !this.currentState) {
        this.currentState = this.createDefaultState();
      }
      
      // Запускаем автосохранение, если включено
      if (this.options.autoSave) {
        this.startAutoSave();
      }
      
      // Устанавливаем состояние в менеджер синхронизации
      if (this.syncManager && this.currentState) {
        this.syncManager.setLocalState(this.currentState);
      }
      
      this.isInitialized = true;
      
      if (this.options.debugMode) {
        console.log(`[SaveSystem] Инициализация завершена за ${Date.now() - startTime}мс`);
      }
      
      return {
        success: true,
        message: "Система сохранения инициализирована",
        data: { state: this.currentState },
        timestamp: Date.now(),
        metrics: {
          duration: Date.now() - startTime
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (this.options.debugMode) {
        console.error(`[SaveSystem] Ошибка инициализации:`, error);
      }
      
      return {
        success: false,
        message: "Ошибка инициализации системы сохранения",
        error: errorMessage,
        timestamp: Date.now(),
        metrics: {
          duration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Устанавливает новые опции для системы сохранения
   * @param newOptions Новые опции
   */
  public setOptions(newOptions: Partial<SaveSystemOptions>): void {
    // Сохраняем предыдущее значение для автосохранения
    const prevAutoSave = this.options.autoSave;
    
    // Обновляем опции
    this.options = {
      ...this.options,
      ...newOptions
    };
    
    // Логируем обновление опций
    if (this.options.debugMode) {
      console.log(`[SaveSystem] Опции обновлены:`, newOptions);
    }
    
    // Если изменился статус автосохранения
    if (prevAutoSave !== this.options.autoSave) {
      if (this.options.autoSave) {
        this.startAutoSave();
      } else {
        this.stopAutoSave();
      }
    }
    
    // Обновляем настройки хранилища
    this.storage.setOptions({
      storageType: this.options.storageType,
      autoCompress: this.options.compressData,
      maxBackups: this.options.maxLocalBackups,
    });
    
    // Обновляем настройки синхронизации
    if (this.syncManager) {
      this.syncManager.setOptions({
        conflictResolution: this.options.conflictResolution,
        compressData: this.options.compressData,
        enableLogging: this.options.debugMode,
      });
  }
}

/**
   * Создает состояние по умолчанию
   * @returns Новое состояние
   */
  private createDefaultState(): ExtendedGameState {
    return {
      _saveVersion: 1,
      _lastModified: Date.now(),
      _userId: this.userId,
      
      inventory: {
        snot: 0,
        snotCoins: 0,
        containerCapacity: 100,
        containerCapacityLevel: 1,
        fillingSpeed: 2,
        fillingSpeedLevel: 1,
        collectionEfficiency: 1,
        containerSnot: 0,
        Cap: 0
      },
      
      container: {
        level: 1,
        capacity: 100,
        currentAmount: 0,
        fillRate: 1,
        currentFill: 0
      },
      
      upgrades: {
        containerLevel: 1,
        fillingSpeedLevel: 1,
        collectionEfficiencyLevel: 1,
        clickPower: { level: 1, value: 1 },
        passiveIncome: { level: 1, value: 0.1 }
      },
      
      settings: {
        language: 'en',
        theme: 'light',
        notifications: true,
        tutorialCompleted: false
      },
      
      soundSettings: {
        clickVolume: 0.5,
        effectsVolume: 0.5,
        backgroundMusicVolume: 0.3,
        isMuted: false,
        isEffectsMuted: false,
        isBackgroundMusicMuted: false
      },
      
      achievements: {
        unlockedAchievements: []
      },
      
      items: [],
      
      activeTab: 'main',
      user: null,
      validationStatus: "pending",
      hideInterface: false,
      isPlaying: false,
      isLoading: false,
      containerLevel: 1,
      fillingSpeed: 1,
      containerSnot: 0,
      gameStarted: false,
      highestLevel: 1,
      consecutiveLoginDays: 0
    };
  }
  
  /**
   * Запускает автоматическое сохранение
   */
  private startAutoSave(): void {
    // Очищаем предыдущий таймер, если есть
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    
    // Устанавливаем новый таймер
    if (this.options.autoSaveInterval > 0) {
      this.autoSaveTimer = setInterval(() => {
        if (this.currentState) {
          this.save(this.currentState)
            .catch(error => {
              if (this.options.debugMode) {
                console.error(`[SaveSystem] Ошибка автосохранения:`, error);
              }
            });
        }
      }, this.options.autoSaveInterval);
      
      if (this.options.debugMode) {
        console.log(`[SaveSystem] Автосохранение запущено с интервалом ${this.options.autoSaveInterval}мс`);
      }
    }
  }
  
  /**
   * Останавливает автоматическое сохранение
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
      
      if (this.options.debugMode) {
        console.log(`[SaveSystem] Автосохранение остановлено`);
      }
    }
  }

  /**
   * Обработчик закрытия страницы
   */
  private handlePageClose = (event: BeforeUnloadEvent): void => {
    // Сохраняем текущее состояние при закрытии страницы
    if (this.currentState) {
      // Используем синхронное сохранение для надежности
      try {
        // Сериализуем состояние
        const serializedState = JSON.stringify(this.currentState);
        
        // Сохраняем в локальное хранилище напрямую
        localStorage.setItem(`${this.userId}_${StorageKeys.GAME_STATE}`, serializedState);
        
        // Обновляем счетчик сохранений и время
        this.saveCounter++;
        this.lastSaveTime = Date.now();
      } catch (error) {
        console.error(`[SaveSystem] Ошибка сохранения при закрытии страницы:`, error);
      }
    }
  };
  
  /**
   * Сохраняет состояние игры
   * @param state Состояние игры для сохранения
   * @param forceFull Принудительное полное сохранение
   * @returns Результат сохранения
   */
  public async save(state: ExtendedGameState, forceFull: boolean = false): Promise<SaveResult> {
    const startTime = Date.now();
    
    try {
      // Проверяем инициализацию
      if (!this.isInitialized) {
        console.warn(`[SaveSystem] Попытка сохранения до инициализации системы, userId: ${this.userId}`);
        
        return {
          success: false,
          message: "Система сохранения не инициализирована",
          error: "SaveSystem не инициализирована",
          timestamp: Date.now(),
          metrics: {
            duration: Date.now() - startTime
          }
        };
      }
      
      // Проверяем наличие userId в состоянии
      if (!state._userId) {
        console.warn(`[SaveSystem] В состоянии отсутствует _userId, используем userId из SaveSystem: ${this.userId}`);
        state = {
          ...state,
          _userId: this.userId
        };
      } else if (state._userId !== this.userId) {
        console.error(`[SaveSystem] Несоответствие userId: ${state._userId} (в состоянии) vs ${this.userId} (в SaveSystem)`);
      }
      
      console.log(`[SaveSystem] Начинаем сохранение для пользователя ${this.userId}, forceFull=${forceFull}`);
      
      // Сохраняем предыдущее состояние
      this.previousState = this.currentState ? JSON.parse(JSON.stringify(this.currentState)) : null;
      
      // Обновляем текущее состояние
      this.currentState = state;
      
      // Определяем тип сохранения (полное или дельта)
      let saveMethod = 'full';
      let metrics: Record<string, any> = {};
      
      if (this.options.optimizeSaves && !forceFull && this.previousState) {
        // Создаем дельту между состояниями
        const delta = createDelta(
          this.previousState, 
          state, 
          state._userId || 'unknown', 
          state._saveVersion || 0
        );
        
        // Если дельта содержит изменения, сохраняем её
        if (delta && delta.delta && delta.delta.length > 0) {
          // TODO: В полной реализации здесь будет сохранение дельты
          // Сейчас просто сохраняем полное состояние для совместимости
          
          saveMethod = 'delta';
          metrics.deltaSize = JSON.stringify(delta).length;
          metrics.changeCount = delta.delta.length;
          console.log(`[SaveSystem] Создана дельта с ${delta.delta.length} изменениями`);
        } else {
          console.log(`[SaveSystem] Дельта не содержит изменений, пропускаем сохранение`);
        }
      }
      
      // Сохраняем в локальное хранилище
      console.log(`[SaveSystem] Сохраняем в локальное хранилище, метод: ${saveMethod}`);
      const storageResult = await this.storage.saveGameState(state);
      
      if (!storageResult.success) {
        console.error(`[SaveSystem] Ошибка сохранения в хранилище:`, storageResult.error);
        throw new Error(`Ошибка сохранения в хранилище: ${storageResult.error}`);
      }
      
      console.log(`[SaveSystem] Сохранение в локальное хранилище успешно`);
      
      // Оцениваем эффективность сжатия
      if (this.options.debugMode) {
        const compressionEstimate = estimateCompression(state);
        metrics.compressionEstimate = compressionEstimate;
        console.log(`[SaveSystem] Оценка сжатия:`, compressionEstimate);
      }
      
      // Синхронизируем с сервером, если включено
      if (this.options.syncWithServer && this.syncManager) {
        console.log(`[SaveSystem] Начинаем синхронизацию с сервером`);
        // Устанавливаем текущее состояние в менеджер синхронизации
        this.syncManager.setLocalState(state);
        
        // Запускаем синхронизацию
        const syncResult = await this.syncManager.syncIfNeeded();
        
        if (syncResult) {
          metrics.syncResult = {
            success: syncResult.success,
            duration: syncResult.metrics?.syncDuration,
            syncMethod: syncResult.appliedChanges ? 'delta' : 'full'
          };
          console.log(`[SaveSystem] Синхронизация завершена: ${syncResult.success ? 'успешно' : 'с ошибками'}`);
          } else {
          console.log(`[SaveSystem] Синхронизация не требуется`);
          }
        } else {
        console.log(`[SaveSystem] Синхронизация с сервером отключена`);
      }
      
      // Обновляем статистику сохранений
      this.saveCounter++;
      this.lastSaveTime = Date.now();
      
      // Формируем результат
      const saveSize = JSON.stringify(state).length;
      console.log(`[SaveSystem] Сохранение завершено успешно, размер: ${saveSize} байт`);
      
      return {
        success: true,
        message: `Состояние успешно сохранено (${saveMethod})`,
        data: {
          saveMethod,
          saveCounter: this.saveCounter,
          metrics
        },
        timestamp: Date.now(),
        metrics: {
          duration: Date.now() - startTime,
          dataSize: saveSize,
          ...metrics
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[SaveSystem] Ошибка сохранения:`, error);
      
      if (this.options.debugMode) {
        console.error(`[SaveSystem] Ошибка сохранения:`, error);
      }
      
      return {
        success: false,
        message: "Ошибка при сохранении состояния",
        error: errorMessage,
        timestamp: Date.now(),
        metrics: {
          duration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Загружает состояние игры
   * @returns Результат загрузки
   */
  public async load(): Promise<SaveResult> {
    const startTime = Date.now();
    
    try {
      // Загружаем состояние из хранилища
      const storageResult = await this.storage.loadGameState();
      
      if (!storageResult.success || !storageResult.data) {
        // Если в локальном хранилище нет данных, пытаемся синхронизировать с сервером
        if (this.options.syncWithServer && this.syncManager) {
          const syncResult = await this.syncManager.sync(true);
          
          if (syncResult.success && syncResult.syncedData) {
            // Если синхронизация успешна, преобразуем данные в состояние
            const loadedState = this.structuredToGameState(syncResult.syncedData);
            
            // Проверяем целостность данных
            if (this.options.validateOnLoad) {
              this.currentState = validateAndRepairGameState(loadedState);
            } else {
              this.currentState = loadedState;
            }
            
            return {
              success: true,
              message: "Состояние загружено с сервера",
              data: { state: this.currentState, source: "server" },
              timestamp: Date.now(),
              metrics: {
                duration: Date.now() - startTime,
                dataSize: JSON.stringify(this.currentState).length
              }
            };
          }
        }
        
        // Если данных нет нигде, создаем новое состояние
        this.currentState = this.createDefaultState();
        
        return {
          success: true,
          message: "Создано новое состояние (данные не найдены)",
          data: { state: this.currentState, source: "default" },
          timestamp: Date.now(),
          metrics: {
            duration: Date.now() - startTime,
            dataSize: JSON.stringify(this.currentState).length
          }
        };
      }
      
      // Проверяем целостность загруженных данных
      if (this.options.validateOnLoad) {
        this.currentState = validateAndRepairGameState(storageResult.data);
      } else {
        this.currentState = storageResult.data;
      }
      
      if (this.options.debugMode) {
        console.log(`[SaveSystem] Загрузка завершена за ${Date.now() - startTime}мс`);
      }
      
      return {
        success: true,
        message: "Состояние успешно загружено",
        data: { state: this.currentState, source: "local" },
        timestamp: Date.now(),
        metrics: {
          duration: Date.now() - startTime,
          dataSize: JSON.stringify(this.currentState).length
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (this.options.debugMode) {
        console.error(`[SaveSystem] Ошибка загрузки:`, error);
      }
      
      // В случае ошибки создаем новое состояние
      this.currentState = this.createDefaultState();
      
      return {
        success: false,
        message: "Ошибка при загрузке состояния, создано новое",
        error: errorMessage,
        data: { state: this.currentState, source: "default_after_error" },
        timestamp: Date.now(),
        metrics: {
          duration: Date.now() - startTime
        }
      };
    }
  }
  
  /**
   * Преобразует структурированное сохранение в объект состояния игры
   * @param structuredSave Структурированное сохранение
   * @returns Объект состояния игры
   */
  private structuredToGameState(structuredSave: StructuredGameSave): ExtendedGameState {
    // Объединяем все части в одно состояние
    const gameState: ExtendedGameState = {
      // Критические данные
      _saveVersion: structuredSave.critical.metadata.version,
      _lastModified: structuredSave.critical.metadata.lastModified,
      _userId: structuredSave.critical.metadata.userId,
      
      // Основные игровые элементы
      inventory: structuredSave.critical.inventory,
      upgrades: structuredSave.critical.upgrades,
      container: structuredSave.critical.container || {
        level: 1,
        capacity: 100,
        currentAmount: 0,
        fillRate: 1
      },
      
      // Обычные данные
      items: structuredSave.regular?.items || [],
      achievements: structuredSave.regular?.achievements || { unlockedAchievements: [] },
      stats: structuredSave.regular?.stats || {},
      
      // Настройки
      settings: structuredSave.extended?.settings || {
        language: 'en',
        theme: 'light',
        notifications: true,
        tutorialCompleted: false
      },
      
      soundSettings: structuredSave.extended?.soundSettings || {
        clickVolume: 0.5,
        effectsVolume: 0.5,
        backgroundMusicVolume: 0.3,
        isMuted: false,
        isEffectsMuted: false,
        isBackgroundMusicMuted: false
      },
      
      // Базовые поля состояния
      activeTab: 'main',
      user: null,
      validationStatus: "pending",
      hideInterface: false,
      isPlaying: false,
      isLoading: false,
      containerLevel: structuredSave.critical.upgrades.containerLevel || 1,
      fillingSpeed: structuredSave.critical.inventory.fillingSpeed || 1,
      containerSnot: structuredSave.critical.inventory.containerSnot || 0,
      gameStarted: true,
      highestLevel: structuredSave.regular?.stats?.highestLevel || 1,
      consecutiveLoginDays: structuredSave.regular?.stats?.consecutiveLoginDays || 0,
      
      // Расширенные данные
      logs: structuredSave.extended?.logs || [],
      analytics: structuredSave.extended?.analytics || {}
    };
    
    return gameState;
  }
  
  /**
   * Получает текущее состояние
   * @returns Текущее состояние или null
   */
  public getCurrentState(): ExtendedGameState | null {
    return this.currentState;
  }
  
  /**
   * Получает информацию о сохранении
   * @returns Информация о сохранении
   */
  public async getSaveInfo(): Promise<SaveInfo> {
    // Получаем метаданные из хранилища
    const metadata = await this.storage.getSaveMetadata();
    
    // Получаем информацию о синхронизации
    let syncInfo: SyncInfo | null = null;
    if (this.syncManager) {
      syncInfo = this.syncManager.getLastSyncInfo();
    }
    
    return {
      lastSaved: new Date(this.lastSaveTime || (metadata?.lastSaved || Date.now())),
      version: metadata?.saveVersion || 0,
      saveCount: this.saveCounter,
      hasLocalBackup: metadata !== null,
      hasSyncedBackup: syncInfo !== null,
      lastSync: syncInfo ? new Date(syncInfo.lastSyncTimestamp) : undefined
    };
  }
  
  /**
   * Очищает все сохраненные данные
   * @returns Результат операции
   */
  public async clearAll(): Promise<SaveResult> {
    const startTime = Date.now();
    
    try {
      // Очищаем данные в хранилище
      const clearResult = await this.storage.clearUserData();
      
      if (!clearResult.success) {
        throw new Error(`Ошибка очистки хранилища: ${clearResult.error}`);
      }
      
      // Сбрасываем локальное состояние
      this.currentState = this.createDefaultState();
      this.previousState = null;
      this.saveCounter = 0;
      this.lastSaveTime = 0;
      
      // Сбрасываем данные в менеджере синхронизации
      if (this.syncManager) {
        this.syncManager.resetLocalData();
      }
      
      if (this.options.debugMode) {
        console.log(`[SaveSystem] Данные успешно очищены`);
      }
      
      return {
        success: true,
        message: "Все данные успешно очищены",
        timestamp: Date.now(),
        metrics: {
          duration: Date.now() - startTime
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (this.options.debugMode) {
        console.error(`[SaveSystem] Ошибка очистки данных:`, error);
      }
      
      return {
        success: false,
        message: "Ошибка при очистке данных",
        error: errorMessage,
        timestamp: Date.now(),
        metrics: {
          duration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Экспортирует состояние в сжатую строку для передачи
   * @returns Строка с сжатым состоянием
   */
  public async exportState(): Promise<string | null> {
    if (!this.currentState) {
      return null;
    }
    
    try {
      // Сжимаем текущее состояние
      const compressed = compressGameState(
        this.currentState,
        this.userId,
        {
          algorithm: CompressionAlgorithm.LZ_BASE64,
          includeIntegrityInfo: true,
          removeTempData: true,
          removeLogs: true
        }
      );
      
      // Возвращаем строку с сжатыми данными
      return JSON.stringify(compressed);
    } catch (error) {
      if (this.options.debugMode) {
        console.error(`[SaveSystem] Ошибка экспорта состояния:`, error);
      }
      return null;
    }
  }

  /**
   * Импортирует состояние из сжатой строки
   * @param exportedState Строка с экспортированным состоянием
   * @returns Результат операции
   */
  public async importState(exportedState: string): Promise<SaveResult> {
    const startTime = Date.now();
    
    try {
      // Парсим строку в объект
      const compressed = JSON.parse(exportedState);
      
      // Проверяем, что это действительно сжатое состояние
      if (!compressed._isCompressed) {
        throw new Error("Неверный формат экспортированных данных");
      }
      
      // Распаковываем состояние
      const decompressed = decompressGameState(compressed);
      
      if (!decompressed) {
        throw new Error("Ошибка декомпрессии данных");
      }
      
      // Проверяем целостность данных
      if (this.options.validateOnLoad) {
        this.currentState = validateAndRepairGameState(decompressed);
      } else {
        this.currentState = decompressed;
      }
      
      // Сохраняем импортированное состояние
      await this.save(this.currentState, true);
      
      return {
        success: true,
        message: "Состояние успешно импортировано",
        data: { state: this.currentState },
        timestamp: Date.now(),
        metrics: {
          duration: Date.now() - startTime
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (this.options.debugMode) {
        console.error(`[SaveSystem] Ошибка импорта состояния:`, error);
      }
      
      return {
        success: false,
        message: "Ошибка при импорте состояния",
        error: errorMessage,
        timestamp: Date.now(),
        metrics: {
          duration: Date.now() - startTime
        }
      };
    }
  }
  
  /**
   * Уничтожает экземпляр системы сохранения
   */
  public destroy(): void {
    // Останавливаем автосохранение
    this.stopAutoSave();
    
    // Удаляем обработчик закрытия страницы
    if (this.options.saveOnPageClose && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handlePageClose);
    }
    
    // Очищаем состояние
    this.currentState = null;
    this.previousState = null;
    
    if (this.options.debugMode) {
      console.log(`[SaveSystem] Система сохранения уничтожена`);
    }
  }
} 