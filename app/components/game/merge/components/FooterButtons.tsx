'use client'

import React from 'react';
import { formatSnotValue } from '../../../../utils/formatters';
import Image from 'next/image';

interface FooterButtonsProps {
  onBullClick?: () => void;
  onBombClick?: () => void;
  onJoyClick?: () => void;
  onBullBall?: () => void;
  onBombBall?: () => void;
  onJoyEffect?: () => void;
  specialCosts?: Record<string, number>;
  containerCapacity?: number;
  snotCoins?: number;
  bullUsed?: boolean;
  bombUsed?: boolean;
  canUseJoy?: boolean;
  canUseBull?: boolean;
  canUseBomb?: boolean;
  joyPercent?: number;
  bullPercent?: number;
  bombPercent?: number;
}

const FooterButtons: React.FC<FooterButtonsProps> = ({
  onBullClick,
  onBombClick,
  onJoyClick,
  onBullBall,
  onBombBall,
  onJoyEffect,
  specialCosts,
  containerCapacity,
  snotCoins,
  bullUsed,
  bombUsed,
  canUseJoy,
  canUseBull,
  canUseBomb,
  joyPercent,
  bullPercent,
  bombPercent
}) => {
  // Используем новый формат свойств, если он предоставлен, иначе используем старый
  const handleBullClick = onBullBall || onBullClick;
  const handleBombClick = onBombBall || onBombClick;
  const handleJoyClick = onJoyEffect || onJoyClick;
  
  // Определяем доступность кнопок в зависимости от формата переданных свойств
  const isBullAvailable = canUseBull !== undefined ? canUseBull : (
    snotCoins !== undefined && containerCapacity !== undefined && specialCosts?.Bull !== undefined
      ? snotCoins >= ((specialCosts.Bull / 100) * containerCapacity) && !bullUsed
      : true
  );
  
  const isBombAvailable = canUseBomb !== undefined ? canUseBomb : (
    snotCoins !== undefined && containerCapacity !== undefined && specialCosts?.Bomb !== undefined
      ? snotCoins >= ((specialCosts.Bomb / 100) * containerCapacity) && !bombUsed
      : true
  );
  
  const isJoyAvailable = canUseJoy !== undefined ? canUseJoy : (
    snotCoins !== undefined && containerCapacity !== undefined && specialCosts?.Joy !== undefined
      ? snotCoins >= ((specialCosts.Joy / 100) * containerCapacity)
      : true
  );
  
  // Данные о стоимости
  const bullCostPercent = bullPercent || specialCosts?.Bull || 0;
  const bombCostPercent = bombPercent || specialCosts?.Bomb || 0;
  const joyCostPercent = joyPercent || specialCosts?.Joy || 0;
  
  return (
    <div className="flex-shrink-0 w-full h-[64px] sm:h-[96px] relative z-10 border-t border-gray-600">
      <Image
        src="/images/merge/game/ui/Footer.webp"
        alt="Footer Background"
        fill
        className="absolute inset-0 z-0 object-cover"
        priority
      />
      
      <div className="w-full h-full flex items-center justify-between px-6 relative z-20">
        {/* Кнопка "Bull" */}
        <button
          className={`relative flex flex-col items-center justify-center ${
            isBullAvailable ? 'opacity-100' : 'opacity-60'
          } transition-all duration-200`}
          onClick={handleBullClick}
          disabled={!isBullAvailable}
        >
          <Image
            src="/images/merge/balls/bull.webp"
            alt="Bull"
            width={40}
            height={40}
            className="object-contain"
          />
          <span className="text-white text-xs font-medium mt-1">{bullCostPercent}%</span>
        </button>
        
        <div className="flex gap-4">
          {/* Кнопка "Bomb" */}
          <button
            className={`relative flex flex-col items-center justify-center ${
              isBombAvailable ? 'opacity-100' : 'opacity-60'
            } transition-all duration-200`}
            onClick={handleBombClick}
            disabled={!isBombAvailable}
          >
            <Image
              src="/images/merge/balls/bomb.webp"
              alt="Bomb"
              width={40}
              height={40}
              className="object-contain"
            />
            <span className="text-white text-xs font-medium mt-1">{bombCostPercent}%</span>
          </button>
          
          {/* Кнопка "Joy" */}
          <button
            className={`relative flex flex-col items-center justify-center ${
              isJoyAvailable ? 'opacity-100' : 'opacity-60'
            } transition-all duration-200`}
            onClick={handleJoyClick}
            disabled={!isJoyAvailable}
          >
            <Image
              src="/images/merge/game/ui/joy.webp"
              alt="Joy"
              width={40}
              height={40}
              className="object-contain"
            />
            <span className="text-white text-xs font-medium mt-1">{joyCostPercent}%</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FooterButtons; 