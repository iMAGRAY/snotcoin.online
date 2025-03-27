'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sdkCheckAttempts, setSdkCheckAttempts] = useState(0);
  const authAttemptedRef = useRef(false);
  const { refreshUserData, isAuthenticated } = useFarcaster();
  
  // Функция для проверки наличия SDK
  const checkFarcasterSDK = (): boolean => {
    // Если пользователь уже аутентифицирован, сразу возвращаем true
    if (isAuthenticated) {
      return true;
    }
    
    if (typeof window === 'undefined') {
      return false;
    }
    
    // Проверяем, доступен ли объект farcaster в браузере
    if (typeof window.farcaster === 'undefined') {
      return false;
    }
    
    const farcaster = window.farcaster as FarcasterSDK;
    
    // Проверяем наличие всех необходимых методов
    return typeof farcaster.ready === 'function' &&
           typeof farcaster.getContext === 'function' &&
           typeof farcaster.fetchUserByFid === 'function';
  };

  // Функция для загрузки SDK скрипта
  const loadFarcasterSDK = async (): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      // Проверяем поддержку браузера
      if (!checkBrowserSupport()) {
        reject(new Error(FARCASTER_SDK.ERROR_CODES.BROWSER_NOT_SUPPORTED));
        return;
      }

      // Проверяем, не загружен ли скрипт уже
      if (document.getElementById('farcaster-sdk-script')) {
        resolve();
        return;
      }
      
      logAuthInfo(AuthStep.FARCASTER_INIT, 'Загрузка Farcaster SDK скрипта');
      
      // Загружаем официальный Warpcast SDK
      const script = document.createElement('script');
      script.src = FARCASTER_SDK.SCRIPT_URL;
      script.id = 'farcaster-sdk-script';
      script.async = true;

      // Таймаут загрузки
      const timeoutId = setTimeout(() => {
        reject(new Error(FARCASTER_SDK.ERROR_CODES.SDK_NOT_LOADED));
      }, FARCASTER_SDK.TIMEOUT.SDK_LOAD);

      script.onload = async () => {
        clearTimeout(timeoutId);
        const farcaster = window.farcaster as FarcasterSDK;
        if (farcaster && typeof farcaster.ready === 'function') {
          try {
            await farcaster.ready();
            logAuthInfo(AuthStep.FARCASTER_INIT, 'SDK успешно загружен и инициализирован');
            resolve();
          } catch (error) {
            console.error('Ошибка при вызове farcaster.ready()', error);
            logAuth(AuthStep.FARCASTER_INIT, AuthLogType.ERROR, 'Ошибка при инициализации SDK', {}, error);
            reject(error);
          }
        } else {
          reject(new Error(FARCASTER_SDK.ERROR_CODES.SDK_NOT_LOADED));
        }
      };

      script.onerror = (e) => {
        clearTimeout(timeoutId);
        console.error('Ошибка загрузки Farcaster SDK скрипта', e);
        logAuth(AuthStep.FARCASTER_INIT, AuthLogType.ERROR, 'Ошибка загрузки SDK скрипта', {}, e);
        reject(new Error(FARCASTER_SDK.ERROR_CODES.NETWORK_ERROR));
      };

      document.body.appendChild(script);
    });
  };

  // Функция для авторизации через Farcaster
  const handleFarcasterAuth = async () => {
    const authTimeoutId = setTimeout(() => {
      setErrorMessage('Превышено время ожидания авторизации');
      setIsLoading(false);
    }, FARCASTER_SDK.TIMEOUT.AUTH_PROCESS);

    try {
      logAuth(AuthStep.AUTH_START, AuthLogType.INFO, 'Начало авторизации через Farcaster');
      
      // Если SDK не доступен, показываем ошибку
      if (!checkFarcasterSDK()) {
        throw new Error(FARCASTER_SDK.ERROR_CODES.SDK_NOT_LOADED);
      }
      
      const farcaster = window.farcaster as FarcasterSDK;
      
      // Ждем готовности SDK
      if (!farcaster.isReady) {
        await farcaster.ready();
      }
      
      // Получаем данные пользователя из SDK
      const userData = await farcaster.getContext() as FarcasterContext;
      
      if (!userData || !userData.fid) {
        throw new Error(FARCASTER_SDK.ERROR_CODES.INVALID_RESPONSE);
      }
      
      logAuth(
        AuthStep.VALIDATE_DATA, 
        AuthLogType.INFO, 
        'Получены данные пользователя из Farcaster', 
        { fid: userData.fid, username: userData.username }
      );
      
      // Авторизуемся через сервис
      const authResult = await authService.loginWithFarcaster(userData);
      
      if (!authResult.success) {
        throw new Error(
          typeof authResult.error === 'string' 
            ? authResult.error 
            : FARCASTER_SDK.ERROR_CODES.AUTH_FAILED
        );
      }
      
      // Обновляем данные пользователя в контексте
      await refreshUserData();
      
      logAuth(
        AuthStep.AUTH_COMPLETE, 
        AuthLogType.INFO, 
        'Авторизация через Farcaster успешно завершена', 
        { userId: authResult.data?.user?.id }
      );
      
      clearTimeout(authTimeoutId);
      onSuccess(authResult.data as UserData);
    } catch (error) {
      clearTimeout(authTimeoutId);
      console.error('Ошибка авторизации через Farcaster:', error);
      
      let errorMessage = 'Неизвестная ошибка авторизации';
      if (error instanceof Error) {
        switch (error.message) {
          case FARCASTER_SDK.ERROR_CODES.BROWSER_NOT_SUPPORTED:
            errorMessage = 'Ваш браузер не поддерживается. Пожалуйста, обновите браузер или используйте другой.';
            break;
          case FARCASTER_SDK.ERROR_CODES.SDK_NOT_LOADED:
            errorMessage = 'Не удалось загрузить Farcaster SDK. Пожалуйста, используйте Warpcast браузер или установите расширение.';
            break;
          case FARCASTER_SDK.ERROR_CODES.AUTH_FAILED:
            errorMessage = 'Не удалось авторизоваться. Пожалуйста, попробуйте снова.';
            break;
          case FARCASTER_SDK.ERROR_CODES.USER_REJECTED:
            errorMessage = 'Вы отменили авторизацию.';
            break;
          case FARCASTER_SDK.ERROR_CODES.NETWORK_ERROR:
            errorMessage = 'Ошибка сети. Пожалуйста, проверьте подключение к интернету.';
            break;
          case FARCASTER_SDK.ERROR_CODES.INVALID_RESPONSE:
            errorMessage = 'Получены некорректные данные от Farcaster.';
            break;
          default:
            errorMessage = error.message;
        }
      }
      
      setErrorMessage(errorMessage);
      
      logAuth(
        AuthStep.AUTH_ERROR, 
        AuthLogType.ERROR, 
        'Ошибка при авторизации через Farcaster', 
        { errorCode: error instanceof Error ? error.message : 'UNKNOWN' }, 
        error
      );
      
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Эффект для инициализации SDK и авторизации
  useEffect(() => {
    // Предотвращаем повторные попытки авторизации
    if (authAttemptedRef.current) return;
    
    // Проверяем наличие SDK или загружаем его
    const initAuth = async () => {
      // Если пользователь уже аутентифицирован, выходим
      if (isAuthenticated) {
        setIsLoading(false);
        return;
      }
      
      const hasSdk = checkFarcasterSDK();
      
      if (!hasSdk) {
        // Если SDK нет, загружаем его
        loadFarcasterSDK()
          .then(() => {
            authAttemptedRef.current = true;
            handleFarcasterAuth();
          })
          .catch((error) => {
            console.error('Ошибка при загрузке SDK:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Неизвестная ошибка');
            setIsLoading(false);
          });
        
        // Увеличиваем счетчик попыток
        setSdkCheckAttempts(prev => prev + 1);
        
        // Если уже было много попыток, показываем сообщение пользователю
        if (sdkCheckAttempts >= 3) {
          setErrorMessage('Не удалось загрузить Farcaster SDK. Пожалуйста, используйте Warpcast браузер или установите расширение.');
          setIsLoading(false);
        }
        
        return;
      }
      
      authAttemptedRef.current = true;
      handleFarcasterAuth();
    };
    
    initAuth();
    
    // Повторно проверяем SDK каждые 2 секунды, если он еще не загружен
    const intervalId = setInterval(() => {
      if (checkFarcasterSDK() && !authAttemptedRef.current) {
        clearInterval(intervalId);
        authAttemptedRef.current = true;
        handleFarcasterAuth();
      }
    }, 2000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [sdkCheckAttempts, isAuthenticated, refreshUserData]);

  // Рендер компонента
  return (
    <div className="flex flex-col items-center space-y-4">
      {isLoading ? (
        <div className="py-4 w-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-gray-300">Подключение к Farcaster...</span>
        </div>
      ) : errorMessage ? (
        <div className="bg-red-900/30 p-4 rounded-lg w-full">
          <p className="text-red-400 text-sm">{errorMessage}</p>
          <button 
            onClick={() => {
              setErrorMessage(null);
              setIsLoading(true);
              authAttemptedRef.current = false;
              setSdkCheckAttempts(0);
            }}
            className="mt-2 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg text-sm"
          >
            Попробовать снова
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setIsLoading(true);
            authAttemptedRef.current = false;
            handleFarcasterAuth();
          }}
          className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-colors bg-purple-600 hover:bg-purple-700 text-white"
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
      )}
      
      <p className="text-xs text-gray-500 text-center">
        Требуется аккаунт Farcaster. <a href="https://warpcast.com/download" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Скачать Warpcast</a>
      </p>
    </div>
  );
} 