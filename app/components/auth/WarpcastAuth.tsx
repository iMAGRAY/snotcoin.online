'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { authService } from '@/app/services/auth/authService';
import { useFarcaster } from '@/app/contexts/FarcasterContext';
import { logAuthInfo, AuthStep, AuthLogType, logAuth } from '@/app/utils/auth-logger';
import type { FarcasterContext, FarcasterSDK } from '@/app/types/farcaster';
import { FARCASTER_SDK } from '@/app/types/farcaster';

// Всегда в режиме продакшена
const isProductionMode = true;

// Интерфейс для данных пользователя
interface UserData {
  user: {
    id: string;
    fid?: number;
    username?: string;
    displayName?: string;
    avatar?: string;
  };
  token?: string;
  gameState?: {
    exists: boolean;
    lastSaved?: string;
    version?: number;
  };
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
  // Используем контекст Farcaster
  const { sdkUser, sdkStatus, sdkError } = useFarcaster(); 
  
  // Локальное состояние для отслеживания процесса авторизации
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Функция для проверки наличия SDK
  const checkFarcasterSDK = (): boolean => {
    return typeof window !== 'undefined' && typeof window.farcaster?.ready === 'function';
  };

  // Функция для авторизации через Farcaster
  const handleFarcasterAuth = useCallback(async () => {
    // Проверяем статус SDK перед началом
    if (sdkStatus !== 'ready') {
      console.warn('[WarpcastAuth] Попытка авторизации при SDK не в статусе ready.');
      setAuthError('Farcaster SDK не готов. Пожалуйста, подождите или обновите страницу.');
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
        throw new Error(FARCASTER_SDK.ERROR_CODES.SDK_NOT_LOADED);
      }
      
      const farcaster = window.farcaster as FarcasterSDK;
      
      // Получаем данные пользователя из SDK
      const userData = await farcaster.getContext() as FarcasterContext;
      
      // Проверяем наличие обязательных данных пользователя
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
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Ошибка HTTP: ${response.status}` }));
        throw new Error(errorData.message || `Ошибка авторизации на сервере (${response.status})`);
      }
      
      const authResult = await response.json();
      
      if (!authResult.success) {
        throw new Error(authResult.message || 'Ошибка валидации на сервере');
      }
      
      // Проверяем наличие токена и сохраняем его
      if (!authResult.token) {
        throw new Error('Токен авторизации отсутствует в ответе сервера');
      }
      
      // Сохраняем токен в localStorage напрямую и через authService
      try {
        localStorage.setItem('auth_token', authResult.token);
        
        // Также сохраняем через authService для дублирования
        authService.saveToken(authResult.token);
      } catch (storageError) {
        // Продолжаем, так как основное сохранение в localStorage уже произошло
      }
      
      // Сохраняем данные пользователя
      try {
        // Формируем user_id из FID пользователя
        const userId = authResult.user.id;
        
        // Синхронизируем user_id и game_id
        authService.syncUserAndGameIds(userId);
        
        // Сохраняем данные пользователя через authService
        authService.saveUserData(authResult.user);
        
        // Устанавливаем флаг авторизации
        authService.setAuthenticated(true);
        
        // Если есть информация о состоянии игры, логируем ее
        if (authResult.gameState) {
          logAuth(
            AuthStep.AUTH_COMPLETE,
            AuthLogType.INFO,
            `Информация о прогрессе игры: ${authResult.gameState.exists ? 'найдена' : 'не найдена'}`,
            {
              userId,
              gameExists: authResult.gameState.exists,
              lastSaved: authResult.gameState.lastSaved,
              version: authResult.gameState.version
            }
          );
        }
      } catch (userError) {
        // Обрабатываем ошибку сохранения данных пользователя
      }
      
      logAuth(
        AuthStep.AUTH_COMPLETE, 
        AuthLogType.INFO, 
        'Авторизация через Farcaster успешно завершена', 
        { userId: authResult.user?.id, fid: authResult.user?.fid }
      );
      
      clearTimeout(authTimeoutId);
      setIsAuthorizing(false);
      onSuccess({
        user: {
          id: authResult.user.id,
          fid: authResult.user.fid,
          username: authResult.user.username,
          displayName: authResult.user.displayName,
          avatar: authResult.user.avatar
        },
        token: authResult.token,
        gameState: authResult.gameState
      });
    } catch (error) {
      clearTimeout(authTimeoutId);
      
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
  }, [sdkStatus, onSuccess, onError]);

  // Автоматическая авторизация, если пользователь уже получен через SDK
  useEffect(() => {
    if (sdkStatus === 'ready' && sdkUser && sdkUser.fid && !isAuthorizing && !authError) {
      handleFarcasterAuth();
    }
  }, [sdkStatus, sdkUser, handleFarcasterAuth, isAuthorizing, authError]);

  // Рендер компонента
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
          <button 
            onClick={() => {
              setAuthError(null);
              if (sdkStatus === 'ready') {
                 handleFarcasterAuth();
              }
            }}
            disabled={sdkStatus !== 'ready'}
            className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition"
          >
            Попробовать снова
          </button>
        </div>
      /* Показываем кнопку авторизации, если SDK готов */
      ) : (
        <button
          onClick={handleFarcasterAuth}
          className="w-full flex items-center justify-center px-4 py-3 font-medium rounded-xl bg-gradient-to-r from-purple-700 to-violet-800 hover:from-purple-600 hover:to-violet-700 transition-all duration-300 text-white"
        >
          <img 
            src="/images/farcaster-logo.svg" 
            alt="Farcaster" 
            className="w-5 h-5 mr-2" 
          />
          Войти через Farcaster
        </button>
      )}
    </div>
  );
} 