'use client';

import React, { useState, useEffect } from 'react';
import { useFarcaster } from '@/app/contexts/FarcasterContext';
import Image from 'next/image';

// Добавляем объявление для window.onSignInSuccess
declare global {
  interface Window {
    onSignInSuccess: (data: any) => void;
  }
}

interface NeynarAuthProps {
  onSuccess?: (userData: any) => void;
  onError?: (error: string) => void;
}

export default function NeynarAuth({ onSuccess, onError }: NeynarAuthProps) {
  const { refreshUserData } = useFarcaster();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<string>('');

  // Загружаем SIWN скрипт
  const loadSiwnScript = () => {
    // Проверяем, не загружен ли уже скрипт
    if (document.getElementById('neynar-siwn-script')) {
      return;
    }

    // Создаем элемент скрипта
    const script = document.createElement('script');
    script.id = 'neynar-siwn-script';
    script.src = 'https://neynarxyz.github.io/siwn/raw/1.2.0/index.js';
    script.async = true;
    
    // Добавляем скрипт на страницу
    document.body.appendChild(script);
    
    // Определяем функцию обратного вызова
    window.onSignInSuccess = async (data: any) => {
      console.log("SIWN success data:", data);
      setStatus('success');
      setStatusMessage('Авторизация успешна!');
      
      try {
        // Обновляем данные пользователя в контексте
        await refreshUserData();
        
        // Вызываем коллбэк успешной авторизации
        onSuccess?.(data.user);
      } catch (error) {
        console.error("Error after SIWN success:", error);
        setStatus('error');
        setStatusMessage('Ошибка при обновлении данных пользователя');
        
        if (error instanceof Error) {
          setErrorDetails(error.message);
          onError?.(error.message);
        } else {
          setErrorDetails('Неизвестная ошибка');
          onError?.('Неизвестная ошибка');
        }
      }
    };
  };

  // Загружаем SIWN скрипт при монтировании компонента
  useEffect(() => {
    loadSiwnScript();
    
    return () => {
      // Очистка при размонтировании
      const script = document.getElementById('neynar-siwn-script');
      if (script) {
        script.remove();
      }
      
      // Удаляем обработчик, если он существует
      if (window.onSignInSuccess) {
        window.onSignInSuccess = null as any;
      }
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
          
          <div
            className="neynar_signin"
            data-client_id={process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID}
            data-success-callback="onSignInSuccess"
            data-theme="dark"
          />
          
          <p className="text-sm text-gray-500 mt-4">
            Требуется аккаунт Farcaster и приложение Warpcast
          </p>
        </div>
      )}
      
      {status === 'loading' && (
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
          <p className="text-gray-600 text-center">{statusMessage}</p>
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
            {errorDetails && <p className="text-xs mt-2">{errorDetails}</p>}
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