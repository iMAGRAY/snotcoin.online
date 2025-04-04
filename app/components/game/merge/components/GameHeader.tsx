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
    <div className="relative bg-transparent w-full py-2 px-3 flex items-center justify-between z-20"
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
        className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-700 bg-gray-800 hover:bg-gray-700 p-1.5"
      >
        <img 
          src="/images/merge/Game/ui/pause.webp" 
          alt="Пауза" 
          className="w-full h-full object-cover"
        />
      </button>
      
      {/* Информация о валюте */}
      <div className="flex items-center space-x-3">
        {/* SnotCoin с деревянным фоном */}
        <div className="flex items-center px-2 py-1 rounded-full" 
             style={{
               backgroundColor: '#8B4513',
               border: '2px solid #5D3A1F',
               boxShadow: 'inset 0 0 5px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)',
               backgroundImage: 'linear-gradient(to bottom, #9e5f2f, #8B4513, #723a10)'
             }}>
          <img src="/images/common/icons/snotcoin.webp" alt="SnotCoin" className="w-5 h-5 mr-1 drop-shadow-md" />
          <span className="text-white text-xs font-medium drop-shadow-md">{snotCoinValue.toFixed(2)}</span>
        </div>
        
        {/* Snot с деревянным фоном */}
        <div className="flex items-center px-2 py-1 rounded-full"
             style={{
               backgroundColor: '#8B4513',
               border: '2px solid #5D3A1F',
               boxShadow: 'inset 0 0 5px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)',
               backgroundImage: 'linear-gradient(to bottom, #9e5f2f, #8B4513, #723a10)'
             }}>
          <img src="/images/common/icons/snot.webp" alt="Snot" className="w-5 h-5 mr-1 drop-shadow-md" />
          <span className="text-green-400 text-xs font-medium drop-shadow-md">{snotValue.toFixed(2)}</span>
        </div>
      </div>
      
      {/* Следующая монета (в самом правом краю) */}
      <div className="flex items-center">
        <div 
          className="w-11 h-11 flex items-center justify-center rounded-full bg-gray-800 border-2 border-amber-500 shadow-md"
          style={{
            backgroundImage: 'radial-gradient(circle, #3a3a3a, #1f1f1f)',
            boxShadow: 'inset 0 0 5px rgba(0,0,0,0.7), 0 0 5px rgba(255,215,0,0.3)'
          }}
        >
          <img 
            src={`/images/merge/Balls/${futureNextBallLevel}.webp`} 
            alt={`Монета уровня ${futureNextBallLevel}`} 
            className="w-8 h-8 object-contain"
          />
        </div>
      </div>
    </div>
  );
};

export default GameHeader; 