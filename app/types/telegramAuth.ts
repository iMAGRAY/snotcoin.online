// Статусы авторизации
export enum AuthStatus {
  LOADING = 'loading',
  AUTHENTICATED = 'authenticated',
  UNAUTHENTICATED = 'unauthenticated',
  ERROR = 'error'
}

// Параметры компонента TelegramAuth
export interface TelegramAuthProps {
  onAuthenticate: (userData: any) => void;
}

// Пользователь Telegram из WebApp
export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: number;
  hash?: string;
  language_code?: string;
}

// Пользователь Telegram после авторизации
export interface TelegramUser {
  id: string | number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
  auth_date?: number;
  hash?: string;
  telegram_id?: number;
}

// Данные для принудительного входа
export interface ForceLoginData {
  userId: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
  telegramId: number;
  session_id: string;
  userAgent?: string;
} 