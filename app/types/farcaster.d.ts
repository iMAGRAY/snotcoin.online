/**
 * Типы для работы с Farcaster SDK
 * @module
 */

/**
 * Константы для работы с SDK
 */
export const FARCASTER_SDK = {
  SCRIPT_URL: 'https://warpcast.com/~/sdk.js',
  MIN_BROWSER_VERSIONS: {
    chrome: 80,
    firefox: 75,
    safari: 13,
    edge: 80
  },
  ERROR_CODES: {
    SDK_NOT_LOADED: 'SDK_NOT_LOADED',
    BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',
    AUTH_FAILED: 'AUTH_FAILED',
    USER_REJECTED: 'USER_REJECTED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    INVALID_RESPONSE: 'INVALID_RESPONSE'
  },
  TIMEOUT: {
    SDK_LOAD: 10000, // 10 seconds
    AUTH_PROCESS: 30000 // 30 seconds
  }
} as const;

/**
 * Типы для пользователя Farcaster
 */
export interface FarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfp?: {
    url: string;
    verified?: boolean;
  };
}

/**
 * Типы для клиента Farcaster
 */
export interface FarcasterClient {
  clientFid: number;
  added: boolean;
  safeAreaInsets?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  notificationDetails?: {
    url: string;
    token: string;
  };
}

/**
 * Типы для контекста Farcaster
 */
export interface FarcasterContext {
  user: FarcasterUser;
  authenticated: boolean;
  verifiedAddresses?: string[];
  requireFarcasterAuth: boolean;
  client: FarcasterClient;
  location?: any;
}

/**
 * Интерфейс для действий SDK
 */
export interface FarcasterSDKActions {
  ready: (options?: { disableNativeGestures?: boolean }) => Promise<void>;
  signIn: (options: { nonce: string }) => Promise<{ signature: string; message: string }>;
  viewProfile: (options: { fid: number }) => Promise<void>;
  openUrl: (options: { url: string }) => Promise<void>;
  sendNotification: (options: { message: string; receiverFid: number }) => Promise<void>;
}

/**
 * Интерфейс для Farcaster SDK
 */
export interface FarcasterSDK {
  /** Инициализация SDK */
  ready: () => Promise<void>;
  /** Флаг готовности SDK */
  isReady: boolean;
  /** Получение контекста текущего пользователя */
  getContext: () => Promise<FarcasterContext>;
  /** Получение данных пользователя по FID */
  fetchUserByFid: (fid: number) => Promise<FarcasterUser>;
  /** Публикация каста */
  publishCast: (text: string | any) => Promise<{
    /** Хеш каста */
    hash: string;
    /** Временная метка */
    timestamp: number;
  }>;
  /** Реакция на каст */
  reactToCast?: (hash: string, reaction: 'like' | 'recast') => Promise<boolean>;
  /** Подписка на пользователя */
  followUser?: (fid: number) => Promise<boolean>;
  /** Проверка подписки на пользователя */
  checkFollowing?: (targetFid: number) => Promise<boolean>;
  /** Методы для работы с фреймами */
  frame?: {
    /** Подписание действия фрейма */
    signFrameAction: (frameData: any) => Promise<any>;
    /** Валидация действия фрейма */
    validateFrameAction: (frameData: any) => Promise<boolean>;
  };
  /** Свойства */
  context: Promise<FarcasterContext>;
  /** Actions API */
  actions: FarcasterSDKActions;
}

declare global {
  interface Window {
    /** Глобальный объект Farcaster SDK */
    farcaster?: FarcasterSDK;
  }
}

export {};

/**
 * Тип для контекста React
 */
export interface FarcasterContextProviderProps {
  children: ReactNode;
} 