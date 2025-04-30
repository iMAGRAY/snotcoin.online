"use client"

import React from "react";
import Image from "next/image";
import TouchButton from "./TouchButton";

export interface GameHeaderProps {
  inventory: {
    snot: number;
    snotCoins: number;
    containerCapacity?: number;
  };
  onPauseClick: () => void;
}

const GameHeader: React.FC<GameHeaderProps> = ({ inventory, onPauseClick }) => {
  return (
    <div 
      className="w-full h-[70px] relative flex items-center justify-between px-6"
      style={{
        backgroundImage: "url('/images/merge/Game/ui/Header.webp')",
        backgroundRepeat: "repeat-x",
        backgroundSize: "auto 100%",
        backgroundPosition: "center",
        position: "relative",
        zIndex: 1010
      }}
    >
      {/* Левая часть с кнопкой паузы */}
      <div className="flex items-center z-10">
        <TouchButton
          onClick={onPauseClick}
          className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98] mr-4"
        >
          <Image
            src="/images/merge/Game/ui/pause.webp"
            alt="Пауза"
            width={48}
            height={48}
            className="w-full h-full object-cover"
          />
        </TouchButton>
      </div>

      {/* Правая часть - ресурсы игрока */}
      <div className="flex items-center z-10">
        <div className="flex items-center mr-4">
          <Image
            src="/images/common/icons/snot-icon.webp"
            alt="Snot"
            width={30}
            height={30}
            className="w-7 h-7 mr-2"
          />
          <span className="text-white font-bold">{(inventory.snot || 0).toFixed(3)}</span>
        </div>
        
        <div className="flex items-center">
          <Image
            src="/images/common/icons/kingcoin.webp"
            alt="RoyaleWay"
            width={30}
            height={30}
            className="w-7 h-7 mr-2"
          />
          <span className="text-white font-bold">{(inventory.snotCoins || 0).toFixed(3)}</span>
        </div>
      </div>
    </div>
  );
};

export default GameHeader; 