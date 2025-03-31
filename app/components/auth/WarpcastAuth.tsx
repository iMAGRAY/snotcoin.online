'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { authService } from '@/app/services/auth/authService';
import { useFarcaster } from '@/app/contexts/FarcasterContext';
import { logAuthInfo, AuthStep, AuthLogType, logAuth } from '@/app/utils/auth-logger';
import type { FarcasterContext, FarcasterSDK } from '@/app/types/farcaster';
import { FARCASTER_SDK } from '@/app/types/farcaster';

// Интерфейс для данных пользователя
interface UserData {
  user: {
    id: string;
    fid?: number;
    username?: string;
  };
  token?: string;
}

// Интерфейс пропсов компонента
interface WarpcastAuthProps {
  onSuccess: (userData: UserData) => void;
  onError: (error: string) => void;
}

// Функция для проверки поддержки браузера
const checkBrowserSupport = (): boolean => {
  const ua = navigator.userAgent;
  const browserInfo = {
    chrome: ua.match(/Chrome\/(\d+)/),
    firefox: ua.match(/Firefox\/(\d+)/),
    safari: ua.match(/Version\/(\d+).*Safari/),
    edge: ua.match(/Edg\/(\d+)/)
  };

  for (const [browser, match] of Object.entries(browserInfo)) {
    if (match && match[1]) {
      const version = parseInt(match[1]);
      if (version < FARCASTER_SDK.MIN_BROWSER_VERSIONS[browser as keyof typeof FARCASTER_SDK.MIN_BROWSER_VERSIONS]) {
        return false;
      }
    }
  }

  return true;
};

