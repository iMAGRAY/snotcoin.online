'use client';

import React, { useState, useEffect, useRef } from 'react';
import { authService } from '@/app/services/auth/authService';
import { useFarcaster } from '@/app/contexts/FarcasterContext';
import { logAuthInfo, AuthStep, AuthLogType, logAuth } from '@/app/utils/auth-logger';
import type { FarcasterContext } from '@farcaster/auth-kit';

// Интерфейс пропсов компонента
interface WarpcastAuthProps {
  onSuccess: (userData: any) => void;
  onError: (error: string) => void;
}

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
    
    const farcaster = window.farcaster;
    
    // Проверяем, есть ли необходимые методы
    if (!farcaster.getContext) {
      return false;
    }
    
    return true;
  };

  // Функция для загрузки SDK скрипта
  const loadFarcasterSDK = () => {
    // Проверяем, не загружен ли скрипт уже
    if (document.getElementById('farcaster-sdk-script')) {
      return;
    }
    
    logAuthInfo(AuthStep.FARCASTER_INIT, 'Загрузка Farcaster SDK скрипта');
    
    // Загружаем официальный Warpcast SDK
    const script = document.createElement('script');
    script.src = 'https://warpcast.com/~/sdk.js';
    script.id = 'farcaster-sdk-script';
    script.async = true;
    script.onload = () => {
      // При загрузке скрипта попробуем сразу инициализировать SDK
      if (window.farcaster && typeof window.farcaster.ready === 'function') {
        try {
          window.farcaster.ready();
          logAuthInfo(AuthStep.FARCASTER_INIT, 'SDK успешно загружен и инициализирован');
        } catch (error) {
          console.error('Ошибка при вызове farcaster.ready()', error);
          logAuth(AuthStep.FARCASTER_INIT, AuthLogType.ERROR, 'Ошибка при инициализации SDK', {}, error);
        }
      }
    };
    script.onerror = (e) => {
      console.error('Ошибка загрузки Farcaster SDK скрипта', e);
      logAuth(AuthStep.FARCASTER_INIT, AuthLogType.ERROR, 'Ошибка загрузки SDK скрипта', {}, e);
    };
    document.body.appendChild(script);
  };

  // Функция для авторизации через Farcaster
  const handleFarcasterAuth = async () => {
    try {
      logAuth(AuthStep.AUTH_START, AuthLogType.INFO, 'Начало авторизации через Farcaster');
      
      // Если SDK не доступен, показываем ошибку
      if (!checkFarcasterSDK()) {
        throw new Error('Farcaster SDK не доступен. Пожалуйста, используйте Warpcast браузер или расширение.');
      }
      
      // Получаем данные пользователя из SDK
      const userData = await window.farcaster!.getContext();
      
      if (!userData || !userData.fid) {
        throw new Error('Не удалось получить данные пользователя из Farcaster');
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
        throw new Error(authResult.error || 'Не удалось авторизоваться');
      }
      
      // Обновляем данные пользователя в контексте
      await refreshUserData();
      
      logAuth(
        AuthStep.AUTH_COMPLETE, 
        AuthLogType.INFO, 
        'Авторизация через Farcaster успешно завершена', 
        { userId: authResult.data?.user?.id }
      );
      
      // Передаем данные в колбэк
      onSuccess(authResult.data);
    } catch (error) {
      console.error('Ошибка авторизации через Farcaster:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка авторизации';
      setErrorMessage(errorMessage);
      
      logAuth(
        AuthStep.AUTH_ERROR, 
        AuthLogType.ERROR, 
        'Ошибка при авторизации через Farcaster', 
        {}, 
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
        loadFarcasterSDK();
        
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
      await handleFarcasterAuth();
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