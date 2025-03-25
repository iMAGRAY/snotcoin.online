/**
 * Контекст пользователя Farcaster, содержащий информацию о текущем пользователе
 */
interface FarcasterContext {
  /** Уникальный Farcaster ID пользователя */
  fid: number;
  
  /** Username пользователя (без @) */
  username: string;
  
  /** Отображаемое имя пользователя */
  displayName: string;
  
  /** Информация о профильном изображении пользователя */
  pfp: {
    /** URL профильного изображения */
    url: string;
    /** Флаг, указывающий, верифицировано ли изображение */
    verified: boolean;
  };
  
  /** Информация о кастодиальном кошельке пользователя */
  custody: {
    /** Адрес кошелька */
    address: string;
    /** Тип кошелька */
    type: string;
  };
  
  /** Массив верифицированных доменов пользователя */
  verifications: string[];
  
  /** Флаг, указывающий, верифицирован ли пользователь */
  verified: boolean;
  
  /** URL профиля пользователя */
  url: string;
  
  /** Домен пользователя в Farcaster */
  domain: string;
}

/**
 * Опции для публикации каста (сообщения) в Farcaster
 */
interface FarcasterCastOption {
  /** Текст сообщения */
  text: string;
  
  /** Массив вложений (URL, изображения и т.д.) */
  embeds?: {
    /** URL для вложения */
    url?: string;
    
    /** Информация об изображении */
    image?: {
      /** URL изображения */
      url: string;
    };
  }[];
  
  /** Информация о сообщении, на которое отвечает пользователь */
  replyTo?: {
    /** FID автора сообщения, на которое отвечает пользователь */
    fid: number;
    
    /** Хеш сообщения, на которое отвечает пользователь */
    hash: string;
  };
  
  /** Массив FID упомянутых пользователей */
  mentions?: number[];
  
  /** Массив позиций упоминаний в тексте */
  mentionsPositions?: number[];
}

/**
 * Интерфейс для Farcaster SDK, предоставляемого Warpcast
 */
interface FarcasterSDK {
  /** Функция для сообщения Farcaster, что фрейм готов */
  ready: () => void;
  
  /** Получение контекста текущего пользователя */
  getContext: () => Promise<FarcasterContext>;
  
  /** Получение пользователя по FID */
  fetchUserByFid?: (fid: number) => Promise<any>;
  
  /** Публикация каста (сообщения) */
  publishCast?: (text: string | FarcasterCastOption) => Promise<any>;
  
  /** Отправка реакции на каст */
  reactToCast?: (hash: string, reaction: 'like' | 'recast') => Promise<any>;
  
  /** Подписка на пользователя */
  followUser?: (fid: number) => Promise<any>;
  
  /** Проверка подписки на пользователя */
  checkFollowing?: (targetFid: number) => Promise<boolean>;
}

/**
 * Расширение интерфейса Window для работы с Farcaster SDK
 */
interface Window {
  /** Farcaster SDK, предоставляемый Warpcast */
  farcaster?: FarcasterSDK;
} 