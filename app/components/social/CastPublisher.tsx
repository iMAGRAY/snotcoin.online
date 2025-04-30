'use client';

import React, { useState } from 'react';
import { useFarcaster } from '@/app/contexts/FarcasterContext';
// Импортируем FarcasterSDK напрямую из глобального типа, определенного в farcaster.d.ts
// import { FarcasterSDK } from '@/app/types/farcaster';

interface CastPublisherProps {
  defaultText?: string;
  placeholder?: string;
  buttonText?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  maxLength?: number;
}

export default function CastPublisher({
  defaultText = '',
  placeholder = 'Сказать что-то о RoyaleWay...',
  buttonText = 'Опубликовать',
  onSuccess,
  onError,
  maxLength = 280,
}: CastPublisherProps) {
  const [text, setText] = useState(defaultText);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState(false);
  const { sdkUser } = useFarcaster();
  
  const isAuthenticated = !!sdkUser;

  const handlePublish = async () => {
    if (!text.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      if (typeof window !== 'undefined' && window.farcaster) {
        const farcaster = window.farcaster;
        if (farcaster.publishCast) {
          await farcaster.publishCast(text.trim());
          setText('');
          setSuccess(true);
          onSuccess?.();
        }
      }
    } catch (error) {
      console.error('Error publishing cast:', error);
      onError?.(error instanceof Error ? error : new Error('Failed to publish cast'));
    } finally {
      setIsLoading(false);
    }
  };

  // Если пользователь не авторизован, отображаем сообщение
  if (!isAuthenticated) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <p className="text-gray-500">Войдите через Farcaster, чтобы публиковать сообщения</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={isLoading}
          className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          rows={3}
        />
        <div className="absolute bottom-2 right-2 text-xs text-gray-500">
          {text.length}/{maxLength}
        </div>
      </div>
      
      <div className="mt-3 flex justify-between items-center">
        <div>
          {error && (
            <p className="text-red-500 text-sm">{error.message}</p>
          )}
          {success && (
            <p className="text-green-500 text-sm">Сообщение опубликовано!</p>
          )}
        </div>
        
        <button
          onClick={handlePublish}
          disabled={isLoading || !text.trim()}
          className={`px-4 py-2 rounded-full font-medium text-white 
            ${isLoading || !text.trim() 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-purple-600 hover:bg-purple-700 transition duration-200'
            }`}
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Публикация...
            </span>
          ) : buttonText}
        </button>
      </div>
    </div>
  );
} 