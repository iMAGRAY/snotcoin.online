'use client'

import React from 'react';

interface LoadingScreenProps {
  isLoading?: boolean;
  hasError?: boolean;
  debugMessage?: string;
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  isLoading = true, 
  hasError = false, 
  debugMessage = '',
  message = ''
}) => {
  // Используем либо прямое сообщение, либо debugMessage
  const displayMessage = message || debugMessage;
  
  // Если не загружается и нет ошибки, не показываем экран
  if (!isLoading && !hasError) return null;
  
  return (
    <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-black bg-opacity-80">
      <div className="p-8 rounded-xl bg-gray-800 max-w-md text-center">
        {hasError ? (
          // Экран с ошибкой
          <>
            <div className="text-red-500 text-4xl mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-4">Ошибка</h2>
            <p className="text-gray-300">{displayMessage || 'Произошла ошибка при загрузке игры'}</p>
          </>
        ) : (
          // Экран загрузки
          <>
            <div className="mb-6">
              <div className="w-16 h-16 border-4 border-gray-600 border-t-amber-500 rounded-full animate-spin mx-auto"></div>
            </div>
            <h2 className="text-xl font-bold text-white mb-4">Загрузка...</h2>
            {displayMessage && <p className="text-gray-300">{displayMessage}</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen; 