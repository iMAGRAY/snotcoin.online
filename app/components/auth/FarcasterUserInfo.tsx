'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/app/contexts/FarcasterContext';
import Image from 'next/image';

interface FarcasterUserInfoProps {
  compact?: boolean;
  showLogout?: boolean;
  className?: string;
}

// Ключ для кэширования URL изображений в localStorage
const AVATAR_CACHE_KEY = 'farcaster_avatar_cache';
const AVATAR_CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах

// Тип для кэшированных данных
interface AvatarCacheItem {
  url: string;        // Оригинальный URL изображения
  cachedUrl?: string; // Альтернативный URL (если был использован)
  timestamp: number;  // Время кэширования
  invalid?: boolean;  // Флаг, показывающий, что URL невалиден
}

// Функция для получения кэша аватаров
function getAvatarCache(): Record<string, AvatarCacheItem> {
  if (typeof window === 'undefined') return {};
  
  try {
    const cacheData = localStorage.getItem(AVATAR_CACHE_KEY);
    if (cacheData) {
      const parsedCache = JSON.parse(cacheData);
      
      // Очищаем устаревшие записи
      const now = Date.now();
      Object.keys(parsedCache).forEach(key => {
        if (now - parsedCache[key].timestamp > AVATAR_CACHE_EXPIRY) {
          delete parsedCache[key];
        }
      });
      
      return parsedCache;
    }
  } catch (error) {
    console.warn('Ошибка при получении кэша аватаров:', error);
  }
  
  return {};
}

// Функция для обновления кэша аватаров
function updateAvatarCache(originalUrl: string, data: Partial<AvatarCacheItem>) {
  if (typeof window === 'undefined' || !originalUrl) return;
  
  try {
    const cache = getAvatarCache();
    
    cache[originalUrl] = {
      url: originalUrl,
      timestamp: Date.now(),
      ...(cache[originalUrl] || {}),
      ...data
    };
    
    localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Ошибка при обновлении кэша аватаров:', error);
  }
}

// Функция для получения резервного URL изображения
function getFallbackAvatarUrl(url: string): string | null {
  if (!url) return null;
  
  try {
    // Получаем кэшированные данные
    const cache = getAvatarCache();
    const cachedData = cache[url];
    
    // Если URL отмечен как невалидный и нет альтернативы, используем стандартный аватар
    if (cachedData?.invalid && !cachedData?.cachedUrl) {
      return 'https://warpcast.com/~/default-avatar.png';
    }
    
    // Возвращаем альтернативный URL, если он есть в кэше
    if (cachedData?.cachedUrl) {
      return cachedData.cachedUrl;
    }
    
    // Если URL ещё не проверялся
    return null;
  } catch (error) {
    console.error('Ошибка при получении резервного URL для аватара:', error);
    return null;
  }
}

/**
 * Функция для генерации резервного URL на основе исходного URL и FID пользователя
 */
function generateFallbackUrl(originalUrl: string, fid?: number): string | null {
  if (!originalUrl) return null;
  
  // Список возможных шаблонов для замены
  const fallbackTemplates = [
    // Warpcast API
    { 
      match: 'imagedelivery.net', 
      template: (fid: number) => `https://warpcast.com/~/api/v2/user-by-fid?fid=${fid}&fields=pfp` 
    },
    // Neynar API v2
    { 
      match: 'imagedelivery.net', 
      template: (fid: number) => `https://neynar.com/api/v2/farcaster/user/${fid}/pfp` 
    },
    // Hub service
    { 
      match: 'imagedelivery.net', 
      template: (fid: number) => `https://hub.farcaster.xyz/user/${fid}/pfp` 
    }
  ];
  
  // Если у нас есть FID
  if (fid) {
    // Перебираем шаблоны и ищем подходящий
    for (const template of fallbackTemplates) {
      if (originalUrl.includes(template.match)) {
        return template.template(fid);
      }
    }
  }
  
  // Общий запасной вариант
  return 'https://warpcast.com/~/default-avatar.png';
}

