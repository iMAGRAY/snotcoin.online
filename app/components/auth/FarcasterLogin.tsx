'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface FarcasterLoginProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  redirectUrl?: string;
  buttonSize?: 'small' | 'medium' | 'large';
}

export default function FarcasterLogin({
  onSuccess,
  onError,
  redirectUrl,
  buttonSize = 'medium',
}: FarcasterLoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();

  // Определяем классы кнопки в зависимости от размера
  const buttonClasses = {
    small: 'px-3 py-1 text-sm',
    medium: 'px-4 py-2',
    large: 'px-6 py-3 text-lg',
  };

  // Функция, которая будет вызвана после успешной аутентификации
  const handleAuthSuccess = useCallback(async (userData: any) => {
    try {
      // Отправляем данные пользователя на наш API
      const response = await fetch('/api/farcaster/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (data.success) {
        if (onSuccess) {
          onSuccess();
        }

        // Перенаправляем пользователя, если указан URL
        if (redirectUrl) {
          router.push(redirectUrl);
        }
      } else {
        throw new Error(data.message || 'Ошибка авторизации');
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Неизвестная ошибка авторизации');
      
      setError(err);
      
      if (onError) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, onError, redirectUrl, router]);

  // Функция для выполнения входа через Farcaster
  const handleLogin = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Проверяем, доступен ли Farcaster клиент
    if (typeof window !== 'undefined' && window.farcaster) {
      try {
        // Получаем контекст пользователя
        const context = await window.farcaster.getContext();
        
        if (context) {
          // Получаем данные пользователя
          await handleAuthSuccess({
            fid: context.fid,
            username: context.username,
            displayName: context.displayName,
            pfp: context.pfp
          });
        } else {
          throw new Error('Не удалось получить контекст Farcaster');
        }
      } catch (error) {
        console.error('Ошибка входа Farcaster:', error);
        
        const err = error instanceof Error 
          ? error 
          : new Error('Произошла ошибка при входе через Farcaster');
        
        setError(err);
        
        if (onError) {
          onError(err);
        }
        
        setIsLoading(false);
      }
    } else {
      console.error('Farcaster SDK не доступен');
      
      const err = new Error('Вы должны использовать Warpcast для входа через Farcaster');
      setError(err);
      
      if (onError) {
        onError(err);
      }
      
      setIsLoading(false);
    }
  }, [handleAuthSuccess, onError]);

  // Отправляем сигнал готовности к Farcaster
  useEffect(() => {
    if (typeof window !== 'undefined' && window.farcaster) {
      window.farcaster.ready();
    }
  }, []);

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleLogin}
        disabled={isLoading}
        className={`bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-full transition duration-200 flex items-center justify-center ${buttonClasses[buttonSize]}`}
      >
        {isLoading ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Авторизация...
          </span>
        ) : (
          <span className="flex items-center">
            <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
              <path d="M23.4554 0H3.54463C1.58732 0 0 1.58732 0 3.54463V24.4554C0 26.4127 1.58732 28 3.54463 28H23.4554C25.4127 28 27 26.4127 27 24.4554V3.54463C27 1.58732 25.4127 0 23.4554 0Z" fill="currentColor"/>
              <path d="M13.3533 21.4732H8.58503V9.60888H13.3533V21.4732Z" fill="white"/>
              <path d="M18.3353 15.3308H13.5898V9.58521H18.3353V15.3308Z" fill="white"/>
            </svg>
            Войти через Farcaster
          </span>
        )}
      </button>
      
      {error && (
        <div className="mt-2 text-red-500 text-sm">
          {error.message}
          {error.message.includes('Warpcast') && (
            <div className="mt-1">
              <a 
                href="https://warpcast.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline"
              >
                Установить Warpcast
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 