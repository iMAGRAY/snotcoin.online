/**
 * Типы данных для работы с Redis сервисом
 */

import { ExtendedGameState } from '../../../types/gameTypes';

/**
 * Результат операции Redis сервиса
 */
export interface RedisServiceResult<T = any> {
  /** Успешность операции */
  success: boolean;
  /** Данные результата (опционально) */
  data?: T;
  /** Сообщение об ошибке (если есть) */
  error?: string;
  /** Источник данных */
  source?: string;
  /** Метрики выполнения операции */
  metrics?: {
    /** Продолжительность операции в миллисекундах */
    time?: number;
    /** Размер данных в байтах */
    size?: number;
    /** Было ли попадание в кэш */
    cacheHit?: boolean;
    [key: string]: any;
  };
}

/**
 * Настройки Redis
 */
export interface RedisSettings {
  /** Хост Redis сервера */
  host: string;
  /** Порт Redis сервера */
  port: number;
  /** Пароль для аутентификации */
  password?: string | undefined;
  /** Таймаут соединения в миллисекундах */
  connectionTimeout?: number | undefined;
  /** Максимальное количество повторных попыток на запрос */
  maxRetriesPerRequest?: number | undefined;
}

/**
 * Интерфейс для работы с Redis кэшем
 */
export interface RedisCache {
  /** Проверяет доступность Redis */
  ping(): Promise<boolean>;
  /** Устанавливает значение ключа */
  set(key: string, value: any, ttl?: number): Promise<boolean>;
  /** Получает значение ключа */
  get<T = any>(key: string): Promise<T | null>;
  /** Удаляет ключ */
  del(key: string): Promise<boolean>;
  /** Проверяет существование ключа */
  exists(key: string): Promise<boolean>;
  /** Получает время жизни ключа */
  ttl(key: string): Promise<number>;
  /** Устанавливает время жизни ключа */
  expire(key: string, ttl: number): Promise<boolean>;
  /** Получает список ключей по шаблону */
  keys(pattern: string): Promise<string[]>;
  /** Очищает все данные в Redis */
  flushall(): Promise<boolean>;
}

/**
 * Опции для сохранения/загрузки состояния игры
 */
export interface GameStateOptions {
  /** Время жизни в секундах */
  ttl?: number;
  /** Критичность данных */
  isCritical?: boolean;
  /** Сжатие данных */
  compress?: boolean;
  /** Включение метаданных */
  includeMetadata?: boolean;
  /** Метаданные */
  metadata?: Record<string, any>;
}

/**
 * Элемент кэша в памяти
 */
export interface MemoryCacheItem<T = any> {
  /** Данные */
  data: T;
  /** Время истечения */
  expiry: number;
  /** Размер данных в байтах */
  size: number;
}

/**
 * Статистика кэша
 */
export interface CacheStats {
  /** Доступность */
  isAvailable: boolean;
  /** Размер кэша в памяти */
  memoryCacheSize: number;
  /** Количество элементов */
  itemCount: number;
  /** Использование памяти */
  memoryUsage: number;
  /** Общее количество операций */
  totalOperations: number;
  /** Соотношение попаданий в кэш */
  hitRatio: number;
  /** Частота ошибок */
  errorRate: number;
  /** Последняя ошибка */
  lastError?: string;
  /** Время последней ошибки */
  lastErrorTime?: number;
}

/**
 * Информация о сохранении клиента
 */
export interface ClientSaveInfo {
  /** Идентификатор клиента */
  client_id: string;
  /** Время сохранения */
  timestamp: number;
  /** Метаданные */
  metadata?: Record<string, any> | undefined;
}

/**
 * Интерфейс для работы с Redis сервисом
 */
export interface RedisService {
  /** Инициализация сервиса */
  init(): Promise<boolean>;
  /** Проверяет доступность сервиса */
  isAvailable(): Promise<boolean>;
  /** Получает статистику кэша */
  getStats(): CacheStats;
  
  /**
   * Методы для работы с состоянием игры
   */
  saveGameState(userId: string, gameState: any, options?: GameStateOptions): Promise<RedisServiceResult>;
  loadGameState(userId: string): Promise<RedisServiceResult>;
  clearGameState(userId: string): Promise<RedisServiceResult>;
  
  /**
   * Методы для работы с информацией о клиентских сохранениях
   */
  getClientSaveInfo(userId: string): Promise<ClientSaveInfo | null>;
  updateClientSaveInfo(userId: string, clientId: string, metadata?: Record<string, any>): Promise<boolean>;
  
  /**
   * Общие методы для кэширования
   */
  set(key: string, value: any, ttl?: number): Promise<RedisServiceResult>;
  get<T = any>(key: string): Promise<RedisServiceResult<T>>;
  delete(key: string): Promise<RedisServiceResult>;
  
  /**
   * Методы для очистки
   */
  clearUserCache(userId: string): Promise<RedisServiceResult>;
  clearAll(): Promise<RedisServiceResult>;
} 