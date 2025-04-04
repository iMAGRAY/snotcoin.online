/**
 * Типы для работы с Farcaster SDK
 * @module
 */

/**
 * Добавляем в интерфейс Window свойства для Farcaster SDK
 */
declare global {
  interface Window {
    farcaster?: FarcasterSDK;
    farcasterLastInitAttempt?: number;
    farcasterInitInProgress?: boolean;
    farcasterScriptBeingRemoved?: boolean;
  }
}

/**
 * Константы для работы с SDK
 */
export const FARCASTER_SDK = {
  SCRIPT_URL: 'https://auth.warpcast.com/farcaster-sdk.js',
  BACKUP_SCRIPT_URL: 'https://browser-sdk.farcaster.xyz/sdk.js',
  ALTERNATIVE_URLS: [
    '/farcaster-sdk.js', // Локальная копия скрипта
    'https://cdn.jsdelivr.net/npm/@farcaster/auth@0.0.8/sdk.js'
  ],
  MIN_BROWSER_VERSIONS: {
    chrome: 80,
    firefox: 80,
    safari: 14,
    edge: 80
  },
  ERROR_CODES: {
    SDK_NOT_LOADED: 'SDK_NOT_LOADED',
    AUTH_TIMEOUT: 'AUTH_TIMEOUT',
    BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',
    USER_REJECTED: 'USER_REJECTED',
    SERVER_ERROR: 'SERVER_ERROR'
  },
  TIMEOUT: {
    SDK_LOAD: 10000, // 10 секунд на загрузку SDK
    AUTH_OPERATION: 30000, // 30 секунд на операцию авторизации
    INIT: 5000 // 5 секунд на инициализацию SDK
  }
} as const;

/**
 * Интерфейс для контекста Farcaster
 */
export interface FarcasterContext {
  user?: FarcasterUser;
  authenticated: boolean;
  verifiedAddresses?: string[];
  requireFarcasterAuth: boolean;
}

/**
 * Интерфейс для пользователя Farcaster
 */
export interface FarcasterUser {
  fid: number;
  username: string;
  displayName?: string;
  pfp?: {
    url: string;
  };
  profile?: {
    bio?: {
      text?: string;
    };
  };
  /** URL аватара пользователя (альтернатива для pfp.url) */
  pfpUrl?: string;
  /** Биография пользователя (альтернатива для profile.bio.text) */
  bio?: string;
}

/**
 * Интерфейс для SDK Farcaster
 */
export interface FarcasterSDK {
  ready: () => Promise<void>;
  getContext: () => Promise<FarcasterContext | null>;
  fetchUserByFid: (fid: number) => Promise<FarcasterUser | null>;
  signIn?: () => Promise<FarcasterContext>;
  signOut?: () => Promise<void>;
}

/**
 * Опции для публикации каста
 */
export interface FarcasterCastOption {
  /** Текст каста */
  text: string;
  /** Вложения */
  embeds?: {
    /** URL */
    url?: string;
    /** Изображение */
    image?: {
      /** URL изображения */
      url: string;
    };
  }[];
  /** Ответ на каст */
  replyTo?: {
    /** Farcaster ID автора */
    fid: number;
    /** Хеш каста */
    hash: string;
  };
  /** Упоминания пользователей */
  mentions?: number[];
  /** Позиции упоминаний в тексте */
  mentionsPositions?: number[];
} 