'use client';

import React, { useState, useEffect } from 'react';
import { logAuthInfo, AuthStep } from '@/app/utils/auth-logger';

// Объявляем интерфейс для Farcaster Context
interface FarcasterContext {
  fid: number;
  username: string;
  displayName: string;
  pfp?: {
    url: string;
    verified: boolean;
  };
  verified: boolean;
  custody?: {
    address: string;
    type: string;
  };
  verifications?: string[];
  domain?: string;
  url?: string;
}

interface WarpcastAuthProps {
  onSuccess: (userData: any) => void;
  onError: (error: string) => void;
}

export default function WarpcastAuth({ onSuccess, onError }: WarpcastAuthProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const initWarpcastAuth = async () => {
      try {
        logAuthInfo(AuthStep.INIT, 'Инициализация авторизации через Warpcast');
        
        // Проверяем доступность Farcaster SDK
        if (typeof window === 'undefined' || !window.farcaster) {
          logAuthInfo(AuthStep.AUTH_ERROR, 'Farcaster SDK не доступен в этом окружении');
          setErrorMessage('Farcaster SDK не доступен. Пожалуйста, откройте страницу в Warpcast.');
          setIsLoading(false);
          return;
        }

        // Уведомляем Farcaster, что страница готова
        window.farcaster.ready();
        
        logAuthInfo(AuthStep.AUTH_START, 'Запрос пользовательских данных Farcaster');
        
        // Запрашиваем информацию о пользователе
        const userContext: FarcasterContext = await window.farcaster.getContext();
        
        if (!userContext || !userContext.fid) {
          logAuthInfo(AuthStep.AUTH_ERROR, 'Не удалось получить данные пользователя Farcaster');
          setErrorMessage('Не удалось получить данные пользователя. Пожалуйста, войдите в Warpcast.');
          setIsLoading(false);
          return;
        }
        
        logAuthInfo(AuthStep.VALIDATE_DATA, 'Получены данные пользователя Farcaster', {
          fid: userContext.fid,
          username: userContext.username
        });

        // Отправляем данные на сервер для валидации и создания JWT
        const response = await fetch('/api/farcaster/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fid: userContext.fid,
            username: userContext.username,
            displayName: userContext.displayName,
            pfp: userContext.pfp?.url,
          }),
        });

        const data = await response.json();

        if (data.success) {
          logAuthInfo(AuthStep.AUTH_COMPLETE, 'Авторизация через Warpcast успешна');
          onSuccess(data);
        } else {
          logAuthInfo(AuthStep.AUTH_ERROR, 'Ошибка при обработке данных пользователя', { error: data.message });
          setErrorMessage(data.message || 'Ошибка авторизации');
          onError(data.message || 'Ошибка авторизации');
        }
      } catch (error) {
        logAuthInfo(AuthStep.AUTH_ERROR, 'Неожиданная ошибка при авторизации через Warpcast', {
          error: error instanceof Error ? error.message : String(error)
        });
        const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
        setErrorMessage(errorMsg);
        onError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    initWarpcastAuth();
  }, [onSuccess, onError]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-center mb-4">Авторизация через Warpcast</h2>
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
          <p className="text-gray-600 text-center">Подключение к Warpcast...</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-center mb-4">Ошибка авторизации</h2>
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4 w-full text-center">
          <p className="font-bold">Не удалось подключиться к Warpcast</p>
          <p>{errorMessage}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Для авторизации откройте эту страницу в приложении Warpcast.
          </p>
          <a 
            href="https://warpcast.com/~/launch?url=https://snotcoin.online" 
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full transition-colors inline-block"
          >
            Открыть в Warpcast
          </a>
        </div>
      </div>
    );
  }

  return null; // Если авторизация прошла успешно, компонент не будет отображаться
} 