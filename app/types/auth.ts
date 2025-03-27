/**
 * Типы для системы авторизации
 * @module
 */

import { FarcasterContext } from './farcaster';
import { SafeUser } from './utils';

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
 * Результат авторизации
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
  /** URL профильного изображения (то же, что avatar) */
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
 * Данные для фреймов Farcaster
 */
export interface FrameData {
  /** Версия фрейма */
  version: number;
  /** Индекс нажатой кнопки */
  buttonIndex: number;
  /** Идентификатор каста */
  castId: {
    /** Farcaster ID */
    fid: number;
    /** Хеш каста */
    hash: string;
  };
  /** Дополнительные данные */
  inputText?: string;
  /** URL изображения */
  imageUrl?: string;
  /** Метаданные */
  metadata?: Record<string, unknown>;
}

/**
 * Контроллер для управления операциями авторизации
 */
export interface AuthController {
  /** Функция отмены операции */
  abort: () => void;
  /** Сигнал отмены */
  signal: AbortSignal;
  /** Таймаут операции */
  timeout?: number;
}

/**
 * Опции авторизации
 */
export interface AuthOptions {
  /** Таймаут операции в миллисекундах */
  timeout?: number;
  /** Количество попыток */
  retries?: number;
  /** Контроллер для отмены операции */
  controller?: AuthController;
  /** Дополнительные параметры */
  params?: Record<string, unknown>;
}

export interface AuthService {
  getState(): AuthState;
  loginWithFarcaster(userData: FarcasterContext, options?: AuthOptions): Promise<AuthResult<{ user: SafeUser }>>;
  logout(): Promise<AuthResult<void>>;
  isAuthenticated(): boolean;
  getCurrentUser(): SafeUser | null;
  cancelAuth(): void;
  getToken(): string | null;
  getUserId(): string | null;
  getUserFromToken(): SafeUser | null;
  refreshToken(): Promise<boolean>;
  validateTokenExpiration(token: string): boolean;
  decodeToken(token: string): UserData | null;
  saveUserData(userData: SafeUser): void;
  setAuthenticated(value: boolean): void;
} 