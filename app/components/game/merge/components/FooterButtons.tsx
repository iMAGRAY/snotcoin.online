'use client'

import React from 'react';
import { formatSnotValue } from '../../../../utils/formatters';

interface FooterButtonsProps {
  onBullClick: () => void;
  onBombClick: () => void;
  onJoyClick: () => void;
  specialCosts: {
    Bull: number;
    Bomb: number;
    Joy: number;
  };
  containerCapacity: number;
  snotCoins: number;
  bullUsed: boolean;
}

const FooterButtons: React.FC<FooterButtonsProps> = ({
  onBullClick,
  onBombClick,
  onJoyClick,
  specialCosts,
  containerCapacity,
  snotCoins,
  bullUsed
}) => {
  // Вычисляем абсолютную стоимость каждой способности
  const calculateCost = (type: string) => {
    const costPercent = specialCosts[type as keyof typeof specialCosts] || 0;
    return (costPercent / 100) * containerCapacity;
  };
  
  // Проверяем, достаточно ли ресурсов для использования
  const canUse = (type: string) => {
    const cost = calculateCost(type);
    return snotCoins >= cost;
  };
  
  // Проверяем, доступна ли способность Bull
  const isBullAvailable = !bullUsed && canUse('Bull');
  
  return (
    <div className="w-full h-full flex items-center justify-center gap-6 sm:gap-10">
      {/* Bull Button */}
      <button
        onClick={onBullClick}
        disabled={!isBullAvailable}
        className={`relative group flex flex-col items-center justify-center ${
          isBullAvailable ? 'opacity-100' : 'opacity-50'
        }`}
      >
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black bg-opacity-50 border-2 border-yellow-400 flex items-center justify-center overflow-hidden">
          <img src="/images/merge/Balls/Bull.webp" alt="Bull" className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>
        <span className="text-xs sm:text-sm text-yellow-400 mt-1">
          {formatSnotValue(calculateCost('Bull'))} SC
        </span>
        {bullUsed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-full bg-black bg-opacity-70 flex items-center justify-center">
              <span className="text-xs text-red-400">Недоступно</span>
            </div>
          </div>
        )}
      </button>
      
      {/* Bomb Button */}
      <button
        onClick={onBombClick}
        disabled={!canUse('Bomb')}
        className={`flex flex-col items-center justify-center ${
          canUse('Bomb') ? 'opacity-100' : 'opacity-50'
        }`}
      >
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black bg-opacity-50 border-2 border-red-500 flex items-center justify-center overflow-hidden">
          <img src="/images/merge/Balls/Bomb.webp" alt="Bomb" className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>
        <span className="text-xs sm:text-sm text-red-400 mt-1">
          {formatSnotValue(calculateCost('Bomb'))} SC
        </span>
      </button>
      
      {/* Joy Button */}
      <button
        onClick={onJoyClick}
        disabled={!canUse('Joy')}
        className={`flex flex-col items-center justify-center ${
          canUse('Joy') ? 'opacity-100' : 'opacity-50'
        }`}
      >
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black bg-opacity-50 border-2 border-blue-500 flex items-center justify-center overflow-hidden">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-blue-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
          </svg>
        </div>
        <span className="text-xs sm:text-sm text-blue-400 mt-1">
          {formatSnotValue(calculateCost('Joy'))} SC
        </span>
      </button>
    </div>
  );
};

export default FooterButtons; 