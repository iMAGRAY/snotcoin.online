/**
 * Менеджер синхронизации данных сохранения
 * Обеспечивает двустороннюю синхронизацию между локальным и удаленным хранилищем
 */

import { ExtendedGameState } from "../types/gameTypes";
import { 
  StructuredGameSave, 
  SaveStateInfo, 
  DeltaGameState,
  CompressedGameState,
  gameStateToStructured,
  structuredToGameState,
  CompressionAlgorithm
} from "../types/saveTypes";

import { compressGameState, decompressGameState } from "./dataCompression";
import { createDelta, applyDelta, hasSignificantChanges, generateUniqueId } from "./deltaCompression";
import { validateAndRepairGameState, verifyStructuredSaveIntegrity, DataIntegrityResult } from "./dataIntegrity";

/**
 * Информация о синхронизации данных
 */
export interface SyncInfo {
  // Последнее время синхронизации
  lastSyncTimestamp: number;
  
  // Метод синхронизации (полная или дельта)
  syncMethod: 'full' | 'delta';
  
  // Статус синхронизации
  syncStatus: 'success' | 'partial' | 'failed';
  
  // ID пользователя
  userId: string;
  
  // Дополнительная информация
  userData?: {
    id: string;
    clientId?: string;
  };
}

/**
 * Опции для синхронизации
 */
interface SyncOptions {
  // Стратегия разрешения конфликтов
  conflictResolution: 'client-wins' | 'server-wins' | 'merge' | 'manual';
  
  // Частота автоматической синхронизации (в миллисекундах)
  autoSyncInterval?: number;
  
  // Какие данные обязательно синхронизировать
  syncCritical?: boolean;
  syncRegular?: boolean;
  syncExtended?: boolean;
  
  // Должны ли данные сжиматься при передаче
  compressData?: boolean;
  
  // Тайм-аут для операций синхронизации (в миллисекундах)
  timeout?: number;
  
  // Максимальное количество попыток синхронизации
  maxRetries?: number;
  
  // Включить логирование действий синхронизации
  enableLogging?: boolean;
  
  // Ограничение на размер передаваемых данных (в байтах)
  maxDataSize?: number;
  
  // Функция обработки ошибок синхронизации
  onError?: (error: Error) => void;
  
  // Функция уведомления об успешной синхронизации
  onSuccess?: (syncInfo: SyncInfo) => void;
  
  // Функция для сравнения состояний при разрешении конфликтов
  stateComparator?: (localState: ExtendedGameState, remoteState: ExtendedGameState) => number;
}

/**
 * Результат операции синхронизации
 */
interface SyncResult {
  success: boolean;
  timestamp: number;
  syncedData?: StructuredGameSave;
  appliedChanges?: DeltaGameState;
  error?: string;
  statusCode?: number;
  message?: string;
  attempts?: number;
  conflicts?: Array<{
    field: string;
    localValue: any;
    remoteValue: any;
    resolvedValue: any;
    resolutionStrategy: string;
  }>;
  metrics?: {
    syncDuration: number;
    dataSize: number;
    compressedSize?: number;
    compressionRatio?: number;
  };
}

/**
 * Менеджер синхронизации данных
 */
export class SyncManager {
  private userId: string;
  private options: SyncOptions;
  private lastSyncTimestamp: number = 0;
  private autoSyncInterval: NodeJS.Timeout | undefined;
  private syncInProgress: boolean = false;
  private localState: ExtendedGameState | null = null;
  private remoteState: ExtendedGameState | null = null;
  private lastSyncInfo: SyncInfo | null = null;
  private syncQueue: Array<() => Promise<void>> = [];
  
  /**
   * Создает менеджер синхронизации
   * @param userId Идентификатор пользователя
   * @param options Опции синхронизации
   */
  constructor(userId: string, options: Partial<SyncOptions> = {}) {
    this.userId = userId;
    
    // Устанавливаем опции по умолчанию
    this.options = {
      conflictResolution: 'merge',
      autoSyncInterval: 5 * 60 * 1000, // 5 минут
      syncCritical: true,
      syncRegular: true,
      syncExtended: false,
      compressData: true,
      timeout: 30000, // 30 секунд
      maxRetries: 3,
      enableLogging: false,
      maxDataSize: 1024 * 1024, // 1 МБ
      ...options
    };
    
    // Запускаем периодическую синхронизацию, если задан интервал
    if (this.options.autoSyncInterval) {
      this.startAutoSync();
    }
  }
  
