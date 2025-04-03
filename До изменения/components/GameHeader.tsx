'use client'

import React from 'react';
import Image from 'next/image';
import { BALL_COLORS, HEADER_HEIGHT, HEADER_HEIGHT_MOBILE } from '../constants/gameConstants';

interface GameHeaderProps {
  togglePause: () => void;
  futureNextBallLevel: number;
  snotCoinValue: number;
  snotValue: number;
}

const GameHeader: React.FC<GameHeaderProps> = ({ 
  togglePause, 
  futureNextBallLevel, 
  snotCoinValue, 
  snotValue 
}) => {
  // Определяем цвет для следующего шара с гарантированным значением по умолчанию
  const ballColorIndex = Math.max(0, Math.min((futureNextBallLevel - 1), BALL_COLORS.length - 1));
  const nextBallColor = BALL_COLORS[ballColorIndex] || 0xf94144; // Красный цвет по умолчанию
  
  // Преобразуем цвет в строку для CSS
  const colorHex = `#${nextBallColor.toString(16).padStart(6, '0')}`;
  
  // Форматируем snotCoinValue с 4 цифрами после точки
  const formattedSnotCoin = typeof snotCoinValue === 'number' 
    ? snotCoinValue.toFixed(4) 
    : '0.0000';
  
  return (
    <div className="relative w-full">
      {/* Фоновое изображение хедера */}
      <div 
        className="w-full h-[64px] sm:h-[80px] relative"
        style={{
          backgroundImage: 'url("/images/merge/Game/ui/Header.webp")',
          backgroundSize: 'auto 100%',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'center'
        }}
      >
      </div>

      {/* Контент поверх изображения */}
      <div className="absolute top-0 left-0 right-0 h-full flex justify-between items-center px-4 sm:px-6">
        {/* Кнопка паузы */}
        <button 
          onClick={togglePause}
          className="text-white font-bold flex items-center"
          aria-label="Pause game"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" className="mr-2">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
          <span className="hidden sm:inline">Пауза</span>
        </button>
        
        {/* Отображение ресурсов и следующего шара по центру */}
        <div className="flex items-center space-x-4">
          {/* SnotCoin */}
          <div className="flex items-center bg-gray-800 px-2 py-1 rounded-lg">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-yellow-400 mr-2"></div>
            <span className="text-white text-xs sm:text-sm font-bold">{formattedSnotCoin}</span>
          </div>
          
          {/* Snot */}
          <div className="flex items-center bg-gray-800 px-2 py-1 rounded-lg">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500 mr-2"></div>
            <span className="text-white text-xs sm:text-sm font-bold">{snotValue}</span>
          </div>
        </div>
        
        {/* Отображение следующего шара для броска */}
        <div className="flex items-center">
          <span className="text-white mr-2 text-xs sm:text-sm">Следующий:</span>
          <div 
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center" 
            style={{ 
              backgroundColor: colorHex,
              boxShadow: '0 0 8px rgba(255, 255, 255, 0.5)'
            }}
          >
            <span className="text-white font-bold text-xs sm:text-sm">{futureNextBallLevel}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameHeader; 