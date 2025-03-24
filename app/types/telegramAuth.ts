/**
 * Типы для работы с аутентификацией через Telegram
 */

/**
 * Статусы процесса аутентификации
 */
export enum AuthStatus {
  INIT = 'INIT',               // Начальное состояние
  LOADING = 'LOADING',         // Загрузка/ожидание
  ERROR = 'ERROR',             // Ошибка авторизации
  SUCCESS = 'SUCCESS'          // Успешная авторизация
}

/**
 * Тип пользователя Telegram
 */
export interface TelegramUser {
  id: string;
  telegram_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: number;
}

/**
 * Тип функции обратного вызова при успешной аутентификации
 */
export type TelegramAuthFunction = (userData: TelegramUser | any) => void;

/**
 * Параметры компонента аутентификации через Telegram
 */
export interface TelegramAuthProps {
  onAuthenticate: TelegramAuthFunction;
}

/**
 * Расширенная информация о сессии для отладки
 */
export interface DebugInfo {
  timestamp: string;
  message: string;
  userAgent?: string;
}

/**
 * Состояние процесса аутентификации
 */
export interface AuthState {
  status: AuthStatus;
  user: TelegramUser | null;
  error: string | null;
  debugInfo?: DebugInfo[] | string;
  errorDetails?: string | null;
}

/**
 * Результат хука авторизации через Telegram
 */
export interface TelegramAuthHookResult {
  user: TelegramUser | null;
  status: AuthStatus;
  isLoading: boolean;
  errorMessage: string | null;
  debugInfo?: DebugInfo[] | string;
  handleAuth: () => Promise<boolean | void>;
  handleRetry: () => void;
  closeWebApp: () => void;
  openInTelegram: () => void;
  isAuthenticated?: boolean;
  authToken?: string | null;
  login?: () => void;
  logout?: () => void;
}

// Тип для пользователя из Telegram WebApp
export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

// Тип для данных полученных из URL
export interface InitUrlData {
  user?: TelegramWebAppUser;
  auth_date?: number;
  hash?: string;
  signature?: string;
}

// Тип для данных форсированного входа
export interface ForceLoginData {
  telegramId: number;
  username?: string;
  first_name: string;
  last_name?: string;
  force_login: boolean;
  session_id: string;
  userAgent?: string;
} 