  /**
   * Запускает автоматическую синхронизацию
   */
  public startAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }
    
    if (this.options.autoSyncInterval && this.options.autoSyncInterval > 0) {
      this.autoSyncInterval = setInterval(() => {
        this.syncIfNeeded();
      }, this.options.autoSyncInterval);
      
      if (this.options.enableLogging) {
        console.log(`[SyncManager] Автосинхронизация запущена с интервалом ${this.options.autoSyncInterval}мс`);
      }
    }
  }
  
  /**
   * Останавливает автоматическую синхронизацию
   */
  public stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = undefined;
      
      if (this.options.enableLogging) {
        console.log('[SyncManager] Автосинхронизация остановлена');
      }
    }
  }
  
  /**
   * Синхронизирует состояние игры с сервером
   * @param forceSync Принудительная синхронизация
   * @returns Результат синхронизации
   */
  public async sync(forceSync: boolean = false): Promise<SyncResult> {
    const startTime = Date.now();
    
    // Проверяем, идет ли уже синхронизация
    if (this.syncInProgress) {
      // Добавляем в очередь
      return new Promise((resolve, reject) => {
        this.syncQueue.push(async () => {
          try {
            const result = await this._performSync(forceSync);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }
    
    try {
      this.syncInProgress = true;
      const result = await this._performSync(forceSync);
      
      // Выполняем задачи из очереди
      if (this.syncQueue.length > 0) {
        const nextTask = this.syncQueue.shift();
        if (nextTask) {
          nextTask().catch(error => {
            console.error('[SyncManager] Ошибка при выполнении задачи из очереди:', error);
          });
        }
      }
      
      return result;
    } finally {
      this.syncInProgress = false;
    }
  }
  
  /**
   * Синхронизирует данные с сервером, если необходимо
   * @returns Результат синхронизации или null если синхронизация не требуется
   */
  public async syncIfNeeded(): Promise<SyncResult | null> {
    console.log(`[SyncManager] Проверка необходимости синхронизации для пользователя ${this.userId}`);
    
    try {
      // Если нет состояния, нечего синхронизировать
      if (!this.localState) {
        console.log(`[SyncManager] Локальное состояние отсутствует, синхронизация не требуется`);
        return null;
      }
      
      // Проверяем время последней синхронизации
      const now = Date.now();
      const lastSync = this.lastSyncTimestamp || 0;
      const syncInterval = this.options.autoSyncInterval || 5 * 60 * 1000; // 5 минут по умолчанию
      
      if (now - lastSync < syncInterval) {
        console.log(`[SyncManager] Синхронизация не требуется: прошло ${(now - lastSync) / 1000} сек. (интервал ${syncInterval / 1000} сек.)`);
        return null;
      }
      
      console.log(`[SyncManager] Запуск синхронизации: прошло ${(now - lastSync) / 1000} сек. (интервал ${syncInterval / 1000} сек.)`);
      
      // Выполняем синхронизацию
      const result = await this.sync();
      return result;
    } catch (error) {
      console.error(`[SyncManager] Ошибка при проверке необходимости синхронизации:`, error);
      
      // Возвращаем информацию об ошибке
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        timestamp: Date.now(),
        attempts: 1
      };
    }
  }
  
  /**
   * Выполняет фактическую синхронизацию
   * @param forceSync Принудительная полная синхронизация
   * @returns Результат синхронизации
   */
  private async _performSync(forceSync: boolean): Promise<SyncResult> {
    if (this.options.enableLogging) {
      console.log(`[SyncManager] Начата синхронизация (принудительная: ${forceSync})`);
    }
    
    const startTime = Date.now();
    const result: SyncResult = {
      success: false,
      timestamp: startTime,
      metrics: {
        syncDuration: 0,
        dataSize: 0
      }
    };
    
    try {
      // Проверяем локальное состояние
      if (!this.localState) {
        throw new Error('Локальное состояние не инициализировано');
      }
      
      // Получаем информацию о последнем сохранении на сервере
      const serverSaveInfo = await this._fetchServerSaveInfo();
      
      // Проверяем, нужна ли синхронизация
      if (!forceSync && 
          serverSaveInfo.lastModified <= this.lastSyncTimestamp &&
          (!this.remoteState || !hasSignificantChanges(this.localState, this.remoteState))) {
        // Синхронизация не требуется, данные на сервере не изменились
        result.success = true;
        result.syncedData = gameStateToStructured(this.localState);
        result.metrics!.syncDuration = Date.now() - startTime;
        result.metrics!.dataSize = 0;
        
        if (this.options.enableLogging) {
          console.log('[SyncManager] Синхронизация не требуется');
        }
        
        return result;
      }
      
      // Если данные на сервере новее или равны по времени
      if (serverSaveInfo.lastModified >= this.lastSyncTimestamp) {
        // Загружаем данные с сервера
        const serverSave = await this._fetchServerSave();
        
        // Проверяем целостность данных с сервера
        const integrityResult = await this._verifyServerData(serverSave);
        if (!integrityResult.isValid) {
          if (this.options.enableLogging) {
            console.warn('[SyncManager] Ошибка целостности данных с сервера:', integrityResult.errors);
          }
          
          // Используем локальные данные, если серверные повреждены
          result.error = 'Ошибка целостности данных с сервера';
          
          // Отправляем локальные данные на сервер
          await this._pushLocalState(forceSync);
          
          result.success = true;
          result.syncedData = gameStateToStructured(this.localState);
          result.metrics!.syncDuration = Date.now() - startTime;
          return result;
        }
        
        // Конвертируем структурированное сохранение в объект состояния
        this.remoteState = structuredToGameState(serverSave);
        
        // Разрешаем конфликты в зависимости от выбранной стратегии
        const resolvedState = this._resolveConflicts(this.localState, this.remoteState);
        this.localState = resolvedState;
        
        // Отправляем обновленное состояние на сервер, если локальные изменения имеют приоритет
        if (this.options.conflictResolution === 'client-wins' || 
            this.options.conflictResolution === 'merge') {
          await this._pushLocalState(forceSync);
        }
      } else {
        // Локальные данные новее, отправляем их на сервер
        await this._pushLocalState(forceSync);
      }
      
      // Обновляем время последней синхронизации
      this.lastSyncTimestamp = Date.now();
      
      // Создаем информацию о синхронизации
      this._updateSyncInfo('success', forceSync ? 'full' : 'delta');
      
      result.success = true;
      result.syncedData = gameStateToStructured(this.localState);
      result.metrics!.syncDuration = Date.now() - startTime;
      
      if (this.options.enableLogging) {
        console.log(`[SyncManager] Синхронизация завершена успешно за ${result.metrics!.syncDuration}мс`);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      result.success = false;
      result.error = errorMessage;
      result.metrics!.syncDuration = Date.now() - startTime;
      
      if (this.options.enableLogging) {
        console.error('[SyncManager] Ошибка синхронизации:', errorMessage);
      }
      
      // Вызываем обработчик ошибок
      if (this.options.onError) {
        this.options.onError(error instanceof Error ? error : new Error(errorMessage));
      }
      
      return result;
    }
  }
  
  /**
   * Получает информацию о сохранении с сервера
   * @returns Информация о сохранении
   */
  private async _fetchServerSaveInfo(): Promise<SaveStateInfo> {
    // TODO: Реализовать реальный API запрос к серверу
    // Пример заглушки для тестирования
    return {
      userId: this.userId,
      saveExists: true,
      lastModified: Date.now() - 60000, // 1 минуту назад
      version: 1,
      size: 0
    };
  }
  
  /**
   * Получает сохранение с сервера
   * @returns Структурированное сохранение
   */
  private async _fetchServerSave(): Promise<StructuredGameSave> {
    // TODO: Реализовать реальный API запрос к серверу
    
    // Пример заглушки для тестирования
    if (this.remoteState) {
      return gameStateToStructured(this.remoteState);
    }
    
    // Возвращаем конвертированное локальное состояние, если удаленное не инициализировано
    return gameStateToStructured(this.localState!);
  }
  
  /**
   * Отправляет локальное состояние на сервер
   * @param fullSync Отправка полного состояния
   */
  private async _pushLocalState(fullSync: boolean): Promise<void> {
    if (!this.localState) {
      throw new Error('Локальное состояние не инициализировано');
    }
    
    // Преобразуем локальное состояние в структурированный формат
    const structuredSave = gameStateToStructured(this.localState);
    
    if (fullSync || !this.remoteState) {
      // Отправляем полное состояние
      await this._pushFullState(structuredSave);
    } else {
      // Создаем и отправляем дельту
      const delta = createDelta(
        this.remoteState, 
        this.localState, 
        this.userId, 
        this.remoteState?._saveVersion || 0
      );
      
      // Если дельта пустая, нечего отправлять
      if (!delta || !delta.delta || delta.delta.length === 0) {
        if (this.options.enableLogging) {
          console.log('[SyncManager] Нет изменений для отправки');
        }
        return;
      }
      
      // Преобразуем в формат DeltaGameState для совместимости с API
      const apiDelta: DeltaGameState = {
        _id: generateUniqueId(this.userId),
        _baseVersion: this.remoteState?._saveVersion || 0,
        _newVersion: this.localState?._saveVersion || 1,
        _createdAt: Date.now(),
        _clientId: 'client-' + Date.now().toString(36),
        _isFullState: false,
        changes: delta.delta,
        delta: delta.delta
      };
      
      await this._pushDeltaState(apiDelta);
    }
  }
  
  /**
   * Отправляет полное состояние на сервер
   * @param structuredSave Структурированное сохранение
   */
  private async _pushFullState(structuredSave: StructuredGameSave): Promise<void> {
    try {
      if (this.options.enableLogging) {
        console.log('[SyncManager] Отправка полного состояния на сервер');
      }
      
      // Получаем токен авторизации
      const token = this._getAuthToken();
      if (!token) {
        throw new Error('Отсутствует токен авторизации');
      }
      
      // Сжимаем данные перед отправкой
      let compressedData = null;
      let isCompressed = false;
      
      // Функция compressGameState асинхронная, поэтому важно использовать await,
      // чтобы дождаться завершения сжатия данных перед продолжением выполнения
      if (this.options.compressData && this.localState) {
        compressedData = await compressGameState(
          this.localState, 
          this.userId, 
          {
            algorithm: CompressionAlgorithm.LZ_UTF16,
            removeTempData: true,
            includeIntegrityInfo: true
          }
        );
        
        isCompressed = !!compressedData;
        
        if (compressedData && this.options.enableLogging) {
          const compressionRatio = compressedData._compressedSize / compressedData._originalSize * 100; 
          console.log(`[SyncManager] Данные сжаты (${compressionRatio.toFixed(2)}%): ${compressedData._compressedSize}/${compressedData._originalSize} байт`);
        }
      }
      
      // Выполняем запрос к API
      const response = await fetch('/api/game/save-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          progress: {
            userId: this.userId,
            gameState: structuredSave,
            compressedData: isCompressed ? compressedData : null,
            isCompressed,
            clientTimestamp: new Date().toISOString()
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при сохранении прогресса');
      }
      
      // Обновляем время последней синхронизации
      this.lastSyncTimestamp = Date.now();
      
      if (this.options.enableLogging) {
        console.log('[SyncManager] Полное состояние успешно отправлено на сервер');
      }
    } catch (error) {
      console.error('[SyncManager] Ошибка при отправке полного состояния:', error);
      throw error;
    }
  }
  
  /**
   * Отправляет дельту состояния на сервер
   * @param delta Дельта состояния
   * @param options Дополнительные опции синхронизации
   * @returns Результат операции синхронизации
   */
  private async _pushDeltaState(
    delta: DeltaGameState, 
    options: Partial<SyncOptions> = {}
  ): Promise<SyncResult> {
    try {
      // Включаем логирование, если нужно
      if (options.enableLogging || this.options.enableLogging) {
        console.log('[SyncManager] Отправка дельты состояния на сервер');
      }
      
      // Получаем токен авторизации
      const token = this._getAuthToken();
      
      if (!token) {
        console.error('[SyncManager] Ошибка синхронизации: отсутствует токен авторизации');
        return {
          success: false,
          timestamp: Date.now(),
          error: 'Отсутствует токен авторизации'
        };
      }
      
      // Формируем заголовки запроса
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      // Отправляем запрос на сохранение дельты
      const response = await fetch('/api/game/save-delta', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: this.userId,
          delta: delta,
          baseVersion: delta._baseVersion,
          newVersion: delta._newVersion,
          timestamp: delta._createdAt
        })
      });
      
      // Проверяем успешность запроса
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Ошибка сохранения дельты:', errorData);
        
        return {
          success: false,
          error: errorData.error || 'Ошибка сохранения дельты',
          statusCode: response.status,
          timestamp: Date.now(),
          attempts: 1
        };
      }
      
      // Получаем данные ответа
      const result = await response.json();
      
      // Обновляем время последней синхронизации
      this.lastSyncTimestamp = Date.now();
      
      // Логируем успешную синхронизацию
      if (options.enableLogging || this.options.enableLogging) {
        console.log('Дельта успешно сохранена на сервере:', result);
      }
      
      return {
        success: true,
        message: result.message || 'Дельта успешно сохранена',
        attempts: 1,
        timestamp: this.lastSyncTimestamp
      };
    } catch (error) {
      console.error('Ошибка при сохранении дельты:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        timestamp: Date.now(),
        attempts: 1
      };
    }
  }
  
  /**
   * Получает токен авторизации из localStorage
   */
  private _getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }
  
  /**
   * Разрешает конфликты между локальным и удаленным состояниями
   * @param localState Локальное состояние
   * @param remoteState Удаленное состояние
   * @returns Разрешенное состояние
   */
  private _resolveConflicts(
    localState: ExtendedGameState, 
    remoteState: ExtendedGameState
  ): ExtendedGameState {
    // Стратегия разрешения конфликтов
    switch (this.options.conflictResolution) {
      case 'client-wins':
        // Локальное состояние имеет приоритет
        return { ...localState };
        
      case 'server-wins':
        // Серверное состояние имеет приоритет
        return { ...remoteState };
        
      case 'merge':
        // Объединяем состояния, приоритет у критических данных в зависимости от их ценности
        const mergedState = this._mergeStates(localState, remoteState);
        return mergedState;
        
      case 'manual':
        // Ручное разрешение конфликтов (заглушка, реальная реализация зависит от UI)
        // TODO: Реализовать пользовательский интерфейс для ручного разрешения конфликтов
        return this._mergeStates(localState, remoteState);
        
      default:
        // По умолчанию объединяем
        return this._mergeStates(localState, remoteState);
    }
  }
  
  /**
   * Объединяет локальное и удаленное состояния
   * @param localState Локальное состояние
   * @param remoteState Удаленное состояние
   * @returns Объединенное состояние
   */
  private _mergeStates(
    localState: ExtendedGameState, 
    remoteState: ExtendedGameState
  ): ExtendedGameState {
    // Создаем глубокую копию локального состояния как основу
    const mergedState: ExtendedGameState = JSON.parse(JSON.stringify(localState));
    
    // Получаем время последнего обновления
    const localTimestamp = localState._lastModified || 0;
    const remoteTimestamp = remoteState._lastModified || 0;
    
    // Определяем, какие данные новее
    const isLocalNewer = localTimestamp > remoteTimestamp;
    
    // Объединяем критические данные (валюта, уровни и т.д.)
    if (localState.inventory && remoteState.inventory) {
      // Для критических ресурсов берем максимальное значение или новейшее
      mergedState.inventory = {
        ...mergedState.inventory,
        snot: Math.max(localState.inventory.snot || 0, remoteState.inventory.snot || 0),
        snotCoins: Math.max(localState.inventory.snotCoins || 0, remoteState.inventory.snotCoins || 0),
      };
      
      // Для уровней прокачки берем максимальный
      mergedState.inventory.containerCapacityLevel = Math.max(
        localState.inventory.containerCapacityLevel || 0, 
        remoteState.inventory.containerCapacityLevel || 0
      );
      
      mergedState.inventory.fillingSpeedLevel = Math.max(
        localState.inventory.fillingSpeedLevel || 0, 
        remoteState.inventory.fillingSpeedLevel || 0
      );
      
      // Пересчитываем производные значения на основе уровней
      mergedState.inventory.containerCapacity = mergedState.inventory.containerCapacityLevel * 100; // Примерный расчет
      mergedState.inventory.fillingSpeed = mergedState.inventory.fillingSpeedLevel * 2; // Примерный расчет
    }
    
    // Объединяем улучшения
    if (localState.upgrades && remoteState.upgrades) {
      // Используем более новые улучшения или объединяем их
      if (isLocalNewer) {
        mergedState.upgrades = { ...localState.upgrades };
      } else {
        mergedState.upgrades = { ...remoteState.upgrades };
      }
    }
    
    // Объединяем достижения (всегда берем максимальный набор)
    if (localState.achievements && remoteState.achievements) {
      mergedState.achievements = {
        ...mergedState.achievements,
        unlockedAchievements: Array.from(new Set([
          ...(localState.achievements.unlockedAchievements || []),
          ...(remoteState.achievements.unlockedAchievements || [])
        ]))
      };
    }
    
    // Объединяем данные инвентаря (предметы)
    if (localState.items && remoteState.items) {
      const localItems = localState.items || [];
      const remoteItems = remoteState.items || [];
      
      // Создаем хэш-карту для быстрого поиска
      const itemsMap = new Map();
      
      // Добавляем все локальные предметы
      localItems.forEach(item => {
        itemsMap.set(item.id, item);
      });
      
      // Объединяем с удаленными, приоритет у более новых
      remoteItems.forEach(remoteItem => {
        const localItem = itemsMap.get(remoteItem.id);
        
        if (!localItem || 
            (remoteItem._lastModified && localItem._lastModified && 
             remoteItem._lastModified > localItem._lastModified)) {
          itemsMap.set(remoteItem.id, remoteItem);
        }
      });
      
      // Преобразуем обратно в массив
      mergedState.items = Array.from(itemsMap.values());
    }
    
    // Обновляем метаданные
    mergedState._lastModified = Date.now();
    mergedState._saveVersion = Math.max(
      localState._saveVersion || 0,
      remoteState._saveVersion || 0
    ) + 1; // Увеличиваем версию
    
    return mergedState;
  }
  
  /**
   * Устанавливает локальное состояние
   * @param state Состояние для установки
   */
  public setLocalState(state: ExtendedGameState): void {
    // Проверяем и восстанавливаем целостность данных
    const validatedState = validateAndRepairGameState(state);
    this.localState = validatedState;
    
    if (this.options.enableLogging) {
      console.log('[SyncManager] Установлено локальное состояние');
    }
  }
  
  /**
   * Получает текущее локальное состояние
   * @returns Локальное состояние
   */
  public getLocalState(): ExtendedGameState | null {
    return this.localState;
  }
  
  /**
   * Получает последнюю информацию о синхронизации
   * @returns Информация о синхронизации или null
   */
  public getLastSyncInfo(): SyncInfo | null {
    return this.lastSyncInfo;
  }
  
  /**
   * Сбрасывает локальные данные
   */
  public resetLocalData(): void {
    this.localState = null;
    this.lastSyncTimestamp = 0;
    this.lastSyncInfo = null;
    
    if (this.options.enableLogging) {
      console.log('[SyncManager] Локальные данные сброшены');
    }
  }
  
  /**
   * Устанавливает опции синхронизации
   * @param options Новые опции
   */
  public setOptions(options: Partial<SyncOptions>): void {
    this.options = { ...this.options, ...options };
    
    // Обновляем настройки автосинхронизации
    if (this.options.autoSyncInterval) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
    
    if (this.options.enableLogging) {
      console.log('[SyncManager] Опции обновлены', options);
    }
  }

  /**
   * Проверяет целостность данных с сервера
   */
  private async _verifyServerData(serverData: StructuredGameSave): Promise<DataIntegrityResult> {
    // Проверяем целостность данных
    const integrityResult = verifyStructuredSaveIntegrity(serverData);
    
    // Если данные невалидны, логируем ошибку
    if (!integrityResult.isValid) {
      if (this.options.enableLogging) {
        console.error(`[SyncManager] Ошибка целостности данных с сервера:`, integrityResult.errors);
      }
    }
    
    return integrityResult;
  }

  /**
   * Обновляет информацию о синхронизации
   */
  private _updateSyncInfo(status: 'success' | 'partial' | 'failed', method: 'full' | 'delta'): void {
    this.lastSyncInfo = {
      lastSyncTimestamp: Date.now(),
      syncMethod: method,
      syncStatus: status,
      userId: this.userId,
      userData: {
        id: this.userId,
        clientId: 'browser-' + Date.now().toString(36)
      }
    };
    
    // Вызываем обработчик успешной синхронизации, если указан и синхронизация успешна
    if (status === 'success' && this.options.onSuccess && this.lastSyncInfo) {
      this.options.onSuccess(this.lastSyncInfo);
    }
  }
} 