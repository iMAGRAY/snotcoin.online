'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useFarcaster } from '@/app/contexts/FarcasterContext';

interface FarcasterUserInfoProps {
  compact?: boolean;
  showLogout?: boolean;
}

export default function FarcasterUserInfo({ 
  compact = false,
  showLogout = true
}: FarcasterUserInfoProps) {
  const { user, isLoading, logout } = useFarcaster();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Если загрузка данных, показываем индикатор загрузки
  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Если пользователь не авторизован, не отображаем компонент
  if (!user) {
    return null;
  }

  // Обработчик для выхода из системы
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Компактный вид для навигации
  if (compact) {
    return (
      <div className="flex items-center">
        {user.pfp ? (
          <Image 
            src={user.pfp} 
            alt={user.displayName || user.username} 
            width={24} 
            height={24} 
            className="rounded-full"
          />
        ) : (
          <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
            <span className="text-xs text-purple-600 font-medium">
              {(user.displayName || user.username).substring(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        
        <span className="ml-2 text-sm font-medium truncate max-w-[100px]">
          {user.displayName || user.username}
        </span>
        
        {showLogout && (
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="ml-2 text-gray-500 hover:text-gray-800"
          >
            {isLoggingOut ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            )}
          </button>
        )}
      </div>
    );
  }

  // Полный вид для страницы профиля
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center">
        {user.pfp ? (
          <Image 
            src={user.pfp} 
            alt={user.displayName || user.username} 
            width={64} 
            height={64} 
            className="rounded-full"
          />
        ) : (
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
            <span className="text-2xl text-purple-600 font-medium">
              {(user.displayName || user.username).substring(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        
        <div className="ml-4">
          <h3 className="text-lg font-semibold">
            {user.displayName || user.username}
          </h3>
          <p className="text-gray-600">@{user.username}</p>
          <div className="mt-1 flex items-center text-sm text-gray-500">
            <span>FID: {user.fid}</span>
            <a 
              href={`https://warpcast.com/${user.username}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-2 text-purple-600 hover:underline flex items-center"
            >
              Профиль в Warpcast
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>
      
      {showLogout && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm flex items-center transition duration-200"
          >
            {isLoggingOut ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-2"></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            )}
            Выйти
          </button>
        </div>
      )}
    </div>
  );
} 