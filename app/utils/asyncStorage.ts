/**
 * Модуль асинхронного хранилища данных
 * Обеспечивает эффективное сохранение и загрузку игровых данных
 */

import { ExtendedGameState } from "../types/gameTypes";
import { 
  CompressedGameState, 
  StructuredGameSave,
  gameStateToStructured,
  structuredToGameState 
} from "../types/saveTypes";
import { compressGameState, decompressGameState } from "./dataCompression";
import { validateAndRepairGameState } from "./dataIntegrity";

/**
 * Ключи для хранения данных
 */
export enum StorageKeys {
  // Основные данные
  GAME_STATE = "snotcoin_game_state",
  COMPRESSED_STATE = "snotcoin_compressed_state",
  SAVE_METADATA = "snotcoin_save_metadata",
  
  // Метаданные синхронизации
  SYNC_INFO = "snotcoin_sync_info",
  LAST_SYNC = "snotcoin_last_sync",
  
  // Пользовательские настройки
  USER_SETTINGS = "snotcoin_user_settings",
  
  // Временное хранилище
  TEMP_SAVE = "snotcoin_temp_save",
  
  // Список ключей для отложенного удаления
  DELETION_QUEUE = "snotcoin_deletion_queue"
}

/**
 * Результат операции хранилища
 */
interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

/**
 * Метаданные сохранения
 */
interface SaveMetadata {
  userId: string;
  lastSaved: number;
  saveVersion: number;
  saveCount: number;
  compressed: boolean;
  encryptionMethod?: string;
  storageKey: StorageKeys;
  checksum?: string;
}

/**
 * Доступные хранилища
 */
type StorageType = "localStorage" | "sessionStorage" | "indexedDB" | "memory";

/**
 * Опции хранилища
 */
interface StorageOptions {
  // Тип хранилища
  storageType: StorageType;
  
  // Автоматически сжимать большие данные
  autoCompress: boolean;
  
  // Порог размера данных для автоматического сжатия (в байтах)
  compressionThreshold: number;
  
  // Предварительная валидация данных перед сохранением
  validateBeforeSave: boolean;
  
  // Логирование операций
  enableLogging: boolean;
  
  // Сохранять резервную копию перед перезаписью данных
  keepBackup: boolean;
  
  // Максимальное количество резервных копий
  maxBackups: number;
  
  // Автоматическая очистка устаревших данных
  autoCleanup: boolean;
  
  // Возраст данных для автоматической очистки (в миллисекундах)
  cleanupAge: number;
}

/**
 * Менеджер асинхронного хранилища
 */
export class AsyncStorage {
  private options: StorageOptions;
  private memoryStorage: Map<string, any> = new Map();
  private operationQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue: boolean = false;
  private userId: string;
  
  /**
   * Создает экземпляр AsyncStorage
   */
  constructor(userId: string, options?: Partial<StorageOptions>) {
    this.userId = userId;
    
    // Устанавливаем опции по умолчанию
    this.options = {
      storageType: "localStorage",
      autoCompress: true,
      compressionThreshold: 50 * 1024, // 50 КБ
      validateBeforeSave: true,
      enableLogging: false,
      keepBackup: true,
      maxBackups: 3,
      autoCleanup: true,
      cleanupAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
      ...options
    };
    
    // Запускаем автоматическую очистку
    if (this.options.autoCleanup) {
      this.scheduleCleanup();
    }
  }
  
