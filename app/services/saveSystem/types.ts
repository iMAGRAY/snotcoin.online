/**
 * Типы данных для системы сохранений
 */
import { GameState, ExtendedGameState } from '../../types/gameTypes';

/**
 * Тип хранилища данных
 */
export enum StorageType {
  MEMORY = 'memory',         // Память (сессия)
  LOCAL = 'local',           // localStorage
  SESSION = 'session',       // sessionStorage
  INDEXED_DB = 'indexedDB',  // IndexedDB
  SERVER = 'server',         // Серверное хранилище
  REDIS = 'redis',           // Redis кэш
  EMERGENCY = 'emergency'    // Экстренное сохранение
}

/**
 * Результат операции сохранения
 */
export interface SaveResult {
  success: boolean;          // Успешность операции
  timestamp: number;         // Время операции
  source?: StorageType;      // Источник данных
  error?: string;            // Ошибка (если есть)
  duration?: number;         // Длительность операции в мс
  dataSize?: number;         // Размер данных в байтах
  metadata?: any;            // Дополнительные метаданные
}

/**
 * Результат операции загрузки
 */
export interface LoadResult extends SaveResult {
  data?: ExtendedGameState;  // Загруженные данные
  isNewUser?: boolean;       // Флаг нового пользователя
  wasRepaired?: boolean;     // Флаг восстановления данных
}

/**
 * Метаданные сохранения
 */
export interface SaveMetadata {
  userId: string;            // ID пользователя
  timestamp: number;         // Время сохранения
  version: number;           // Версия сохранения
  dataSize?: number;         // Размер данных
  hash?: string;             // Хеш для проверки целостности
  storageType: StorageType;  // Тип хранилища
  lastSync?: number;         // Время последней синхронизации
}

/**
 * Приоритет операции сохранения
 */
export enum SavePriority {
  HIGH = 'high',             // Высокий (немедленное сохранение)
  MEDIUM = 'medium',         // Средний (сохранение в ближайшей очереди)
  LOW = 'low',               // Низкий (отложенное сохранение)
  CRITICAL = 'critical'      // Критический (экстренное сохранение)
}

/**
 * Опции для операции сохранения
 */
export interface SaveOptions {
  priority?: SavePriority;          // Приоритет сохранения
  storageTypes?: StorageType[];     // Типы хранилищ для сохранения
  skipIntegrityCheck?: boolean;     // Пропустить проверку целостности
  createBackup?: boolean;           // Создать резервную копию
  compress?: boolean;               // Сжать данные
  encrypt?: boolean;                // Шифровать данные
  forceClear?: boolean;             // Принудительно очистить кэш
  reason?: string;                  // Причина сохранения (для логов)
  silent?: boolean;                 // Не показывать уведомления
}

/**
 * Опции для операции загрузки
 */
export interface LoadOptions {
  storageTypes?: StorageType[];     // Типы хранилищ для загрузки
  fallbackToDefault?: boolean;      // Использовать значения по умолчанию при ошибке
  skipIntegrityCheck?: boolean;     // Пропустить проверку целостности
  forceRefresh?: boolean;           // Принудительно загрузить, игнорируя кэш
  timeout?: number;                 // Таймаут операции в мс
  silent?: boolean;                 // Не показывать уведомления
}

/**
 * Интерфейс адаптера хранилища
 */
export interface StorageAdapter {
  /**
   * Сохраняет данные
   * @param userId ID пользователя
   * @param data Данные для сохранения
   * @param options Опции сохранения
   */
  save(userId: string, data: ExtendedGameState, options?: SaveOptions): Promise<SaveResult>;
  
  /**
   * Загружает данные
   * @param userId ID пользователя
   * @param options Опции загрузки
   */
  load(userId: string, options?: LoadOptions): Promise<LoadResult>;
  
  /**
   * Удаляет данные
   * @param userId ID пользователя
   */
  delete(userId: string): Promise<boolean>;
  
  /**
   * Проверяет наличие данных
   * @param userId ID пользователя
   */
  exists(userId: string): Promise<boolean>;
  
  /**
   * Получает тип хранилища
   */
  getType(): StorageType;
  
  /**
   * Очищает хранилище
   */
  clear(): Promise<boolean>;
} 