"use client"

import React from 'react';
import Image from 'next/image';
import { TouchButtonProps } from "../../utils/types";

interface AbilityButtonProps {
  name: string;
  cost: number;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
  imagePath: string;
  colorFrom: string;
  colorTo: string;
  colorRing: string;
  colorRingHover: string;
  colorShadow: string;
}

// Упрощенная версия TouchButton для использования внутри AbilityButton
const TouchButton: React.FC<TouchButtonProps> = ({ 
  onClick, 
  className = "", 
  disabled = false, 
  title = "",
  children 
}) => {
  // Базовая реализация
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      title={title}
    >
      {children}
    </button>
  );
};

export const AbilityButton: React.FC<AbilityButtonProps> = ({
  name,
  cost,
  isSelected,
  isDisabled,
  onClick,
  imagePath,
  colorFrom,
  colorTo,
  colorRing,
  colorRingHover,
  colorShadow
}) => {
  return (
    <div className="relative flex flex-col items-center">
      <div className="relative">
        <TouchButton
          onClick={onClick}
          className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center
            ${isSelected 
              ? `ring-4 ring-${colorRingHover} shadow-[0_0_18px_${colorShadow}] scale-110` 
              : !isDisabled
                ? `ring-2 ring-${colorRing} hover:ring-${colorRingHover} shadow-lg hover:shadow-[0_0_15px_${colorShadow}] hover:scale-105`
                : 'ring-2 ring-gray-700 opacity-60 cursor-not-allowed'} 
            transition-all duration-200 active:scale-[0.98] bg-gradient-to-br from-${colorFrom} via-${colorFrom} to-${colorTo}`}
          title={`Стоимость: ${cost.toFixed(1)} SnotCoin`}
          disabled={isDisabled}
        >
          <div className={`w-[92%] h-[92%] rounded-full overflow-hidden p-1 bg-gradient-to-br from-${colorFrom} via-${colorFrom} to-${colorTo} flex items-center justify-center`}>
            <Image
              src={imagePath}
              alt={name}
              width={42}
              height={42}
              className="w-full h-full object-cover rounded-full"
              priority
            />
          </div>
        </TouchButton>
        {/* Индикатор стоимости - независимый элемент */}
        <div className={`absolute -top-3 -left-3 bg-gradient-to-br from-${colorFrom} to-${colorTo} text-white text-sm font-bold rounded-full h-8 w-8 flex items-center justify-center shadow-lg border-2 border-${colorFrom} z-20`}>
          {cost.toFixed(1)}
        </div>
      </div>
    </div>
  );
};

export default AbilityButton; 