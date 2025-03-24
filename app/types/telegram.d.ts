import { TelegramWebAppUser } from './telegramAuth';

/**
 * Декларация типов для Telegram WebApp API
 */

// Типы для WebApp
export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramWebAppUser;
    auth_date?: number;
    hash?: string;
  };
  ready(): void;
  close(): void;
  expand(): void;
  isExpanded?: boolean;
  backgroundColor?: string;
  MainButton?: {
    text: string;
    onClick(callback: Function): void;
    show(): void;
    hide(): void;
  };
  version?: string;
  platform?: string;
}

// Типы для Telegram
export interface Telegram {
  WebApp?: TelegramWebApp;
}

// Расширяем глобальное объявление Window
declare global {
  interface Window {
    Telegram?: Telegram;
  }
}

export {}; 