  /**
   * Сохраняет игровое состояние
   * @param state Игровое состояние
   * @returns Результат операции
   */
  public async saveGameState(state: ExtendedGameState): Promise<StorageResult<SaveMetadata>> {
    const startTime = Date.now();
    
    try {
      // Валидируем данные перед сохранением, если нужно
      let validatedState = state;
      if (this.options.validateBeforeSave) {
        validatedState = validateAndRepairGameState(state);
      }
      
      // Получаем текущие метаданные, если есть
      const existingMetadata = await this.getSaveMetadata();
      
      // Подготавливаем метаданные
      const metadata: SaveMetadata = {
        userId: this.userId,
        lastSaved: startTime,
        saveVersion: (validatedState._saveVersion || 0) + 1,
        saveCount: (existingMetadata?.saveCount || 0) + 1,
        compressed: false,
        storageKey: StorageKeys.GAME_STATE
      };
      
      // Определяем размер данных
      const serializedData = JSON.stringify(validatedState);
      const dataSize = serializedData.length;
      
      // Сжимаем данные, если размер превышает порог
      if (this.options.autoCompress && dataSize > this.options.compressionThreshold) {
        const compressed = compressGameState(validatedState, this.userId, {
          includeIntegrityInfo: true
        });
        
        // Сохраняем сжатые данные
        await this.setItem(
          StorageKeys.COMPRESSED_STATE,
          JSON.stringify(compressed)
        );
        
        // Обновляем метаданные
        metadata.compressed = true;
        metadata.storageKey = StorageKeys.COMPRESSED_STATE;
        
        if (this.options.enableLogging) {
          const compressionRatio = compressed._compressedSize / compressed._originalSize * 100;
          console.log(`[AsyncStorage] Данные сжаты (${compressionRatio.toFixed(2)}%): ${compressed._compressedSize}/${compressed._originalSize} байт`);
        }
      } else {
        // Сохраняем несжатые данные
        await this.setItem(StorageKeys.GAME_STATE, serializedData);
      }
      
      // Сохраняем метаданные
      await this.setItem(
        StorageKeys.SAVE_METADATA,
        JSON.stringify(metadata)
      );
      
      if (this.options.enableLogging) {
        console.log(`[AsyncStorage] Сохранение завершено за ${Date.now() - startTime}мс`);
      }
      
      return {
        success: true,
        data: metadata,
        timestamp: Date.now()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (this.options.enableLogging) {
        console.error(`[AsyncStorage] Ошибка сохранения:`, errorMessage);
      }
      
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Загружает игровое состояние
   * @returns Результат операции с игровым состоянием
   */
  public async loadGameState(): Promise<StorageResult<ExtendedGameState>> {
    const startTime = Date.now();
    
    try {
      // Загружаем метаданные
      const metadata = await this.getSaveMetadata();
      
      // Если метаданных нет, данные отсутствуют
      if (!metadata) {
        return {
          success: false,
          error: "Данные сохранения не найдены",
          timestamp: Date.now()
        };
      }
      
      // Загружаем данные из соответствующего хранилища
      let gameState: ExtendedGameState | null = null;
      
      if (metadata.compressed) {
        // Загружаем сжатые данные
        const compressedDataStr = await this.getItem(StorageKeys.COMPRESSED_STATE);
        
        if (!compressedDataStr) {
          return {
            success: false,
            error: "Сжатые данные не найдены",
            timestamp: Date.now()
          };
        }
        
        const compressedData = JSON.parse(compressedDataStr) as CompressedGameState;
        gameState = decompressGameState(compressedData);
        
        if (!gameState) {
          return {
            success: false,
            error: "Ошибка декомпрессии данных",
            timestamp: Date.now()
          };
        }
      } else {
        // Загружаем несжатые данные
        const gameStateStr = await this.getItem(StorageKeys.GAME_STATE);
        
        if (!gameStateStr) {
          return {
            success: false,
            error: "Данные состояния не найдены",
            timestamp: Date.now()
          };
        }
        
        gameState = JSON.parse(gameStateStr) as ExtendedGameState;
      }
      
      // Валидируем данные после загрузки
      const validatedState = validateAndRepairGameState(gameState);
      
      if (this.options.enableLogging) {
        console.log(`[AsyncStorage] Загрузка завершена за ${Date.now() - startTime}мс`);
      }
      
      return {
        success: true,
        data: validatedState,
        timestamp: Date.now()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (this.options.enableLogging) {
        console.error(`[AsyncStorage] Ошибка загрузки:`, errorMessage);
      }
      
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Получает метаданные сохранения
   * @returns Метаданные или null
   */
  public async getSaveMetadata(): Promise<SaveMetadata | null> {
    try {
      const metadataStr = await this.getItem(StorageKeys.SAVE_METADATA);
      
      if (!metadataStr) {
        return null;
      }
      
      return JSON.parse(metadataStr) as SaveMetadata;
    } catch (error) {
      if (this.options.enableLogging) {
        console.error(`[AsyncStorage] Ошибка загрузки метаданных:`, error);
      }
      return null;
    }
  }
  
  /**
   * Сохраняет структурированные данные
   * @param data Структурированные данные сохранения
   * @returns Результат операции
   */
  public async saveStructuredData(data: StructuredGameSave): Promise<StorageResult<SaveMetadata>> {
    try {
      // Конвертируем структурированное сохранение в объект состояния
      const gameState = structuredToGameState(data);
      
      // Сохраняем состояние
      return await this.saveGameState(gameState);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (this.options.enableLogging) {
        console.error(`[AsyncStorage] Ошибка сохранения структурированных данных:`, errorMessage);
      }
      
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Загружает структурированные данные
   * @returns Результат операции
   */
  public async loadStructuredData(): Promise<StorageResult<StructuredGameSave>> {
    try {
      // Загружаем состояние
      const gameStateResult = await this.loadGameState();
      
      if (!gameStateResult.success || !gameStateResult.data) {
        return {
          success: false,
          error: gameStateResult.error || "Не удалось загрузить состояние",
          timestamp: Date.now()
        };
      }
      
      // Конвертируем объект состояния в структурированное сохранение
      const structuredData = gameStateToStructured(gameStateResult.data);
      
      return {
        success: true,
        data: structuredData,
        timestamp: Date.now()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (this.options.enableLogging) {
        console.error(`[AsyncStorage] Ошибка загрузки структурированных данных:`, errorMessage);
      }
      
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Удаляет все данные текущего пользователя
   * @returns Результат операции
   */
  public async clearUserData(): Promise<StorageResult<boolean>> {
    const startTime = Date.now();
    
    try {
      // Удаляем все ключи, связанные с пользователем
      await this.removeItem(StorageKeys.GAME_STATE);
      await this.removeItem(StorageKeys.COMPRESSED_STATE);
      await this.removeItem(StorageKeys.SAVE_METADATA);
      await this.removeItem(StorageKeys.SYNC_INFO);
      await this.removeItem(StorageKeys.LAST_SYNC);
      await this.removeItem(StorageKeys.TEMP_SAVE);
      
      if (this.options.enableLogging) {
        console.log(`[AsyncStorage] Данные пользователя удалены за ${Date.now() - startTime}мс`);
      }
      
      return {
        success: true,
        data: true,
        timestamp: Date.now()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (this.options.enableLogging) {
        console.error(`[AsyncStorage] Ошибка удаления данных пользователя:`, errorMessage);
      }
      
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Получает элемент из хранилища
   * @param key Ключ
   * @returns Значение или null
   */
  public async getItem(key: string): Promise<string | null> {
    try {
      switch (this.options.storageType) {
        case "localStorage":
          return localStorage.getItem(`${this.userId}_${key}`);
          
        case "sessionStorage":
          return sessionStorage.getItem(`${this.userId}_${key}`);
          
        case "memory":
          return this.memoryStorage.get(`${this.userId}_${key}`) || null;
          
        case "indexedDB":
          // Заглушка для IndexedDB - в реальной реализации нужно использовать API IndexedDB
          throw new Error("IndexedDB не реализован в текущей версии");
          
        default:
          throw new Error(`Неизвестный тип хранилища: ${this.options.storageType}`);
      }
    } catch (error) {
      if (this.options.enableLogging) {
        console.error(`[AsyncStorage] Ошибка получения данных:`, error);
      }
      return null;
    }
  }
  
  /**
   * Сохраняет элемент в хранилище
   * @param key Ключ
   * @param value Значение
   */
  public async setItem(key: string, value: string): Promise<void> {
    // Добавляем операцию в очередь
    return new Promise((resolve, reject) => {
      this.operationQueue.push(async () => {
        try {
          const prefixedKey = `${this.userId}_${key}`;
          
          // Сохраняем резервную копию перед перезаписью, если включено
          if (this.options.keepBackup) {
            await this.createBackup(key);
          }
          
          switch (this.options.storageType) {
            case "localStorage":
              localStorage.setItem(prefixedKey, value);
              break;
              
            case "sessionStorage":
              sessionStorage.setItem(prefixedKey, value);
              break;
              
            case "memory":
              this.memoryStorage.set(prefixedKey, value);
              break;
              
            case "indexedDB":
              // Заглушка для IndexedDB
              throw new Error("IndexedDB не реализован в текущей версии");
              
            default:
              throw new Error(`Неизвестный тип хранилища: ${this.options.storageType}`);
          }
          
          resolve();
        } catch (error) {
          if (this.options.enableLogging) {
            console.error(`[AsyncStorage] Ошибка сохранения данных:`, error);
          }
          reject(error);
        }
      });
      
      // Запускаем обработку очереди
      this.processQueue();
    });
  }
  
  /**
   * Удаляет элемент из хранилища
   * @param key Ключ
   */
  public async removeItem(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.operationQueue.push(async () => {
        try {
          const prefixedKey = `${this.userId}_${key}`;
          
          switch (this.options.storageType) {
            case "localStorage":
              localStorage.removeItem(prefixedKey);
              break;
              
            case "sessionStorage":
              sessionStorage.removeItem(prefixedKey);
              break;
              
            case "memory":
              this.memoryStorage.delete(prefixedKey);
              break;
              
            case "indexedDB":
              // Заглушка для IndexedDB
              throw new Error("IndexedDB не реализован в текущей версии");
              
            default:
              throw new Error(`Неизвестный тип хранилища: ${this.options.storageType}`);
          }
          
          resolve();
        } catch (error) {
          if (this.options.enableLogging) {
            console.error(`[AsyncStorage] Ошибка удаления данных:`, error);
          }
          reject(error);
        }
      });
      
      // Запускаем обработку очереди
      this.processQueue();
    });
  }
  
  /**
   * Создает резервную копию данных
   * @param key Ключ данных
   */
  private async createBackup(key: string): Promise<void> {
    try {
      const value = await this.getItem(key);
      
      if (value) {
        const backupKey = `${key}_backup_${Date.now()}`;
        await this.setItem(backupKey, value);
        
        // Удаляем старые резервные копии, если их слишком много
        await this.cleanupBackups(key);
      }
    } catch (error) {
      if (this.options.enableLogging) {
        console.error(`[AsyncStorage] Ошибка создания резервной копии:`, error);
      }
    }
  }
  
  /**
   * Очищает старые резервные копии
   * @param baseKey Базовый ключ данных
   */
  private async cleanupBackups(baseKey: string): Promise<void> {
    // В реальной реализации нужно получить список всех ключей и отфильтровать резервные копии
    // Здесь представлена упрощенная логика
    if (this.options.enableLogging) {
      console.log(`[AsyncStorage] Очистка старых резервных копий для ${baseKey}`);
    }
  }
  
  /**
   * Обрабатывает очередь операций
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      while (this.operationQueue.length > 0) {
        const operation = this.operationQueue.shift();
        if (operation) {
          await operation();
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }
  
  /**
   * Планирует автоматическую очистку
   */
  private scheduleCleanup(): void {
    // Запускаем очистку раз в день
    const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 часа
    
    setInterval(() => {
      this.performCleanup()
        .catch(error => {
          if (this.options.enableLogging) {
            console.error(`[AsyncStorage] Ошибка автоматической очистки:`, error);
          }
        });
    }, CLEANUP_INTERVAL);
  }
  
  /**
   * Выполняет очистку устаревших данных
   */
  private async performCleanup(): Promise<void> {
    if (this.options.enableLogging) {
      console.log(`[AsyncStorage] Выполняется автоматическая очистка устаревших данных`);
    }
    
    // В реальной реализации здесь нужно перебрать все ключи и удалить устаревшие
    // Это требует доступа к полному списку ключей, что зависит от используемого хранилища
  }
  
  /**
   * Устанавливает новые опции для хранилища
   * @param newOptions Новые опции
   */
  public setOptions(newOptions: Partial<StorageOptions>): void {
    // Сохраняем старый тип хранилища для проверки изменений
    const oldStorageType = this.options.storageType;
    
    // Обновляем опции
    this.options = {
      ...this.options,
      ...newOptions
    };
    
    // Логируем обновление опций
    if (this.options.enableLogging) {
      console.log(`[AsyncStorage] Опции обновлены:`, newOptions);
    }
    
    // Если тип хранилища изменился, нужно выполнить миграцию данных
    if (oldStorageType !== this.options.storageType) {
      this.migrateStorageType(oldStorageType, this.options.storageType)
        .then(() => {
          if (this.options.enableLogging) {
            console.log(`[AsyncStorage] Данные мигрированы из ${oldStorageType} в ${this.options.storageType}`);
          }
        })
        .catch(error => {
          console.error(`[AsyncStorage] Ошибка миграции данных:`, error);
        });
    }
    
    // Запускаем или останавливаем автоматическую очистку в зависимости от настроек
    if (this.options.autoCleanup) {
      this.scheduleCleanup();
    }
  }
  
  /**
   * Мигрирует данные между типами хранилищ
   * @param fromType Тип хранилища-источника
   * @param toType Тип хранилища-назначения
   */
  private async migrateStorageType(fromType: StorageType, toType: StorageType): Promise<void> {
    // Пропускаем, если типы одинаковые
    if (fromType === toType) return;
    
    try {
      // Сохраняем текущий тип хранилища
      const currentType = this.options.storageType;
      
      // Временно переключаемся на исходное хранилище
      this.options.storageType = fromType;
      
      // Загружаем данные из исходного хранилища
      const gameState = await this.getItem(StorageKeys.GAME_STATE);
      const compressedState = await this.getItem(StorageKeys.COMPRESSED_STATE);
      const saveMetadata = await this.getItem(StorageKeys.SAVE_METADATA);
      const syncInfo = await this.getItem(StorageKeys.SYNC_INFO);
      const userSettings = await this.getItem(StorageKeys.USER_SETTINGS);
      
      // Переключаемся на целевое хранилище
      this.options.storageType = toType;
      
      // Сохраняем данные в целевое хранилище
      if (gameState) await this.setItem(StorageKeys.GAME_STATE, gameState);
      if (compressedState) await this.setItem(StorageKeys.COMPRESSED_STATE, compressedState);
      if (saveMetadata) await this.setItem(StorageKeys.SAVE_METADATA, saveMetadata);
      if (syncInfo) await this.setItem(StorageKeys.SYNC_INFO, syncInfo);
      if (userSettings) await this.setItem(StorageKeys.USER_SETTINGS, userSettings);
      
      // Восстанавливаем тип хранилища
      this.options.storageType = currentType;
    } catch (error) {
      console.error(`[AsyncStorage] Ошибка миграции данных:`, error);
      throw error;
    }
  }
} 