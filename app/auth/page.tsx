'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FarcasterLogin from '@/app/components/auth/FarcasterLogin';
import FarcasterUserInfo from '@/app/components/auth/FarcasterUserInfo';
import { useFarcaster } from '@/app/contexts/FarcasterContext';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/home';
  const { user, isLoading, isAuthenticated, refreshUserData } = useFarcaster();

  // После успешной авторизации переходим на redirectUrl
  const handleLoginSuccess = async () => {
    // Обновляем данные в контексте
    await refreshUserData();
    
    // Проверяем статус аутентификации после обновления данных
    if (isAuthenticated) {
      router.push(redirectUrl);
    }
  };

  // Если пользователь уже авторизован, перенаправляем его
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push(redirectUrl);
    }
  }, [isAuthenticated, isLoading, redirectUrl, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Авторизация через Farcaster</h1>
        
        {isLoading ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
          </div>
        ) : isAuthenticated ? (
          <div className="flex flex-col items-center">
            <FarcasterUserInfo />
            <p className="mt-4 text-gray-600">
              Вы уже авторизованы. Перенаправление...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <p className="mb-6 text-gray-600 text-center">
              Для использования приложения необходимо авторизоваться через Farcaster. 
              Это позволит связать ваш аккаунт с игровой статистикой.
            </p>
            
            <FarcasterLogin 
              onSuccess={handleLoginSuccess}
              buttonSize="large"
            />
            
            <p className="mt-6 text-sm text-gray-500 text-center">
              Для использования Farcaster вам необходимо установить приложение <a href="https://warpcast.com/download" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Warpcast</a> или использовать веб-версию <a href="https://warpcast.com/" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Warpcast Web</a>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 