export default function WarpcastAuth({ onSuccess, onError }: WarpcastAuthProps) {
  // Используем только статус и ошибку SDK из контекста
  const { sdkStatus, sdkError } = useFarcaster(); 
  
  // Локальное состояние для отслеживания процесса авторизации
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Функция для проверки наличия SDK (упрощенная)
  const checkFarcasterSDK = (): boolean => {
    return typeof window !== 'undefined' && typeof window.farcaster?.ready === 'function';
  };

  // Функция для авторизации через Farcaster
  const handleFarcasterAuth = useCallback(async () => {
    // Проверяем статус SDK перед началом
    if (sdkStatus !== 'ready') {
      console.warn('[WarpcastAuth] Попытка авторизации при SDK не в статусе ready.');
      setAuthError('Farcaster SDK не готов. Пожалуйста, подождите.');
      return;
    }

    setIsAuthorizing(true);
    setAuthError(null);

    const authTimeoutId = setTimeout(() => {
      setIsAuthorizing(false);
      setAuthError('Превышено время ожидания авторизации');
      logAuth(AuthStep.AUTH_ERROR, AuthLogType.ERROR, 'Timeout during Farcaster auth');
    }, FARCASTER_SDK.TIMEOUT.AUTH_OPERATION);

    try {
      logAuth(AuthStep.AUTH_START, AuthLogType.INFO, 'Начало авторизации через Farcaster');
      
      // SDK уже должен быть готов
      if (!checkFarcasterSDK()) {
        throw new Error(FARCASTER_SDK.ERROR_CODES.SDK_NOT_LOADED); // Маловероятно, но проверяем
      }
      
      const farcaster = window.farcaster as FarcasterSDK;
      
      // Получаем данные пользователя из SDK
      const userData = await farcaster.getContext() as FarcasterContext;
      
      if (!userData || !userData.user?.fid) {
         throw new Error('Некорректные данные пользователя от Farcaster');
      }
      
      logAuth(
        AuthStep.VALIDATE_DATA, 
        AuthLogType.INFO, 
        'Получены данные пользователя из Farcaster', 
        { fid: userData.user.fid, username: userData.user.username }
      );
      
      // Отправляем данные на сервер для валидации через Neynar и сохранения
      const response = await fetch('/api/auth/warpcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      
      console.log(`[WarpcastAuth] Получен ответ с кодом: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Ошибка HTTP: ${response.status}` }));
        console.error('[WarpcastAuth] Ошибка от API:', errorData);
        throw new Error(errorData.message || 'Ошибка авторизации на сервере');
      }
      
      const authResult = await response.json();
      
      if (!authResult.success) {
        console.error('[WarpcastAuth] Неуспешный результат авторизации:', authResult);
        throw new Error(authResult.message || 'Ошибка валидации на сервере');
      }
      
      // Проверяем наличие токена и сохраняем его
      if (!authResult.token) {
        console.error('[WarpcastAuth] В ответе отсутствует токен авторизации:', authResult);
        throw new Error('Токен авторизации отсутствует в ответе сервера');
      }
      
      // Сохраняем токен в localStorage напрямую и через authService
      try {
        localStorage.setItem('auth_token', authResult.token);
        console.log('[WarpcastAuth] Токен авторизации успешно сохранен в localStorage');
        
        // Также сохраняем через authService для дублирования
        authService.saveToken(authResult.token);
      } catch (storageError) {
        console.error('[WarpcastAuth] Ошибка при сохранении токена:', storageError);
        // Продолжаем, так как основное сохранение в localStorage уже произошло
      }
      
      // Сохраняем данные пользователя
      try {
        // Формируем user_id из provider и id
        const userId = `farcaster_${authResult.user.id}`;
        
        // Синхронизируем user_id и game_id
        authService.syncUserAndGameIds(userId);
        console.log(`[WarpcastAuth] Синхронизирован user_id и game_id: ${userId}`);
        
        // Сохраняем данные пользователя через authService
        authService.saveUserData(authResult.user);
        
        // Устанавливаем флаг авторизации
        authService.setAuthenticated(true);
      } catch (userError) {
        console.error('[WarpcastAuth] Ошибка при сохранении данных пользователя:', userError);
      }
      
      logAuth(
        AuthStep.AUTH_COMPLETE, 
        AuthLogType.INFO, 
        'Авторизация через Farcaster успешно завершена', 
        { userId: authResult.user?.id }
      );
      
      clearTimeout(authTimeoutId);
      setIsAuthorizing(false);
      onSuccess({
        user: {
          id: authResult.user.id,
          fid: authResult.user.fid,
          username: authResult.user.username
        },
        token: authResult.token
      });
    } catch (error) {
      clearTimeout(authTimeoutId);
      console.error('Ошибка авторизации через Farcaster:', error);
      
      let specificAuthError = 'Неизвестная ошибка авторизации';
      if (error instanceof Error) {
        switch (error.message) {
          case FARCASTER_SDK.ERROR_CODES.BROWSER_NOT_SUPPORTED:
            specificAuthError = 'Ваш браузер не поддерживается. Пожалуйста, обновите браузер или используйте другой.';
            break;
          case FARCASTER_SDK.ERROR_CODES.SDK_NOT_LOADED:
            specificAuthError = 'Не удалось загрузить Farcaster SDK. Пожалуйста, используйте Warpcast браузер или установите расширение.';
            break;
          case 'Ошибка валидации на сервере':
            specificAuthError = 'Не удалось авторизоваться. Пожалуйста, попробуйте снова.';
            break;
          case FARCASTER_SDK.ERROR_CODES.USER_REJECTED:
            specificAuthError = 'Вы отменили авторизацию.';
            break;
          case 'Некорректные данные пользователя от Farcaster':
            specificAuthError = 'Получены некорректные данные от Farcaster.';
            break;
          default:
            if (error.message.includes('Network Error') || error.message.includes('Failed to fetch')) {
               specificAuthError = 'Ошибка сети. Пожалуйста, проверьте подключение к интернету.';
            } else {
               specificAuthError = error.message; 
            }
        }
      }
      
      setAuthError(specificAuthError); // Используем локальное состояние ошибки
      logAuth(
        AuthStep.AUTH_ERROR, 
        AuthLogType.ERROR, 
        'Ошибка при авторизации через Farcaster', 
        { errorCode: error instanceof Error ? error.message : 'UNKNOWN' }, 
        error
      );
      onError(specificAuthError);
    } finally {
      // Устанавливаем isAuthorizing в false только если не было ошибки таймаута
      if (authTimeoutId) { // Проверяем, не сработал ли уже таймаут
         setIsAuthorizing(false);
      }
    }
  }, [sdkStatus, onSuccess, onError]); // Удаляем refreshUserData из зависимостей

  // Рендер компонента (обновляем условия)
  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Показываем загрузку, если SDK грузится или идет авторизация */} 
      {(sdkStatus === 'loading' || isAuthorizing) ? (
        <div className="py-4 w-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-gray-300">
             {sdkStatus === 'loading' ? 'Загрузка Farcaster SDK...' : 'Авторизация...'}
          </span>
        </div>
      /* Показываем ошибку SDK или ошибку авторизации */
      ) : (sdkStatus === 'error' || authError) ? (
        <div className="bg-red-900/30 p-4 rounded-lg w-full">
          <p className="text-red-400 text-sm">{sdkError || authError}</p>
          {/* Кнопка Попробовать снова должна сбрасывать authError и вызывать handleFarcasterAuth 
              (но только если sdkStatus === 'ready') */} 
          <button 
            onClick={() => {
              setAuthError(null);
              if (sdkStatus === 'ready') {
                 handleFarcasterAuth();
              }
              // Если ошибка была в SDK, перезагрузка страницы может быть лучшим вариантом
              else if (sdkStatus === 'error') {
                 window.location.reload(); 
              }
            }}
            className="mt-2 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg text-sm"
          >
            Попробовать снова
          </button>
        </div>
      /* Показываем кнопку входа, если SDK готов и нет ошибок */
      ) : sdkStatus === 'ready' ? (
        <button
          onClick={handleFarcasterAuth}
          disabled={isAuthorizing} // Блокируем кнопку во время авторизации
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="currentColor" 
            className="w-5 h-5 mr-2"
          >
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1.24 14.779h2.48v-5.439l3.76 5.439h2.84l-4.35-6 4.35-5.96h-2.72l-3.88 5.37V4.82h-2.48v11.959z"/>
          </svg>
          <span>Войти через Farcaster</span>
        </button>
      /* Состояние idle или непредвиденное */
      ) : null}
      
      <p className="text-xs text-gray-500 text-center">
        Требуется аккаунт Farcaster. <a href="https://warpcast.com/download" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Скачать Warpcast</a>
      </p>
    </div>
  );
} 