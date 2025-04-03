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
    [key: string]: number;
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
  // Рассчитываем стоимость для каждой способности
  const bullCost = (specialCosts.Bull / 100) * containerCapacity;
  const bombCost = (specialCosts.Bomb / 100) * containerCapacity;
  const joyCost = (specialCosts.Joy / 100) * containerCapacity;
  
  // Проверяем, достаточно ли ресурсов для каждой способности
  const canUseBull = snotCoins >= bullCost && !bullUsed;
  const canUseBomb = snotCoins >= bombCost;
  const canUseJoy = snotCoins >= joyCost;
  
  return (
    <div className="absolute bottom-0 left-0 right-0 flex justify-center items-center space-x-4 p-2 bg-black/30 backdrop-blur-sm">
      {/* Кнопка Bull */}
      <button
        onClick={onBullClick}
        disabled={!canUseBull || bullUsed}
        className={`relative flex flex-col items-center justify-center px-4 py-2 rounded-lg 
          ${canUseBull ? 'bg-red-700 hover:bg-red-600' : 'bg-red-900 opacity-50'} 
          transition-all duration-300`}
      >
        <div className="text-xs text-white font-bold">Bull</div>
        <div className="text-[10px] text-yellow-300">{formatSnotValue(bullCost, 1)} SC</div>
        {bullUsed && <div className="absolute inset-0 bg-gray-800/70 flex items-center justify-center rounded-lg">
          <div className="text-xs text-white font-bold">Перезарядка</div>
        </div>}
      </button>
      
      {/* Кнопка Bomb */}
      <button
        onClick={onBombClick}
        disabled={!canUseBomb}
        className={`relative flex flex-col items-center justify-center px-4 py-2 rounded-lg 
          ${canUseBomb ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-900 opacity-50'} 
          transition-all duration-300`}
      >
        <div className="text-xs text-white font-bold">Bomb</div>
        <div className="text-[10px] text-yellow-300">{formatSnotValue(bombCost, 1)} SC</div>
      </button>
      
      {/* Кнопка Joy */}
      <button
        onClick={onJoyClick}
        disabled={!canUseJoy}
        className={`relative flex flex-col items-center justify-center px-4 py-2 rounded-lg 
          ${canUseJoy ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-900 opacity-50'} 
          transition-all duration-300`}
      >
        <div className="text-xs text-white font-bold">Joy</div>
        <div className="text-[10px] text-yellow-300">{formatSnotValue(joyCost, 1)} SC</div>
      </button>
    </div>
  );
};

export default FooterButtons; 