export default function FarcasterUserInfo({
  compact = false,
  showLogout = true,
  className = '',
}: FarcasterUserInfoProps) {
  const { sdkUser, sdkStatus } = useFarcaster();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  
  const isLoading = sdkStatus === 'loading';
  const user = sdkUser; // Для обратной совместимости с остальным кодом

  // Обработка изменения URL изображения пользователя
  useEffect(() => {
    if (!user?.pfpUrl && !user?.pfpUrl) {
      setAvatarUrl('');
      setImageError(false);
      return;
    }
    
    const originalUrl = user.pfpUrl || '';
    
    // Проверяем, есть ли URL в кэше
    const fallbackUrl = getFallbackAvatarUrl(originalUrl);
    
    if (fallbackUrl) {
      // Используем альтернативный URL из кэша
      setAvatarUrl(fallbackUrl);
      setImageError(false);
    } else {
      // Используем оригинальный URL
      setAvatarUrl(originalUrl);
      setImageError(false);
    }
  }, [user?.pfpUrl]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Функция logout удалена из контекста, поэтому просто загружаем страницу заново
      window.location.reload();
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleImageError = () => {
    const originalUrl = user?.pfpUrl || '';
    console.warn('Ошибка загрузки изображения профиля:', originalUrl);
    
    // Отмечаем URL как невалидный в кэше
    updateAvatarCache(originalUrl, { invalid: true });
    
    // Генерируем резервный URL с учетом fid пользователя
    const fallbackUrl = generateFallbackUrl(originalUrl, user?.fid);
    
    if (fallbackUrl) {
      // Сохраняем альтернативный URL в кэш
      updateAvatarCache(originalUrl, { cachedUrl: fallbackUrl });
      
      // Устанавливаем резервный URL
      setAvatarUrl(fallbackUrl);
    } else {
      // Используем дефолтный аватар
      setAvatarUrl('https://warpcast.com/~/default-avatar.png');
    }
    
    setImageError(true);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center text-gray-500 ${className}`}>
        <div className="animate-spin mr-2 w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
        {!compact && <span>Загрузка...</span>}
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const hasValidImage = !!avatarUrl && !imageError;
  const fallbackText = (user.displayName || user.username || '').charAt(0).toUpperCase();

  if (compact) {
    return (
      <div className={`flex items-center ${className}`}>
        {hasValidImage ? (
          <Image
            src={avatarUrl}
            alt={user.displayName || user.username}
            width={32}
            height={32}
            className="rounded-full"
            onError={handleImageError}
            unoptimized={true}
            loading="eager"
            priority={true}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600">
            {fallbackText}
          </div>
        )}
        <span className="ml-2 font-medium">
          {user.displayName || `@${user.username}`}
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden shadow-sm border border-gray-200 ${className}`}>
      <div className="flex items-start p-4 bg-white">
        <div className="flex-shrink-0">
          {hasValidImage ? (
            <Image
              src={avatarUrl}
              alt={user.displayName || user.username}
              width={48}
              height={48}
              className="rounded-full"
              onError={handleImageError}
              unoptimized={true}
              loading="eager"
              priority={true}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-lg">
              {fallbackText}
            </div>
          )}
        </div>
        
        <div className="ml-3">
          {user.displayName && (
            <h3 className="font-medium text-gray-900">{user.displayName}</h3>
          )}
          <p className="text-gray-600 text-sm">@{user.username}</p>
          <p className="text-gray-500 text-xs mt-1">FID: {user.fid}</p>
        </div>
      </div>
      
      {showLogout && (
        <div className="bg-gray-50 px-4 py-2 text-right">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="text-sm text-gray-600 hover:text-red-600 transition"
          >
            {isLoggingOut ? 'Выход...' : 'Выйти'}
          </button>
        </div>
      )}
    </div>
  );
} 