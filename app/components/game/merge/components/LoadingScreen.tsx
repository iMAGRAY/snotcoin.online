'use client'

import React from 'react';

interface LoadingScreenProps {
  isLoading: boolean;
  hasError: boolean;
  debugMessage: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ isLoading, hasError, debugMessage }) => {
  if (!isLoading && !hasError) return null;
  
  return (
    <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-6 rounded-lg shadow-lg max-w-md w-full text-center">
        {isLoading && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <h2 className="text-xl font-bold text-white">Загрузка игры...</h2>
            {debugMessage && (
              <p className="text-gray-400 text-sm mt-2">{debugMessage}</p>
            )}
          </div>
        )}
        
        {hasError && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center">
              <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Ошибка загрузки</h2>
            {debugMessage && (
              <p className="text-red-400 text-sm mt-2">{debugMessage}</p>
            )}
            <button 
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              onClick={() => window.location.reload()}
            >
              Перезагрузить
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen; 