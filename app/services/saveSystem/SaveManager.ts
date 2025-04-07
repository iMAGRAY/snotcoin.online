/**
 * Менеджер сохранений - основной класс системы сохранений
 * Управляет операциями сохранения и загрузки через различные адаптеры хранилищ
 */
import { 
  StorageType, 
  SaveResult, 
  LoadResult, 
  SaveOptions, 
  LoadOptions, 
  StorageAdapter,
  SavePriority,
  SaveMetadata
} from './types';
import { ExtendedGameState } from '../../types/gameTypes';
import { createHash, isEqual, deepMerge } from './utils';
import { adapters } from './adapters';
import { saveLogger, LogLevel, LogCategory } from './logger';

// Настройки системы сохранений по умолчанию
const DEFAULT_SAVE_OPTIONS: SaveOptions = {
  priority: SavePriority.MEDIUM,
  storageTypes: [StorageType.MEMORY, StorageType.LOCAL],
  skipIntegrityCheck: false,
  createBackup: true,
  compress: false,
  encrypt: true,
  forceClear: false,
  silent: false
};

const DEFAULT_LOAD_OPTIONS: LoadOptions = {
  storageTypes: [
    StorageType.MEMORY, 
    StorageType.LOCAL, 
    StorageType.INDEXED_DB, 
    StorageType.SERVER
  ],
  fallbackToDefault: true,
  skipIntegrityCheck: false,
  forceRefresh: false,
  timeout: 10000,
  silent: false
};

export class SaveManager {
  private adapters: Map<StorageType, StorageAdapter> = new Map();
  private saveQueue: Map<string, NodeJS.Timeout> = new Map();
  private emergencyBackups: Map<string, {data: ExtendedGameState, timestamp: number}> = new Map();
  private lastSaveTime: Map<string, number> = new Map();
  private isInitialized: boolean = false;
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private saveInProgress: boolean = false;
  private beforeUnloadHandler: ((event: BeforeUnloadEvent) => any) | null = null;
  
  // Минимальные интервалы между сохранениями разных приоритетов (в мс)
  private readonly saveIntervals = {
    [SavePriority.LOW]: 30000,      // 30 секунд
    [SavePriority.MEDIUM]: 5000,    // 5 секунд
    [SavePriority.HIGH]: 1000,      // 1 секунда
    [SavePriority.CRITICAL]: 0      // Немедленно
  };
  
  constructor() {
    // Регистрируем доступные адаптеры
    this.registerAdapters();
    
    // Логируем создание менеджера сохранений
    saveLogger.info(LogCategory.INIT, "SaveManager создан", {
      adaptersCount: this.adapters.size
    });
    
    // Устанавливаем обработчик перед выгрузкой страницы
    if (typeof window !== 'undefined') {
      this.beforeUnloadHandler = this.handleBeforeUnload;
      window.addEventListener('beforeunload', this.beforeUnloadHandler);
      saveLogger.debug(LogCategory.INIT, "Зарегистрирован обработчик beforeunload");
    }
  }
  
  /**
   * Регистрирует адаптеры хранилищ
   */
  private registerAdapters() {
    // Логируем начало регистрации адаптеров
    saveLogger.debug(LogCategory.INIT, "Начало регистрации адаптеров хранилищ");
    
    // Регистрируем все адаптеры хранилищ
    for (const adapter of adapters) {
      this.adapters.set(adapter.getType(), adapter);
      saveLogger.trace(LogCategory.INIT, `Зарегистрирован адаптер ${adapter.getType()}`);
    }
    
    saveLogger.info(LogCategory.INIT, "Адаптеры хранилищ зарегистрированы", {
      count: this.adapters.size,
      types: Array.from(this.adapters.keys())
    });
  }
  
