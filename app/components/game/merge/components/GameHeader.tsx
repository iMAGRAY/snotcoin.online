'use client'

import React from 'react';
import { formatSnotValue } from '../../../../utils/formatters';
import Image from 'next/image';

interface GameHeaderProps {
  togglePause?: () => void;
  onTogglePause?: () => void;
  futureNextBallLevel?: number;
  snotCoinValue?: number;
  snotCoins?: number;
  snotValue?: number;
  snot?: number;
  containerCapacity?: number;
  onClose?: () => void;
}

const GameHeader: React.FC<GameHeaderProps> = ({ 
  togglePause, 
  onTogglePause,
  futureNextBallLevel, 
  snotCoinValue,
  snotCoins,
  snotValue,
  snot,
  containerCapacity,
  onClose
}) => {
  // Используем либо прямое значение, либо переданное в новом формате
  const displaySnotCoins = snotCoins !== undefined ? snotCoins : snotCoinValue;
  const displaySnot = snot !== undefined ? snot : snotValue;
  const handleTogglePause = onTogglePause || togglePause;
  
  return (
    <div 
      className="relative p-4 flex justify-between items-center"
      style={{
        borderBottom: '3px solid rgba(0,0,0,0.2)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
      }}
    >
      <Image
        src="/images/merge/game/ui/Header.webp"
        alt="Header Background"
        fill
        className="absolute inset-0 z-0 object-cover"
        priority
      />
      
      <h2 className="text-white font-bold text-xl relative z-20">Merge Game</h2>
      
      <div className="flex items-center space-x-4 relative z-20">
        {/* Отображение количества SnotCoin */}
        <div 
          className="flex items-center bg-gray-800 bg-opacity-30 rounded-full px-3 py-1"
          style={{
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)'
          }}>
          <Image 
            src="/images/common/icons/snotcoin.webp" 
            alt="SnotCoin" 
            width={20} 
            height={20}
            className="mr-1 drop-shadow-md" 
          />
          <span className="text-white text-xs font-medium drop-shadow-md">
            {displaySnotCoins !== undefined ? displaySnotCoins.toFixed(2) : ''}
          </span>
        </div>
        
        {/* Отображение количества Snot */}
        <div 
          className="flex items-center bg-gray-800 bg-opacity-30 rounded-full px-3 py-1"
          style={{
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.3)'
          }}>
          <Image 
            src="/images/common/icons/snot.webp" 
            alt="Snot" 
            width={20} 
            height={20}
            className="mr-1 drop-shadow-md" 
          />
          <span className="text-green-400 text-xs font-medium drop-shadow-md">
            {displaySnot !== undefined ? displaySnot.toFixed(2) : ''}
          </span>
        </div>
      </div>
      
      <div className="flex items-center space-x-2 relative z-20">
        {/* Кнопка паузы */}
        <button 
          className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full transition-all duration-200"
          onClick={handleTogglePause}
          style={{
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 0 10px rgba(0,0,0,0.3)'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        
        {/* Кнопка закрытия */}
        <button 
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition-all duration-200"
          onClick={onClose}
          style={{
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 0 10px rgba(0,0,0,0.3)'
          }}
        >
          Exit
        </button>
      </div>
    </div>
  );
};

export default GameHeader; 