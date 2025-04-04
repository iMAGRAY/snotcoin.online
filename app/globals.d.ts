import { FarcasterSDK } from './types/farcaster';

declare global {
  interface Window {
    /**
     * Глобальный объект Farcaster SDK, 
     * доступный когда приложение запущено внутри Farcaster клиента
     */
    farcaster?: FarcasterSDK;
  }
} 