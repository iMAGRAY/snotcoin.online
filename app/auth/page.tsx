'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FarcasterLogin from '@/app/components/auth/FarcasterLogin';
import FarcasterUserInfo from '@/app/components/auth/FarcasterUserInfo';
import { useFarcaster } from '@/app/contexts/FarcasterContext';

export default function AuthPage() {
  const [isPageLoading, setIsPageLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/game';
  const { isAuthenticated, isLoading, refreshUserData } = useFarcaster();

  useEffect(() => {
    // Проверяем статус аутентификации при загрузке страницы
    setIsPageLoading(true);
    const checkAuth = async () => {
      await refreshUserData();
      setIsPageLoading(false);
    };
    
    checkAuth();
  }, [refreshUserData]);

  // После успешной авторизации переходим на redirectPath
  const handleLoginSuccess = async () => {
    // Обновляем данные в контексте
    await refreshUserData();
    
    // Проверяем статус аутентификации после обновления данных
    if (isAuthenticated) {
      router.push(redirectPath);
    }
  };

  if (isPageLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-center mb-6">Авторизация через Farcaster</h2>
          
          {isAuthenticated ? (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-700 text-center">
                Вы уже авторизованы!
              </div>
              
              <FarcasterUserInfo />
              
              <div className="flex justify-center">
                <button 
                  onClick={() => router.push(redirectPath)} 
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition"
                >
                  Продолжить
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-gray-600 text-center mb-6">
                Для игры в Snotcoin вам необходимо авторизоваться через Farcaster.
              </p>
              
              <div className="flex justify-center">
                <FarcasterLogin 
                  onSuccess={handleLoginSuccess}
                  buttonText="Войти через Farcaster"
                  buttonClass="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md font-medium text-lg"
                />
              </div>
              
              <p className="text-sm text-gray-500 text-center mt-4">
                Впервые используете Farcaster? <a href="https://warpcast.com/download" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Скачайте Warpcast</a> для входа.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 