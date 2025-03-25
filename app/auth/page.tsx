'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import NeynarAuth from '../components/auth/NeynarAuth';
import { useFarcaster } from '@/app/contexts/FarcasterContext';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useFarcaster();
  
  // Получаем URL для редиректа после успешной авторизации
  const redirectUrl = searchParams.get('redirect') || '/';
  
  // Если пользователь уже авторизован, перенаправляем его
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.replace(redirectUrl);
    }
  }, [isAuthenticated, isLoading, redirectUrl, router]);
  
  // Обработчик успешной авторизации
  const handleAuthSuccess = (userData: any) => {
    console.log('Авторизация успешна:', userData);
    
    // Перенаправляем на указанную страницу после успешной авторизации
    setTimeout(() => {
      router.replace(redirectUrl);
    }, 1000);
  };
  
  // Обработчик ошибки авторизации
  const handleAuthError = (error: string) => {
    console.error('Ошибка авторизации:', error);
  };
  
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mb-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
          Авторизация
        </h1>
        <p className="text-gray-600 text-center">
          Войдите в аккаунт для доступа к приложению
        </p>
      </div>
      
      {/* Используем компонент NeynarAuth для авторизации через Farcaster */}
      <NeynarAuth
        onSuccess={handleAuthSuccess}
        onError={handleAuthError}
      />
      
      <div className="mt-8 text-sm text-gray-500 max-w-md text-center">
        <p>
          Используя этот сервис, вы соглашаетесь с нашими 
          условиями использования и политикой конфиденциальности.
        </p>
      </div>
    </div>
  );
} 