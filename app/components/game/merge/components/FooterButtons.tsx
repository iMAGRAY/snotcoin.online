'use client'

import React from 'react';
import { formatSnotValue } from '../../../../utils/formatters';
import Image from 'next/image';

interface FooterButtonsProps {
  onBullClick: () => void;
  onBombClick: () => void;
  onJoyClick: () => void;
  specialCosts: Record<string, number>;
  containerCapacity: number;
  snotCoins: number;
  bullUsed: boolean;
  bombUsed: boolean;
}

const FooterButtons: React.FC<FooterButtonsProps> = ({
  onBullClick,
  onBombClick,
  onJoyClick,
  specialCosts,
  containerCapacity,
  snotCoins,
  bullUsed,
  bombUsed
}) => {
  // Вычисляем абсолютную стоимость каждой способности
  const calculateCost = (type: string): number => {
    const costPercentage = specialCosts[type] || 0;
    return (costPercentage / 100) * containerCapacity;
  };
  
  // Проверяем достаточно ли ресурсов для использования способности
  const canUse = (type: string): boolean => {
    return snotCoins >= calculateCost(type);
  };
  
  // Определяем размер кнопок (увеличен)
  const buttonSize = 64;
  
  // Проверяем, доступна ли способность Bull
  const isBullAvailable = !bullUsed && canUse('Bull');
  
  // Функция для рендера кнопки Bull
  const renderBullButton = () => {
    const cost = calculateCost('Bull');
    const canUseBull = snotCoins >= cost && !bullUsed;
    
    return (
      <div 
        className={`special-button ${!canUseBull ? 'disabled' : ''}`}
        onClick={canUseBull ? onBullClick : undefined}
        style={{
          opacity: canUseBull ? 1 : 0.5,
          cursor: canUseBull ? 'pointer' : 'not-allowed',
          filter: bullUsed ? 'grayscale(100%)' : 'none'
        }}
      >
        <Image 
          src="/images/merge/Game/ui/Bull.webp"
          width={buttonSize}
          height={buttonSize}
          alt="Bull"
          className="drop-shadow-lg"
        />
        <div className="cost">
          {cost.toFixed(2)} SC
        </div>
        {bullUsed && (
          <div className="used-overlay">
            ИСПОЛЬЗОВАНО
          </div>
        )}
      </div>
    );
  };
  
  // Функция для рендера кнопки Bomb
  const renderBombButton = () => {
    const cost = calculateCost('Bomb');
    const canUseBomb = snotCoins >= cost && !bombUsed;
    
    return (
      <div 
        className={`special-button ${!canUseBomb ? 'disabled' : ''}`}
        onClick={canUseBomb ? onBombClick : undefined}
        style={{
          opacity: canUseBomb ? 1 : 0.5,
          cursor: canUseBomb ? 'pointer' : 'not-allowed',
          filter: bombUsed ? 'grayscale(100%)' : 'none'
        }}
      >
        <Image 
          src="/images/merge/Game/ui/Bomb.webp"
          width={buttonSize}
          height={buttonSize}
          alt="Bomb"
          className="drop-shadow-lg"
        />
        <div className="cost">
          {cost.toFixed(2)} SC
        </div>
        {bombUsed && (
          <div className="used-overlay">
            ИСПОЛЬЗОВАНО
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="w-full h-full flex items-center justify-between px-8 sm:px-12 pb-4 -mt-2">
      {/* Bull Button - Левая сторона */}
      <button
        onClick={onBullClick}
        disabled={!isBullAvailable}
        className={`relative group flex flex-col items-center justify-center ${
          isBullAvailable ? 'opacity-100' : 'opacity-50'
        }`}
        style={{
          filter: bullUsed ? 'grayscale(100%)' : 'none'
        }}
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center overflow-hidden">
          <img 
            src="/images/merge/Game/ui/Bull.webp" 
            alt="Bull" 
            className="w-14 h-14 sm:w-18 sm:h-18 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]" 
          />
        </div>
        <span className="text-xs sm:text-sm text-yellow-400 mt-1 font-semibold tracking-wider drop-shadow-md">
          {calculateCost('Bull').toFixed(2)} SC
        </span>
        {bullUsed && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-full bg-black bg-opacity-70 flex items-center justify-center">
              <span className="text-xs text-red-400">Недоступно</span>
            </div>
          </div>
        )}
      </button>
      
      {/* Центральный пустой блок */}
      <div className="invisible">
        {/* Пустой блок для сохранения структуры flex */}
      </div>
      
      {/* Правая группа кнопок */}
      <div className="flex gap-6 sm:gap-10">
        {/* Bomb Button */}
        <button
          onClick={onBombClick}
          disabled={!canUse('Bomb') || bombUsed}
          className={`flex flex-col items-center justify-center ${
            canUse('Bomb') && !bombUsed ? 'opacity-100' : 'opacity-50'
          }`}
          style={{
            filter: bombUsed ? 'grayscale(100%)' : 'none'
          }}
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center overflow-hidden">
            <img 
              src="/images/merge/Game/ui/Bomb.webp" 
              alt="Bomb" 
              className="w-14 h-14 sm:w-18 sm:h-18 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]" 
            />
          </div>
          <span className="text-xs sm:text-sm text-red-400 mt-1 font-semibold tracking-wider drop-shadow-md">
            {calculateCost('Bomb').toFixed(2)} SC
          </span>
          {bombUsed && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-full bg-black bg-opacity-70 flex items-center justify-center">
                <span className="text-xs text-red-400">Недоступно</span>
              </div>
            </div>
          )}
        </button>
        
        {/* Joy Button */}
        <button
          onClick={onJoyClick}
          disabled={!canUse('Joy')}
          className={`flex flex-col items-center justify-center ${
            canUse('Joy') ? 'opacity-100' : 'opacity-50'
          }`}
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center overflow-hidden">
            <img 
              src="/images/merge/Game/ui/joy.webp" 
              alt="Joy" 
              className="w-14 h-14 sm:w-18 sm:h-18 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]" 
            />
          </div>
          <span className="text-xs sm:text-sm text-blue-400 mt-1 font-semibold tracking-wider drop-shadow-md">
            {calculateCost('Joy').toFixed(2)} SC
          </span>
        </button>
      </div>
    </div>
  );
};

export default FooterButtons; 