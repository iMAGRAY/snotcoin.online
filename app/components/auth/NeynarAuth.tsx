'use client';

import React, { useState, useEffect } from 'react';
import { useFarcaster } from '@/app/contexts/FarcasterContext';
import Image from 'next/image';

interface NeynarAuthProps {
  onSuccess?: (userData: any) => void;
  onError?: (error: string) => void;
}

export default function NeynarAuth({ onSuccess, onError }: NeynarAuthProps) {
  const { refreshUserData } = useFarcaster();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'polling' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Функция для создания нового запроса на авторизацию
  const initiateAuth = async () => {
    try {
      setStatus('loading');
      setStatusMessage('Инициализация авторизации...');

      const response = await fetch('/api/farcaster/neynar-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!data.success) {
        setStatus('error');
        setStatusMessage(data.message || 'Ошибка при запросе авторизации');
        onError?.(data.message || 'Ошибка при запросе авторизации');
        return;
      }

      // Сохраняем данные для авторизации
      setAuthToken(data.authRequest.token);
      setQrCode(data.authRequest.qrCode);
      setAuthUrl(data.authRequest.url);
      
      // Начинаем опрос статуса авторизации
      setStatus('polling');
      setStatusMessage('Ожидание подтверждения в приложении Warpcast...');
      
      // Запускаем интервал опроса
      startPolling(data.authRequest.token);
    } catch (error) {
      console.error('Error initiating auth:', error);
      setStatus('error');
      setStatusMessage('Ошибка при запросе авторизации');
      onError?.(error instanceof Error ? error.message : 'Неизвестная ошибка');
    }
  };

  // Функция для опроса статуса авторизации
  const checkAuthStatus = async (token: string) => {
    try {
      const response = await fetch(`/api/farcaster/neynar-auth?token=${token}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        // Авторизация успешна, останавливаем опрос
        stopPolling();
        setStatus('success');
        setStatusMessage('Авторизация успешна!');
        
        // Обновляем данные пользователя в FarcasterContext
        await refreshUserData();
        
        // Вызываем коллбэк успешной авторизации
        onSuccess?.(data.user);
        return;
      }
      
      // Проверяем статус авторизации
      if (data.status === 'expired') {
        stopPolling();
        setStatus('error');
        setStatusMessage('Срок действия запроса истек. Попробуйте еще раз.');
        onError?.('Срок действия запроса истек');
      } else if (data.status === 'pending') {
        // Продолжаем опрос
        setStatusMessage('Ожидание подтверждения...');
      } else {
        // Другая ошибка
        stopPolling();
        setStatus('error');
        setStatusMessage(data.message || 'Ошибка авторизации');
        onError?.(data.message || 'Ошибка авторизации');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      stopPolling();
      setStatus('error');
      setStatusMessage('Ошибка при проверке статуса авторизации');
      onError?.(error instanceof Error ? error.message : 'Неизвестная ошибка');
    }
  };

  // Функция для запуска опроса статуса авторизации
  const startPolling = (token: string) => {
    // Проверяем статус сразу
    checkAuthStatus(token);
    
    // Запускаем интервал опроса каждые 2 секунды
    const interval = setInterval(() => {
      checkAuthStatus(token);
    }, 2000);
    
    setPollingInterval(interval);
  };

  // Функция для остановки опроса
  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  // Очищаем интервал при размонтировании компонента
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center mb-4">Войти с Farcaster</h2>
      
      {status === 'idle' && (
        <div className="flex flex-col items-center">
          <p className="text-gray-600 mb-4 text-center">
            Авторизуйтесь через Farcaster для доступа к приложению
          </p>
          <button
            onClick={initiateAuth}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full transition-colors"
          >
            Войти с Farcaster
          </button>
        </div>
      )}
      
      {status === 'loading' && (
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
          <p className="text-gray-600 text-center">{statusMessage}</p>
        </div>
      )}
      
      {status === 'polling' && qrCode && (
        <div className="flex flex-col items-center">
          <p className="text-gray-600 mb-4 text-center">
            Отсканируйте QR-код в приложении Warpcast или нажмите на кнопку ниже
          </p>
          
          <div className="mb-4 bg-white p-2 rounded-lg border border-gray-200">
            <Image
              src={qrCode}
              alt="QR Code for Farcaster auth"
              width={200}
              height={200}
              className="mx-auto"
            />
          </div>
          
          <p className="text-sm text-gray-500 mb-4 text-center">
            {statusMessage}
          </p>
          
          {authUrl && (
            <a
              href={authUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full transition-colors"
            >
              Открыть в приложении Warpcast
            </a>
          )}
          
          <button
            onClick={() => {
              stopPolling();
              setStatus('idle');
            }}
            className="mt-4 text-gray-500 hover:text-gray-700 underline"
          >
            Отменить
          </button>
        </div>
      )}
      
      {status === 'success' && (
        <div className="flex flex-col items-center">
          <div className="bg-green-100 text-green-700 p-4 rounded-lg mb-4 w-full text-center">
            <p className="font-bold">Успешно!</p>
            <p>{statusMessage}</p>
          </div>
        </div>
      )}
      
      {status === 'error' && (
        <div className="flex flex-col items-center">
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4 w-full text-center">
            <p className="font-bold">Ошибка!</p>
            <p>{statusMessage}</p>
          </div>
          <button
            onClick={() => setStatus('idle')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      )}
    </div>
  );
} 