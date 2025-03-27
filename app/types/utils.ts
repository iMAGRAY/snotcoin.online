import { UserData } from './auth';
import { FarcasterContext } from './farcaster';

/**
 * Константы для хранилища авторизации
 */
export const AUTH_STORAGE_KEYS = {
  /** Токен авторизации */
  TOKEN: 'auth_token',
  /** Данные пользователя */
  USER: 'user_data',
  /** ID сессии */
  SESSION: 'auth_session_id',
  /** Настройки авторизации */
  SETTINGS: 'auth_settings'
} as const;

/**
 * Константы для Farcaster
 */
export const FARCASTER_CONSTANTS = {
  /** Минимальная версия SDK */
  MIN_SDK_VERSION: '0.2.0',
  /** Таймаут операций */
  TIMEOUTS: {
    /** Таймаут авторизации */
    AUTH: 30000,
    /** Таймаут запросов */
    REQUEST: 10000,
    /** Таймаут загрузки SDK */
    SDK_LOAD: 5000
  },
  /** Максимальная длина каста */
  MAX_CAST_LENGTH: 320
} as const;

/**
 * Утилитные типы для работы с пользователями
 */
export type SafeUser = Required<Pick<UserData, 'id' | 'username' | 'fid'>> & {
  displayName?: string;
  avatar?: string;
  verified?: boolean;
  metadata?: Record<string, any>;
};
export type UserProfile = Omit<UserData, 'metadata'> & {
  metadata: Record<string, string | number | boolean>;
};

/**
 * Утилитные типы для работы с Farcaster
 */
export type FarcasterResponse<T> = Promise<T | null>;
export type FarcasterUser = Pick<FarcasterContext, 'fid' | 'username' | 'displayName' | 'pfp'>;

/**
 * Типы для обработки ошибок
 */
export type ErrorWithCode = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: ErrorWithCode;
};

/**
 * Утилитные функции для типов
 */
export function isErrorWithCode(error: unknown): error is ErrorWithCode {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as ErrorWithCode).code === 'string' &&
    typeof (error as ErrorWithCode).message === 'string'
  );
}

export function isSafeUser(user: UserData): user is SafeUser {
  return (
    typeof user.id === 'string' &&
    typeof user.username === 'string' &&
    typeof user.fid === 'number'
  );
} 