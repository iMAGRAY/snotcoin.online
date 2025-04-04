'use client'

import React from 'react';
import { formatSnotValue } from '../../../../utils/formatters';

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
  return (
    <div className="relative bg-transparent w-full py-3 px-4 flex items-center justify-between z-20"
         style={{
           backgroundImage: 'url("/images/merge/Game/ui/Header.webp")',
           backgroundSize: 'auto 100%',
           backgroundRepeat: 'repeat-x',
           backgroundPosition: 'center',
           boxShadow: 'inset 0 -3px 10px rgba(0,0,0,0.2)',
           imageRendering: 'crisp-edges'
         }}>
      {/* Кнопка паузы (слева) */}
      <button 
        onClick={togglePause}
        className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-700 bg-gray-800 hover:bg-gray-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
        </svg>
      </button>
      
      {/* Информация о валюте (справа) */}
      <div className="flex items-center space-x-4">
        {/* SnotCoin */}
        <div className="flex items-center">
          <img src="/images/currency/snotcoin-icon.webp" alt="SnotCoin" className="w-5 h-5 mr-1" />
          <span className="text-white text-sm font-medium">{formatSnotValue(snotCoinValue)}</span>
        </div>
        
        {/* Snot */}
        <div className="flex items-center">
          <img src="/images/currency/snot-icon.webp" alt="Snot" className="w-5 h-5 mr-1" />
          <span className="text-green-400 text-sm font-medium">{formatSnotValue(snotValue)}</span>
        </div>
      </div>
    </div>
  );
};

export default GameHeader; 