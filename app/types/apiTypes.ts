/**
 * Типы для API и аутентификации
 * @module
 */

import { FarcasterContext } from './farcaster';

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
 * Результат операции API
 */
export interface AuthResult<T = unknown> {
  /** Флаг успешности операции */
  success: boolean;
  /** Данные при успешной операции */
  data?: T;
  /** Сообщение об ошибке */
  error?: string;
  /** Код ошибки */
  errorCode?: string;
}

/**
 * Данные пользователя
 */
export interface UserData {
  /** Идентификатор пользователя */
  id: string;
  /** Имя пользователя */
  username: string;
  /** Email пользователя */
  email?: string | undefined;
  /** Аватар пользователя */
  avatar?: string | undefined;
  /** URL профильного изображения */
  pfpUrl?: string | undefined;
  /** Farcaster ID */
  fid: number;
  /** Отображаемое имя */
  displayName?: string | undefined;
  /** Верификация */
  verified?: boolean | undefined;
  /** Дополнительные данные */
  metadata?: Record<string, any> | undefined;
}

/**
 * Состояния процесса авторизации
 */
export enum AuthState {
  /** Начальное состояние */
  IDLE = 'IDLE',
  /** Загрузка SDK */
  LOADING_SDK = 'LOADING_SDK',
  /** Процесс авторизации */
  AUTHENTICATING = 'AUTHENTICATING',
  /** Успешная авторизация */
  SUCCESS = 'SUCCESS',
  /** Ошибка авторизации */
  ERROR = 'ERROR'
}

/**
 * Опции авторизации
 */
export interface AuthOptions {
  /** Таймаут операции в миллисекундах */
  timeout?: number;
  /** Количество попыток */
  retries?: number;
  /** Дополнительные параметры */
  params?: Record<string, unknown>;
}

/**
 * Результат проверки JWT
 */
export interface JwtVerifyResult {
  valid: boolean;
  userId: string;
  error?: string;
} 