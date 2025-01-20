import { TelegramWebApp } from './types/gameTypes';

declare global {
  interface Window {
    Telegram: {
      WebApp?: TelegramWebApp & {
        onTelegramAuth?: (user: any) => void;
        initData: string;
        initDataUnsafe: any;
      };
    };
  }
}

