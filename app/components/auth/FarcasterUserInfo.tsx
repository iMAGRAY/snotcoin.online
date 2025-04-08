'use client';

import { useState } from 'react';
import { useFarcaster } from '@/app/contexts/FarcasterContext';
import Image from 'next/image';

interface FarcasterUserInfoProps {
  compact?: boolean;
  showLogout?: boolean;
  className?: string;
}

export default function FarcasterUserInfo({
  compact = false,
  showLogout = true,
  className = '',
}: FarcasterUserInfoProps) {
  const { sdkUser, sdkStatus } = useFarcaster();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const isLoading = sdkStatus === 'loading';
  const user = sdkUser; // Для обратной совместимости с остальным кодом

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Функция logout удалена из контекста, поэтому просто загружаем страницу заново
      window.location.reload();
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center text-gray-500 ${className}`}>
        <div className="animate-spin mr-2 w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
        {!compact && <span>Загрузка...</span>}
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (compact) {
    return (
      <div className={`flex items-center ${className}`}>
        {user?.pfp?.url ? (
          <Image
            src={user.pfp.url}
            alt={user.displayName || user.username}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600">
            {(user.displayName || user.username || '').charAt(0).toUpperCase()}
          </div>
        )}
        <span className="ml-2 font-medium">
          {user.displayName || `@${user.username}`}
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden shadow-sm border border-gray-200 ${className}`}>
      <div className="flex items-start p-4 bg-white">
        <div className="flex-shrink-0">
          {user?.pfp?.url ? (
            <Image
              src={user.pfp.url}
              alt={user.displayName || user.username}
              width={48}
              height={48}
              className="rounded-full"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-lg">
              {(user.displayName || user.username || '').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        
        <div className="ml-3">
          {user.displayName && (
            <h3 className="font-medium text-gray-900">{user.displayName}</h3>
          )}
          <p className="text-gray-600 text-sm">@{user.username}</p>
          <p className="text-gray-500 text-xs mt-1">FID: {user.fid}</p>
        </div>
      </div>
      
      {showLogout && (
        <div className="bg-gray-50 px-4 py-2 text-right">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="text-sm text-gray-600 hover:text-red-600 transition"
          >
            {isLoggingOut ? 'Выход...' : 'Выйти'}
          </button>
        </div>
      )}
    </div>
  );
} 