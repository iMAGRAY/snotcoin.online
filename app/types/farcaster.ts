/**
 * Типы для работы с Farcaster SDK
 * @module
 */

/**
 * Константы для работы с SDK
 */
export const FARCASTER_SDK = {
  SCRIPT_URL: 'https://kit.warpcast.com/sdk.js',
  BACKUP_SCRIPT_URL: 'https://cdn.warpcast.com/sdk/sdk.js',
  ALTERNATIVE_URLS: [
    '/farcaster-sdk.js', // Локальная копия SDK (приоритет)
    'https://assets.warpcast.com/sdk.js',
    'https://www.unpkg.com/@farcaster/auth-kit@0.2.1/dist/index.umd.js',
    'https://esm.sh/@farcaster/auth-kit@0.2.1'
  ],
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
    SDK_LOAD: 15000, // 15 seconds
    AUTH_PROCESS: 30000 // 30 seconds
  }
} as const;

/**
 * Контекст пользователя Farcaster
 */
export interface FarcasterContext {
  /** Уникальный идентификатор пользователя */
  fid: number;
  /** Имя пользователя */
  username: string;
  /** Отображаемое имя */
  displayName?: string;
  /** Аватар пользователя */
  pfp?: {
    /** URL аватара */
    url: string;
    /** Флаг верификации аватара */
    verified: boolean;
  };
  /** Флаг верификации аккаунта */
  verified?: boolean;
  /** Данные о custody */
  custody?: {
    /** Адрес кошелька */
    address: string;
    /** Тип custody */
    type: string;
  };
  /** Массив верификаций */
  verifications?: string[];
  /** Домен пользователя */
  domain?: string;
  /** URL профиля */
  url?: string;
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
  fetchUserByFid: (fid: number) => Promise<FarcasterContext>;
  /** Публикация каста */
  publishCast: (text: string | FarcasterCastOption) => Promise<{
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
} 