import { farcasterStore } from "../components/FarcasterFrameHandler";

/**
 * Интерфейс для данных пользователя Farcaster
 */
export interface FarcasterUser {
  fid?: number;
  username?: string;
  displayName?: string;
  pfp?: {
    url?: string;
    verified?: boolean;
  };
  verified?: boolean;
  custody?: {
    address?: string;
    type?: string;
  };
  verifications?: string[];
}

/**
 * Проверяет, находится ли приложение внутри Farcaster клиента
 */
export const isRunningInsideFarcaster = (): boolean => {
  return farcasterStore.isFarcasterClient();
};

/**
 * Получает контекст пользователя Farcaster
 */
export const getFarcasterUserContext = async (): Promise<FarcasterUser | null> => {
  return await farcasterStore.getUserContext();
};

/**
 * Открывает диалог для добавления приложения в избранное
 */
export const addAppToFavorites = async (): Promise<boolean> => {
  return await farcasterStore.addToFavorites();
};

/**
 * Запрашивает разрешение на отправку уведомлений
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  return await farcasterStore.requestNotificationPermission();
};

/**
 * Создает правильный JSON для метатега fc:frame
 */
export const createFrameMetadata = (options: {
  imageUrl: string;
  buttonTitle: string;
  buttonUrl: string;
  splashImageUrl?: string;
  splashBackgroundColor?: string;
  version?: string;
}): string => {
  const {
    imageUrl,
    buttonTitle,
    buttonUrl,
    splashImageUrl,
    splashBackgroundColor,
    version = "next"
  } = options;
  
  const frameData = {
    version,
    imageUrl,
    button: {
      title: buttonTitle,
      action: {
        type: "link",
        url: buttonUrl,
        ...(splashImageUrl && { splashImageUrl }),
        ...(splashBackgroundColor && { splashBackgroundColor })
      }
    }
  };
  
  return JSON.stringify(frameData);
};

/**
 * Проверяет, содержит ли URL параметр, указывающий на то,
 * что приложение было открыто из Farcaster фрейма
 */
export const wasOpenedFromFrame = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const url = new URL(window.location.href);
  return url.searchParams.has('embed') || 
         url.searchParams.has('frame') || 
         url.searchParams.has('fc');
}; 