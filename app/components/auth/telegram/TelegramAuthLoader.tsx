/**
 * Компонент для отображения загрузки при аутентификации через Telegram
 */
import React from 'react';

/**
 * Компонент с индикатором загрузки при аутентификации
 */
const TelegramAuthLoader: React.FC = () => {
  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4"></div>
      <p className="text-lg font-medium text-gray-700">Подключаемся к Telegram...</p>
    </div>
  );
};

export default TelegramAuthLoader; 