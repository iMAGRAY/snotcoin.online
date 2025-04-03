'use client'

import React from 'react';

interface LoadingScreenProps {
  isLoading: boolean;
  hasError: boolean;
  debugMessage: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isLoading, hasError, debugMessage }) => {
  if (!isLoading && !hasError) {
    return null;
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 text-white z-10">
      {isLoading && !hasError && (
        <>
          <div className="mb-4">Загрузка игры...</div>
          <div className="text-xs text-gray-400">{debugMessage}</div>
        </>
      )}
      
      {hasError && (
        <>
          <div className="mb-4 text-red-500">Ошибка при загрузке игры</div>
          <div className="text-xs text-gray-400">{debugMessage}</div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
          >
            Перезагрузить
          </button>
        </>
      )}
    </div>
  );
};

export default LoadingScreen; 