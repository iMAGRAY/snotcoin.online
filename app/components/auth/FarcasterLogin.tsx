'use client';

import { useState, useEffect } from 'react';
import { useFarcaster } from '@/app/contexts/FarcasterContext';
import { saveToken, saveUserId } from '@/app/services/auth/authenticationService';

interface FarcasterLoginProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  buttonText?: string;
  buttonClass?: string;
  redirectOnSuccess?: boolean;
  redirectPath?: string;
}

export default function FarcasterLogin({
  onSuccess,
  onError,
  buttonText = 'Войти через Farcaster',
  buttonClass = '',
  redirectOnSuccess = false,
  redirectPath = '/',
}: FarcasterLoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshUserData } = useFarcaster();

  // Проверяем наличие Farcaster SDK
  const isFarcasterAvailable = () => {
    return typeof window !== 'undefined' && window.farcaster !== undefined;
  };

  // Функция для обработки успешной аутентификации
  const handleSuccessfulAuth = (data: any) => {
    if (data.token) {
      try {
        // Сохраняем токен с использованием authenticationService
        saveToken(data.token);
        console.log('[FarcasterLogin] Токен сохранен через authenticationService');
        
        // Сохраняем ID пользователя, если доступен
        if (data.user && data.user.id) {
          saveUserId(data.user.id);
          console.log(`[FarcasterLogin] ID пользователя ${data.user.id} сохранен через authenticationService`);
        }
      } catch (storageError) {
        console.error('[FarcasterLogin] Ошибка при сохранении данных авторизации:', storageError);
        throw new Error('Ошибка при сохранении данных авторизации');
      }
    } else {
      console.error('[FarcasterLogin] Сервер не вернул токен авторизации');
      throw new Error('Авторизация не удалась: токен не получен от сервера');
    }
  };

  // Обновленная функция handleLogin для использования централизованного механизма работы с токенами
  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!isFarcasterAvailable()) {
        throw new Error('Farcaster SDK не обнаружен. Установите Warpcast и попробуйте снова.');
      }

      // Получаем данные пользователя из Farcaster
      const farcaster = window.farcaster;
      if (!farcaster) {
        throw new Error('Farcaster SDK не обнаружен. Обновите страницу или попробуйте позже.');
      }
      
      const userData = await farcaster.getContext();
      
      if (!userData || !userData.fid) {
        throw new Error('Не удалось получить данные пользователя Farcaster');
      }

      // Отправляем данные на наш сервер для авторизации
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${baseUrl}/api/farcaster/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fid: userData.fid,
          username: userData.username,
          displayName: userData.displayName,
          pfp: userData.pfp?.url
        }),
      });

      // Обработка неуспешных HTTP-статусов
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Ошибка HTTP: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Ошибка при авторизации');
      }

      // Обработка успешной авторизации
      handleSuccessfulAuth(data);

      // Обновляем данные в контексте
      await refreshUserData();

      // Вызываем обработчик успеха, если он предоставлен
      if (onSuccess) {
        onSuccess();
      }

      // Перенаправляем пользователя, если нужно
      if (redirectOnSuccess && typeof window !== 'undefined') {
        window.location.href = redirectPath;
      }
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка при авторизации';
      setError(errorMessage);

      if (onError && err instanceof Error) {
        onError(err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleLogin}
        disabled={isLoading}
        className={`flex items-center justify-center space-x-2 py-2 px-4 rounded-lg font-medium transition duration-200
          ${buttonClass || 'bg-purple-600 hover:bg-purple-700 text-white'}
          ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        {isLoading ? (
          <>
            <span className="animate-spin inline-block h-4 w-4 border-t-2 border-b-2 border-current rounded-full mr-2"></span>
            <span>Авторизация...</span>
          </>
        ) : (
          <>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="currentColor" 
              className="w-5 h-5 mr-2"
            >
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1.24 14.779h2.48v-5.439l3.76 5.439h2.84l-4.35-6 4.35-5.96h-2.72l-3.88 5.37V4.82h-2.48v11.959z"/>
            </svg>
            <span>{buttonText}</span>
          </>
        )}
      </button>

      {error && (
        <p className="text-red-500 text-sm mt-2">{error}</p>
      )}

      {!isFarcasterAvailable() && !error && (
        <p className="text-sm mt-2 text-gray-600">
          Нет Farcaster? <a href="https://warpcast.com/download" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Скачать Warpcast</a>
        </p>
      )}
    </div>
  );
} 