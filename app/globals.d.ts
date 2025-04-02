import { FarcasterSDK } from './types/farcaster';

declare global {
  interface Window {
    /**
     * Глобальный объект Farcaster SDK, доступный в режиме разработки
     * или когда приложение запущено внутри Farcaster клиента
     */
    farcaster?: FarcasterSDK;
    
    /**
     * Флаг, указывающий на активацию режима разработки Farcaster
     */
    __FARCASTER_DEV_MODE__?: boolean;
  }
} 