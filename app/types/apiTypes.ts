/**
 * Типы для работы с API
 */

/**
 * Коды ошибок для API
 */
export enum ErrorCodes {
  // Общие ошибки
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  
  // Аутентификация
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  FORBIDDEN = 'FORBIDDEN',
  
  // Хранение данных
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATA_INTEGRITY_ERROR = 'DATA_INTEGRITY_ERROR',
  
  // Сеть
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  
  // Игровые ошибки
  GAME_STATE_INVALID = 'GAME_STATE_INVALID',
  SAVE_CONFLICT = 'SAVE_CONFLICT',
  VERSION_MISMATCH = 'VERSION_MISMATCH'
}

/**
 * Базовый ответ API
 */
export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  errorCode?: ErrorCodes;
}

/**
 * Ответ API с данными
 */
export interface ApiDataResponse<T> extends ApiResponse {
  data?: T;
}

/**
 * Информация об аутентификации
 */
export interface AuthResult {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * Результат проверки JWT
 */
export interface JwtVerifyResult {
  valid: boolean;
  userId: string;
  error?: string;
} 