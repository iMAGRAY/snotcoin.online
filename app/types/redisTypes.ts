/**
 * Типы данных для работы с Redis
 */

/**
 * Интерфейс для информации о сохранении клиента
 */
export interface ClientSaveInfo {
  client_id: string;
  timestamp: number;
  save_count?: number;
  concurrent_count?: number;
  last_ip?: string;
  last_source?: string;
  metadata?: Record<string, any>;
}

/**
 * Интерфейс для события безопасности
 */
export interface SecurityEvent {
  type: string;
  userId: string | null;
  clientId: string;
  clientIp: string;
  timestamp: number;
  targetId?: string;
  details?: Record<string, any>;
}

/**
 * Опции сохранения в Redis
 */
export interface RedisSaveOptions {
  isCritical?: boolean;
  metadata?: Record<string, any>;
  ttl?: number;
}

/**
 * Результат сохранения в Redis
 */
export interface RedisSaveResult {
  success: boolean;
  error?: string;
  key?: string;
  metadata?: Record<string, any>;
}

/**
 * Результат загрузки из Redis
 */
export interface RedisLoadResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  source?: string;
  metadata?: Record<string, any>;
}

/**
 * Опции загрузки из Redis
 */
export interface RedisLoadOptions {
  fallbackToDb?: boolean;
  useCompression?: boolean;
  timeout?: number;
}

/**
 * Опции сохранения состояния игры
 */
export interface GameStateOptions {
  isCritical?: boolean;
  ttl?: number;
  metadata?: Record<string, any>;
} 