  /**
   * Инициализирует систему сохранений
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      saveLogger.debug(LogCategory.INIT, "SaveManager уже инициализирован");
      return true;
    }
    
    saveLogger.info(LogCategory.INIT, "Начало инициализации SaveManager");
    saveLogger.startOperation('initialize', LogCategory.INIT);
    
    try {
      // Инициализируем все адаптеры
      const initPromises = Array.from(this.adapters.values()).map(adapter => {
        saveLogger.trace(LogCategory.INIT, `Инициализация адаптера ${adapter.getType()}`);
        
        // Перехватываем ошибки инициализации отдельных адаптеров
        return adapter.exists('test').catch((error) => {
          saveLogger.warn(
            LogCategory.INIT, 
            `Ошибка инициализации адаптера ${adapter.getType()}`, 
            { error }
          );
          return false;
        });
      });
      
      await Promise.all(initPromises);
      
      // Запускаем автосохранение
      this.startAutoSave();
      
      this.isInitialized = true;
      
      const duration = saveLogger.endOperation('initialize');
      saveLogger.info(
        LogCategory.INIT, 
        "SaveManager успешно инициализирован", 
        { duration, adaptersCount: this.adapters.size }
      );
      
      return true;
    } catch (error) {
      const duration = saveLogger.endOperation('initialize');
      saveLogger.error(
        LogCategory.INIT, 
        "Ошибка инициализации системы сохранений", 
        { duration }, 
        undefined, 
        undefined, 
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }
  
  /**
   * Запускает автоматическое сохранение
   */
  private startAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      saveLogger.debug(LogCategory.GENERAL, "Предыдущий интервал автосохранения очищен");
    }
    
    // Запускаем цикл проверки очереди сохранений каждые 30 секунд
    this.autoSaveInterval = setInterval(() => {
      this.processBackgroundTasks();
    }, 30000);
    
    saveLogger.info(LogCategory.GENERAL, "Запущено автоматическое сохранение", {
      interval: "30 секунд"
    });
  }
  
  /**
   * Выполняет фоновые задачи
   */
  private async processBackgroundTasks() {
    saveLogger.trace(LogCategory.GENERAL, "Выполнение фоновых задач");
    
    // Проверяем и очищаем старые бэкапы
    this.cleanupEmergencyBackups();
    
    // Другие фоновые задачи...
    
    saveLogger.trace(LogCategory.GENERAL, "Фоновые задачи завершены");
  }
  
  /**
   * Очищает старые экстренные бэкапы
   */
  private cleanupEmergencyBackups() {
    const now = Date.now();
    const MAX_BACKUP_AGE = 24 * 60 * 60 * 1000; // 24 часа
    let removedCount = 0;
    
    saveLogger.trace(LogCategory.BACKUP, "Очистка устаревших экстренных резервных копий");
    
    for (const [userId, backup] of this.emergencyBackups) {
      if (now - backup.timestamp > MAX_BACKUP_AGE) {
        this.emergencyBackups.delete(userId);
        removedCount++;
        saveLogger.debug(
          LogCategory.BACKUP, 
          `Удалена устаревшая резервная копия для пользователя ${userId}`, 
          { age: now - backup.timestamp }
        );
      }
    }
    
    if (removedCount > 0) {
      saveLogger.info(LogCategory.BACKUP, "Очистка завершена", {
        removedCount,
        remainingCount: this.emergencyBackups.size
      });
    }
  }
  
  /**
   * Обработчик события перед выгрузкой страницы
   */
  private handleBeforeUnload = (event: BeforeUnloadEvent) => {
    // Записываем экстренные сохранения в sessionStorage
    for (const [userId, backup] of this.emergencyBackups) {
      try {
        saveLogger.debug(
          LogCategory.BACKUP, 
          `Сохранение экстренной копии в sessionStorage для пользователя ${userId}`
        );
        
        const backupData = {
          data: backup.data,
          timestamp: backup.timestamp
        };
        
        sessionStorage.setItem(
          `emergency_backup_${userId}_${Date.now()}`, 
          JSON.stringify(backupData)
        );
      } catch (error) {
        // Игнорируем ошибки, чтобы не блокировать выгрузку
        saveLogger.warn(
          LogCategory.BACKUP, 
          `Не удалось сохранить экстренную копию для пользователя ${userId}`, 
          undefined, 
          userId
        );
      }
    }
  }
  
  /**
   * Создает экстренную резервную копию
   */
  createEmergencyBackup(userId: string, data: ExtendedGameState): void {
    const timestamp = Date.now();
    
    // Проверяем, была ли создана резервная копия для этого пользователя недавно
    const lastBackup = this.emergencyBackups.get(userId);
    const MIN_BACKUP_INTERVAL = 500; // Минимальный интервал между бэкапами в мс (0.5 сек)
    
    if (lastBackup && (timestamp - lastBackup.timestamp < MIN_BACKUP_INTERVAL)) {
      saveLogger.debug(
        LogCategory.BACKUP, 
        `Пропуск создания экстренной копии (создана ${timestamp - lastBackup.timestamp}мс назад)`, 
        { userId, lastBackupTime: lastBackup.timestamp },
        userId
      );
      return;
    }
    
    this.emergencyBackups.set(userId, {
      data,
      timestamp
    });
    
    saveLogger.info(
      LogCategory.BACKUP, 
      `Создана экстренная копия для пользователя ${userId}`, 
      { timestamp }, 
      userId
    );
  }
  
  /**
   * Сохраняет игровое состояние
   * @param userId ID пользователя
   * @param state Состояние игры
   * @param options Опции сохранения
   */
  async save(
    userId: string, 
    state: ExtendedGameState, 
    options: SaveOptions = {}
  ): Promise<SaveResult> {
    // Применяем опции по умолчанию
    const mergedOptions = { ...DEFAULT_SAVE_OPTIONS, ...options };
    
    // Генерируем уникальный идентификатор операции
    const operationId = `save_${userId}_${Date.now()}`;
    
    // Начинаем отслеживание длительности операции
    saveLogger.startOperation(operationId, LogCategory.SAVE);
    
    saveLogger.info(
      LogCategory.SAVE, 
      `Запрос на сохранение состояния для пользователя ${userId}`, 
      { options: mergedOptions },
      userId
    );
    
    // Проверяем минимальный интервал между сохранениями
    const now = Date.now();
    const lastSave = this.lastSaveTime.get(userId) || 0;
    const priority = mergedOptions.priority || SavePriority.MEDIUM;
    const minInterval = this.saveIntervals[priority];
    
    // Если сохранение в процессе и приоритет не критический, отложим
    if (this.saveInProgress && priority !== SavePriority.CRITICAL) {
      saveLogger.debug(
        LogCategory.SAVE, 
        `Другое сохранение уже в процессе, ставим в очередь (приоритет: ${priority})`,
        undefined,
        userId
      );
      return this.queueSave(userId, state, mergedOptions);
    }
    
    // Проверяем интервал между сохранениями
    if (now - lastSave < minInterval && priority !== SavePriority.CRITICAL) {
      saveLogger.debug(
        LogCategory.SAVE, 
        `Интервал сохранения слишком мал, ставим в очередь (интервал: ${now - lastSave}мс)`,
        { lastSave, minInterval },
        userId
      );
      return this.queueSave(userId, state, mergedOptions);
    }
    
    // Обновляем время последнего сохранения
    this.lastSaveTime.set(userId, now);
    
    // Создаем экстренную резервную копию
    if (mergedOptions.createBackup) {
      this.createEmergencyBackup(userId, state);
    }
    
    // Устанавливаем флаг сохранения в процессе
    this.saveInProgress = true;
    saveLogger.debug(LogCategory.SAVE, "Начало процесса сохранения", undefined, userId);
    
    // Обновляем метаданные состояния
    const stateWithMetadata = this.prepareStateForSaving(userId, state);
    
    try {
      // Массив для результатов сохранения
      const results: SaveResult[] = [];
      const startTime = Date.now();
      
      // Сохраняем в каждый тип хранилища
      for (const storageType of mergedOptions.storageTypes || []) {
        const adapter = this.adapters.get(storageType);
        
        if (adapter) {
          saveLogger.debug(
            LogCategory.SAVE, 
            `Сохранение в ${storageType}`, 
            undefined, 
            userId, 
            storageType
          );
          
          try {
            const result = await adapter.save(userId, stateWithMetadata, mergedOptions);
            results.push(result);
            
            saveLogger.info(
              LogCategory.SAVE, 
              `Сохранение в ${storageType} ${result.success ? 'успешно' : 'не удалось'}`, 
              { duration: result.duration, dataSize: result.dataSize }, 
              userId, 
              storageType
            );
          } catch (error) {
            saveLogger.error(
              LogCategory.SAVE, 
              `Ошибка сохранения в ${storageType}`, 
              { error }, 
              userId, 
              storageType,
              error instanceof Error ? error : new Error(String(error))
            );
            
            results.push({
              success: false,
              timestamp: Date.now(),
              source: storageType,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        } else {
          saveLogger.warn(
            LogCategory.SAVE, 
            `Адаптер для ${storageType} не найден`, 
            undefined, 
            userId
          );
        }
      }
      
      // Определяем общий результат
      const allSuccess = results.every(r => r.success);
      const duration = Date.now() - startTime;
      const operationDuration = saveLogger.endOperation(operationId);
      
      const result = {
        success: allSuccess,
        timestamp: now,
        source: results.find(r => r.success)?.source,
        duration,
        dataSize: JSON.stringify(state).length,
        metadata: {
          results,
          saveVersion: stateWithMetadata._saveVersion
        }
      };
      
      saveLogger.info(
        LogCategory.SAVE, 
        `Сохранение ${allSuccess ? 'успешно' : 'не удалось'} завершено`, 
        { 
          storageCount: results.length, 
          successCount: results.filter(r => r.success).length,
          duration,
          operationDuration
        }, 
        userId
      );
      
      return result;
    } catch (error) {
      const operationDuration = saveLogger.endOperation(operationId);
      
      saveLogger.error(
        LogCategory.SAVE, 
        "Критическая ошибка при сохранении", 
        { operationDuration }, 
        userId, 
        undefined, 
        error instanceof Error ? error : new Error(String(error))
      );
      
      return {
        success: false,
        timestamp: now,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      // Снимаем флаг сохранения в процессе
      this.saveInProgress = false;
    }
  }
  
  /**
   * Ставит сохранение в очередь с таймером
   */
  private queueSave(
    userId: string, 
    state: ExtendedGameState, 
    options: SaveOptions
  ): Promise<SaveResult> {
    // Отменяем предыдущее сохранение в очереди, если оно есть
    const existingTimer = this.saveQueue.get(userId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      saveLogger.debug(
        LogCategory.SAVE, 
        "Отменено предыдущее отложенное сохранение",
        undefined,
        userId
      );
    }
    
    // Время задержки в зависимости от приоритета
    const priority = options.priority || SavePriority.MEDIUM;
    const delay = priority === SavePriority.LOW ? 5000 : 
                 priority === SavePriority.MEDIUM ? 1000 : 300;
    
    saveLogger.info(
      LogCategory.SAVE, 
      "Сохранение поставлено в очередь", 
      { priority, delay },
      userId
    );
    
    return new Promise((resolve) => {
      // Создаем новый таймер для отложенного сохранения
      const timer = setTimeout(async () => {
        saveLogger.debug(
          LogCategory.SAVE, 
          "Выполнение отложенного сохранения", 
          undefined,
          userId
        );
        
        // Сохраняем состояние после задержки
        const result = await this.save(userId, state, {
          ...options,
          priority: SavePriority.HIGH // Повышаем приоритет для выполнения
        });
        
        // Удаляем из очереди
        this.saveQueue.delete(userId);
        
        // Разрешаем промис
        resolve(result);
      }, delay);
      
      // Сохраняем таймер в очередь
      this.saveQueue.set(userId, timer);
    });
  }
  
  /**
   * Загружает игровое состояние
   * @param userId ID пользователя
   * @param options Опции загрузки
   */
  async load(
    userId: string, 
    options: LoadOptions = {}
  ): Promise<LoadResult> {
    // Применяем опции по умолчанию
    const mergedOptions = { ...DEFAULT_LOAD_OPTIONS, ...options };
    
    // Создаем идентификатор операции для отслеживания
    const operationId = `load_${userId}_${Date.now()}`;
    saveLogger.startOperation(operationId, LogCategory.LOAD);
    
    saveLogger.info(
      LogCategory.LOAD, 
      `Запрос на загрузку состояния для пользователя ${userId}`, 
      { options: mergedOptions }, 
      userId
    );
    
    const startTime = Date.now();
    
    try {
      // Массив для результатов загрузки
      const results: LoadResult[] = [];
      
      // Загружаем из каждого типа хранилища
      for (const storageType of mergedOptions.storageTypes || []) {
        const adapter = this.adapters.get(storageType);
        
        if (adapter) {
          saveLogger.debug(
            LogCategory.LOAD, 
            `Попытка загрузки из ${storageType}`, 
            undefined, 
            userId, 
            storageType
          );
          
          try {
            const result = await adapter.load(userId, mergedOptions);
            
            // Если загрузка успешна, добавляем результат
            if (result.success && result.data) {
              results.push(result);
              
              const lastModified = result.data._lastModified || "неизвестно";
              saveLogger.info(
                LogCategory.LOAD, 
                `Успешная загрузка из ${storageType}`, 
                { 
                  timestamp: result.timestamp, 
                  lastModified,
                  duration: result.duration
                }, 
                userId, 
                storageType
              );
            } else {
              saveLogger.debug(
                LogCategory.LOAD, 
                `Загрузка из ${storageType} не вернула данных`, 
                { result }, 
                userId, 
                storageType
              );
            }
          } catch (error) {
            saveLogger.error(
              LogCategory.LOAD, 
              `Ошибка загрузки из ${storageType}`, 
              { error }, 
              userId, 
              storageType,
              error instanceof Error ? error : new Error(String(error))
            );
            // Продолжаем с другими хранилищами
          }
        } else {
          saveLogger.warn(
            LogCategory.LOAD, 
            `Адаптер для ${storageType} не найден`, 
            undefined, 
            userId
          );
        }
      }
      
      // Сортируем результаты по времени (от новых к старым)
      results.sort((a, b) => {
        const aTime = a.data?._lastModified || a.timestamp;
        const bTime = b.data?._lastModified || b.timestamp;
        return bTime - aTime;
      });
      
      saveLogger.debug(
        LogCategory.LOAD, 
        `Получено ${results.length} результатов загрузки`, 
        {
          sources: results.map(r => r.source),
          timestamps: results.map(r => r.data?._lastModified || r.timestamp)
        },
        userId
      );
      
      // Если нет результатов, проверяем аварийные бэкапы
      if (results.length === 0) {
        saveLogger.info(
          LogCategory.LOAD, 
          "Не найдено сохранений, проверяем аварийные копии", 
          undefined, 
          userId
        );
        
        const emergencyResult = await this.loadEmergencyBackup(userId);
        if (emergencyResult && emergencyResult.data) {
          results.push(emergencyResult);
          saveLogger.info(
            LogCategory.LOAD, 
            "Загружена аварийная копия", 
            { 
              timestamp: emergencyResult.timestamp,
              source: emergencyResult.source
            }, 
            userId
          );
        } else {
          saveLogger.debug(
            LogCategory.LOAD, 
            "Аварийные копии не найдены", 
            undefined, 
            userId
          );
        }
      }
      
      // Если нет результатов и разрешено использовать значения по умолчанию
      if (results.length === 0 && mergedOptions.fallbackToDefault) {
        const duration = Date.now() - startTime;
        const operationDuration = saveLogger.endOperation(operationId);
        
        saveLogger.info(
          LogCategory.LOAD, 
          "Создание нового состояния для пользователя", 
          { duration, operationDuration }, 
          userId
        );
        
        // Возвращаем флаг нового пользователя
        return {
          success: true,
          timestamp: Date.now(),
          source: StorageType.MEMORY,
          isNewUser: true,
          data: undefined,
          duration
        };
      }
      
      // Если нашли результаты, возвращаем лучший
      if (results.length > 0) {
        const bestResult = results[0];
        
        // Если есть разные версии, объединяем их
        if (results.length > 1) {
          const secondBest = results[1];
          
          // Объединяем при необходимости
          if (bestResult.data && secondBest.data && 
              (bestResult.source !== secondBest.source)) {
                
            saveLogger.info(
              LogCategory.LOAD, 
              "Объединение данных из разных источников", 
              { 
                primary: bestResult.source, 
                secondary: secondBest.source,
                primaryTimestamp: bestResult.data._lastModified,
                secondaryTimestamp: secondBest.data._lastModified
              }, 
              userId
            );
            
            const mergedData = this.mergeGameStates(bestResult.data, secondBest.data);
            bestResult.data = mergedData;
            bestResult.wasRepaired = true;
          }
        }
        
        // Выполняем проверку целостности
        if (!mergedOptions.skipIntegrityCheck && bestResult.data) {
          saveLogger.debug(
            LogCategory.INTEGRITY, 
            "Проверка целостности данных", 
            undefined, 
            userId
          );
          
          const isValid = this.validateGameState(bestResult.data);
          
          if (!isValid) {
            saveLogger.warn(
              LogCategory.INTEGRITY, 
              "Обнаружено нарушение целостности данных, выполняется восстановление", 
              undefined, 
              userId
            );
            
            bestResult.wasRepaired = true;
            bestResult.data = this.repairGameState(bestResult.data);
          }
        }
        
        // Возвращаем результат с метриками
        const duration = Date.now() - startTime;
        const operationDuration = saveLogger.endOperation(operationId);
        
        saveLogger.info(
          LogCategory.LOAD, 
          `Загрузка успешно завершена ${bestResult.wasRepaired ? 'с восстановлением данных' : 'без восстановления'}`, 
          {
            source: bestResult.source,
            wasRepaired: bestResult.wasRepaired,
            duration,
            operationDuration
          }, 
          userId
        );
        
        return {
          ...bestResult,
          duration
        };
      }
      
      // Если ничего не нашли
      const duration = Date.now() - startTime;
      const operationDuration = saveLogger.endOperation(operationId);
      
      saveLogger.error(
        LogCategory.LOAD, 
        "Не удалось найти или загрузить данные пользователя", 
        { duration, operationDuration }, 
        userId
      );
      
      return {
        success: false,
        timestamp: Date.now(),
        error: 'Данные не найдены',
        duration
      };
    } catch (error) {
      // Обработка общих ошибок
      const duration = Date.now() - startTime;
      const operationDuration = saveLogger.endOperation(operationId);
      
      saveLogger.error(
        LogCategory.LOAD, 
        "Критическая ошибка при загрузке данных", 
        { 
          error, 
          duration,
          operationDuration
        }, 
        userId,
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
      
      return {
        success: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
        duration
      };
    }
  }
  
  /**
   * Загружает экстренную резервную копию
   */
  private async loadEmergencyBackup(userId: string): Promise<LoadResult | null> {
    saveLogger.debug(
      LogCategory.RECOVERY, 
      "Попытка загрузки экстренной резервной копии", 
      undefined, 
      userId
    );
    
    // Проверяем наличие копии в памяти
    const memoryBackup = this.emergencyBackups.get(userId);
    if (memoryBackup && memoryBackup.data) {
      saveLogger.info(
        LogCategory.RECOVERY, 
        "Найдена экстренная копия в памяти", 
        { timestamp: memoryBackup.timestamp }, 
        userId
      );
      
      return {
        success: true,
        timestamp: memoryBackup.timestamp,
        source: StorageType.EMERGENCY,
        data: memoryBackup.data
      };
    }
    
    // Проверяем sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      saveLogger.debug(
        LogCategory.RECOVERY, 
        "Поиск экстренных копий в sessionStorage", 
        undefined, 
        userId
      );
      
      // Ищем все ключи с backup для этого пользователя
      let latestBackup: {data: ExtendedGameState, timestamp: number} | null = null;
      let latestTimestamp = 0;
      let backupsFound = 0;
      
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key || !key.includes(`emergency_backup_${userId}`)) continue;
        
        backupsFound++;
        
        try {
          const backupData = JSON.parse(sessionStorage.getItem(key) || '');
          if (backupData && backupData.timestamp > latestTimestamp) {
            latestBackup = backupData;
            latestTimestamp = backupData.timestamp;
            
            saveLogger.trace(
              LogCategory.RECOVERY, 
              `Найдена копия с временной меткой ${new Date(backupData.timestamp).toISOString()}`, 
              { key }, 
              userId
            );
          }
        } catch (e) {
          saveLogger.warn(
            LogCategory.RECOVERY, 
            "Ошибка парсинга резервной копии", 
            { key, error: e }, 
            userId
          );
        }
      }
      
      saveLogger.debug(
        LogCategory.RECOVERY, 
        `Найдено ${backupsFound} экстренных копий`, 
        { latestTimestamp: latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : 'нет' }, 
        userId
      );
      
      if (latestBackup) {
        saveLogger.info(
          LogCategory.RECOVERY, 
          "Загружена экстренная копия из sessionStorage", 
          { timestamp: latestTimestamp }, 
          userId
        );
        
        return {
          success: true,
          timestamp: latestTimestamp,
          source: StorageType.EMERGENCY,
          data: latestBackup.data
        };
      }
    }
    
    saveLogger.info(
      LogCategory.RECOVERY, 
      "Экстренные резервные копии не найдены", 
      undefined, 
      userId
    );
    
    return null;
  }
  
  /**
   * Объединяет состояния игры
   */
  private mergeGameStates(primary: ExtendedGameState, secondary: ExtendedGameState): ExtendedGameState {
    // Предпочитаем более новое состояние
    const isPrimaryNewer = (primary._lastModified || 0) >= (secondary._lastModified || 0);
    const base = isPrimaryNewer ? primary : secondary;
    const other = isPrimaryNewer ? secondary : primary;
    
    saveLogger.debug(
      LogCategory.INTEGRITY, 
      "Объединение состояний игры", 
      {
        primaryTimestamp: primary._lastModified,
        secondaryTimestamp: secondary._lastModified,
        baseSource: isPrimaryNewer ? "primary" : "secondary"
      },
      primary._userId
    );
    
    // Выполняем глубокое объединение
    const result = deepMerge(base, other);
    
    saveLogger.debug(
      LogCategory.INTEGRITY, 
      "Состояния успешно объединены", 
      {
        baseSnot: base.inventory?.snot,
        otherSnot: other.inventory?.snot,
        resultSnot: result.inventory?.snot,
        baseSnotCoins: base.inventory?.snotCoins,
        otherSnotCoins: other.inventory?.snotCoins,
        resultSnotCoins: result.inventory?.snotCoins,
      },
      primary._userId
    );
    
    return result;
  }
  
  /**
   * Проверяет целостность состояния игры
   */
  private validateGameState(state: ExtendedGameState): boolean {
    saveLogger.debug(
      LogCategory.INTEGRITY, 
      "Проверка целостности состояния игры", 
      { userId: state._userId },
      state._userId
    );
    
    // Проверяем наличие критически важных полей
    if (!state || typeof state !== 'object') {
      saveLogger.warn(LogCategory.INTEGRITY, "Состояние не является объектом", undefined, state._userId);
      return false;
    }
    if (!state.inventory || typeof state.inventory !== 'object') {
      saveLogger.warn(LogCategory.INTEGRITY, "Инвентарь отсутствует или не является объектом", undefined, state._userId);
      return false;
    }
    if (!state._userId) {
      saveLogger.warn(LogCategory.INTEGRITY, "Отсутствует ID пользователя", undefined, state._userId);
      return false;
    }
    
    // Проверяем типы критически важных полей в инвентаре
    const { snot, snotCoins, containerSnot, containerCapacity } = state.inventory;
    
    if (typeof snot !== 'number' || isNaN(snot)) {
      saveLogger.warn(LogCategory.INTEGRITY, "Некорректное значение snot", { value: snot }, state._userId);
      return false;
    }
    if (typeof snotCoins !== 'number' || isNaN(snotCoins)) {
      saveLogger.warn(LogCategory.INTEGRITY, "Некорректное значение snotCoins", { value: snotCoins }, state._userId);
      return false;
    }
    if (typeof containerSnot !== 'number' || isNaN(containerSnot)) {
      saveLogger.warn(LogCategory.INTEGRITY, "Некорректное значение containerSnot", { value: containerSnot }, state._userId);
      return false;
    }
    if (typeof containerCapacity !== 'number' || isNaN(containerCapacity)) {
      saveLogger.warn(LogCategory.INTEGRITY, "Некорректное значение containerCapacity", { value: containerCapacity }, state._userId);
      return false;
    }
    
    saveLogger.debug(LogCategory.INTEGRITY, "Проверка целостности успешно пройдена", undefined, state._userId);
    return true;
  }
  
  /**
   * Восстанавливает поврежденное состояние игры
   */
  private repairGameState(state: ExtendedGameState): ExtendedGameState {
    saveLogger.info(
      LogCategory.RECOVERY, 
      "Начало восстановления состояния игры", 
      { userId: state._userId }, 
      state._userId
    );
    
    // Создаем новое состояние
    const repairedState = { ...state };
    
    // Восстанавливаем инвентарь если нужно
    if (!repairedState.inventory || typeof repairedState.inventory !== 'object') {
      saveLogger.warn(
        LogCategory.RECOVERY, 
        "Восстановление отсутствующего инвентаря", 
        undefined, 
        state._userId
      );
      
      repairedState.inventory = {
        snot: 0,
        snotCoins: 0,
        containerSnot: 0,
        containerCapacity: 1,
        containerCapacityLevel: 1,
        fillingSpeed: 1,
        fillingSpeedLevel: 1,
        collectionEfficiency: 1,
        lastUpdateTimestamp: Date.now()
      };
    } else {
      // Восстанавливаем отдельные поля инвентаря
      const inventory = repairedState.inventory;
      const repairs: string[] = [];
      
      if (typeof inventory.snot !== 'number' || isNaN(inventory.snot)) {
        inventory.snot = 0;
        repairs.push('snot');
      }
      
      if (typeof inventory.snotCoins !== 'number' || isNaN(inventory.snotCoins)) {
        inventory.snotCoins = 0;
        repairs.push('snotCoins');
      }
      
      if (typeof inventory.containerSnot !== 'number' || isNaN(inventory.containerSnot)) {
        inventory.containerSnot = 0;
        repairs.push('containerSnot');
      }
      
      if (typeof inventory.containerCapacity !== 'number' || isNaN(inventory.containerCapacity) || inventory.containerCapacity <= 0) {
        inventory.containerCapacity = 1;
        repairs.push('containerCapacity');
      }
      
      if (typeof inventory.fillingSpeed !== 'number' || isNaN(inventory.fillingSpeed) || inventory.fillingSpeed <= 0) {
        inventory.fillingSpeed = 1;
        repairs.push('fillingSpeed');
      }
      
      if (typeof inventory.containerCapacityLevel !== 'number' || isNaN(inventory.containerCapacityLevel) || inventory.containerCapacityLevel <= 0) {
        inventory.containerCapacityLevel = 1;
        repairs.push('containerCapacityLevel');
      }
      
      if (typeof inventory.fillingSpeedLevel !== 'number' || isNaN(inventory.fillingSpeedLevel) || inventory.fillingSpeedLevel <= 0) {
        inventory.fillingSpeedLevel = 1;
        repairs.push('fillingSpeedLevel');
      }
      
      // Ограничение переполнения контейнера
      if (inventory.containerSnot > inventory.containerCapacity) {
        inventory.containerSnot = inventory.containerCapacity;
        repairs.push('containerOverflow');
      }
      
      // Восстанавливаем lastUpdateTimestamp
      if (!inventory.lastUpdateTimestamp || typeof inventory.lastUpdateTimestamp !== 'number') {
        inventory.lastUpdateTimestamp = Date.now();
        repairs.push('lastUpdateTimestamp');
      }
      
      if (repairs.length > 0) {
        saveLogger.info(
          LogCategory.RECOVERY, 
          "Восстановлены поля инвентаря", 
          { repairs }, 
          state._userId
        );
      }
    }
    
    // Добавляем метаданные о восстановлении
    repairedState._wasRepaired = true;
    repairedState._repairedAt = Date.now();
    
    saveLogger.info(
      LogCategory.RECOVERY, 
      "Восстановление состояния завершено", 
      { 
        snot: repairedState.inventory.snot,
        snotCoins: repairedState.inventory.snotCoins,
        containerSnot: repairedState.inventory.containerSnot,
        containerCapacity: repairedState.inventory.containerCapacity,
        fillingSpeed: repairedState.inventory.fillingSpeed,
        repairedAt: new Date(repairedState._repairedAt).toISOString()
      }, 
      state._userId
    );
    
    return repairedState;
  }
  
  /**
   * Подготавливает состояние для сохранения
   */
  private prepareStateForSaving(userId: string, state: ExtendedGameState): ExtendedGameState {
    const now = Date.now();
    const saveVersion = (state._saveVersion || 0) + 1;
    
    // Проверка и логирование текущих значений snot для отладки
    saveLogger.debug(
      LogCategory.INTEGRITY, 
      "Проверка инвентаря перед сохранением", 
      { 
        snot: state.inventory?.snot,
        snotCoins: state.inventory?.snotCoins,
        containerSnot: state.inventory?.containerSnot,
        userId 
      }, 
      userId
    );
    
    // Убедимся, что все критические данные инвентаря корректны
    if (state.inventory) {
      // Проверяем, что snot не null и не undefined
      if (state.inventory.snot === null || state.inventory.snot === undefined) {
        saveLogger.warn(
          LogCategory.INTEGRITY,
          "Обнаружено некорректное значение snot, исправляем",
          { snot: state.inventory.snot },
          userId
        );
        state.inventory.snot = state.inventory.snot || 0;
      }
      
      // Проверяем, что все числовые значения действительно числа
      if (typeof state.inventory.snot !== 'number' || isNaN(state.inventory.snot)) {
        state.inventory.snot = parseFloat(state.inventory.snot) || 0;
      }
    }
    
    saveLogger.trace(
      LogCategory.SAVE, 
      "Подготовка состояния для сохранения", 
      { userId, saveVersion, lastModified: now }, 
      userId
    );
    
    const preparedState = {
      ...state,
      _userId: userId,
      _saveVersion: saveVersion,
      _lastModified: now,
      _lastSaved: new Date(now).toISOString(),
      _integrityHash: createHash(JSON.stringify({ ...state, _integrityHash: undefined }))
    };
    
    return preparedState;
  }
  
  /**
   * Удаляет сохранения пользователя
   */
  async deleteUserData(userId: string): Promise<boolean> {
    saveLogger.info(
      LogCategory.GENERAL, 
      `Запрос на удаление данных пользователя ${userId}`, 
      undefined, 
      userId
    );
    
    try {
      const deletePromises = Array.from(this.adapters.values()).map(adapter => {
        saveLogger.debug(
          LogCategory.GENERAL, 
          `Удаление данных из ${adapter.getType()}`, 
          undefined, 
          userId,
          adapter.getType()
        );
        
        return adapter.delete(userId).catch((error) => {
          saveLogger.error(
            LogCategory.GENERAL, 
            `Ошибка при удалении данных из ${adapter.getType()}`, 
            { error },
            userId,
            adapter.getType()
          );
          return false;
        });
      });
      
      const results = await Promise.all(deletePromises);
      const success = results.some(result => result === true);
      
      saveLogger.info(
        LogCategory.GENERAL, 
        `Удаление данных ${success ? 'успешно завершено' : 'завершилось с ошибками'}`, 
        {
          totalAdapters: this.adapters.size,
          successCount: results.filter(Boolean).length
        }, 
        userId
      );
      
      return success;
    } catch (error) {
      saveLogger.error(
        LogCategory.GENERAL, 
        "Критическая ошибка при удалении данных пользователя", 
        { error }, 
        userId,
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
      
      return false;
    }
  }
  
  /**
   * Очищает все очереди и кэши
   */
  cleanup(): void {
    saveLogger.info(LogCategory.GENERAL, "Начало очистки ресурсов SaveManager");
    
    try {
      // Очищаем сохранения в очереди
      const queueCount = this.saveQueue.size;
      for (const timer of this.saveQueue.values()) {
        clearTimeout(timer);
      }
      this.saveQueue.clear();
      
      saveLogger.debug(LogCategory.GENERAL, "Очищена очередь сохранений", { queueCount });
      
      // Очищаем автосохранение
      if (this.autoSaveInterval) {
        clearInterval(this.autoSaveInterval);
        this.autoSaveInterval = null;
        saveLogger.debug(LogCategory.GENERAL, "Остановлено автосохранение");
      }
      
      // Очищаем экстренные бэкапы
      const backupCount = this.emergencyBackups.size;
      this.emergencyBackups.clear();
      
      saveLogger.debug(LogCategory.GENERAL, "Очищены экстренные копии", { backupCount });
      
      // Удаляем обработчик события beforeunload
      if (typeof window !== 'undefined' && this.beforeUnloadHandler) {
        window.removeEventListener('beforeunload', this.beforeUnloadHandler);
        this.beforeUnloadHandler = null;
        
        saveLogger.debug(LogCategory.GENERAL, "Удален обработчик события beforeunload");
      }
      
      saveLogger.info(LogCategory.GENERAL, "Очистка ресурсов SaveManager успешно завершена");
    } catch (error) {
      saveLogger.error(
        LogCategory.GENERAL, 
        "Ошибка при очистке ресурсов", 
        { error },
        undefined,
        undefined,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
} 