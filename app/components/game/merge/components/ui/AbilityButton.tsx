"use client"

import React from "react";
import Image from "next/image";
import TouchButton from "./TouchButton";

export interface AbilityButtonProps {
  type: 'Bull' | 'Bomb' | 'Earthquake';
  cost: number;
  isSelected: boolean;
  isDisabled: boolean;
  onAbilityClick: (type: string) => void;
}

const AbilityButton: React.FC<AbilityButtonProps> = ({
  type,
  cost,
  isSelected,
  isDisabled,
  onAbilityClick
}) => {
  // Определяем стили в зависимости от типа способности
  const getButtonStyles = () => {
    const styles = {
      Bull: {
        baseColor: 'from-yellow-400 via-yellow-500 to-amber-700',
        innerColor: 'from-yellow-300 via-amber-400 to-amber-600',
        ringDefault: 'ring-yellow-600',
        ringHover: 'ring-yellow-400',
        ringSelected: 'ring-yellow-400',
        iconGradient: 'from-yellow-500 to-amber-600',
        iconBorder: 'border-yellow-300',
        shadow: 'shadow-[0_0_18px_rgba(255,204,0,0.8)]',
        hoverShadow: 'shadow-[0_0_15px_rgba(255,204,0,0.5)]'
      },
      Bomb: {
        baseColor: 'from-red-400 via-red-500 to-rose-700',
        innerColor: 'from-red-300 via-red-500 to-rose-600',
        ringDefault: 'ring-red-700',
        ringHover: 'ring-red-400',
        ringSelected: 'ring-red-400',
        iconGradient: 'from-red-500 to-rose-600',
        iconBorder: 'border-red-300',
        shadow: 'shadow-[0_0_18px_rgba(255,0,0,0.8)]',
        hoverShadow: 'shadow-[0_0_15px_rgba(255,0,0,0.5)]'
      },
      Earthquake: {
        baseColor: 'from-purple-400 via-purple-500 to-violet-700',
        innerColor: 'from-purple-300 via-purple-500 to-violet-600',
        ringDefault: 'ring-purple-700',
        ringHover: 'ring-purple-400',
        ringSelected: 'ring-purple-400',
        iconGradient: 'from-purple-500 to-violet-600',
        iconBorder: 'border-purple-300',
        shadow: 'shadow-[0_0_18px_rgba(147,51,234,0.8)]',
        hoverShadow: 'shadow-[0_0_15px_rgba(147,51,234,0.5)]'
      }
    };
    
    return styles[type];
  };
  
  const style = getButtonStyles();
  
  const buttonClassName = `w-14 h-14 rounded-full overflow-hidden flex items-center justify-center
    ${isSelected 
      ? `ring-4 ${style.ringSelected} ${style.shadow} scale-110` 
      : !isDisabled
        ? `ring-2 ${style.ringDefault} hover:${style.ringHover} shadow-lg hover:${style.hoverShadow} hover:scale-105`
        : 'ring-2 ring-gray-700 opacity-60 cursor-not-allowed'} 
    transition-all duration-200 active:scale-[0.98] bg-gradient-to-br ${style.baseColor}`;
  
  return (
    <div className="relative flex flex-col items-center">
      <div className="relative">
        <TouchButton
          onClick={() => onAbilityClick(type)}
          className={buttonClassName}
          title={`Стоимость: ${cost.toFixed(1)} SnotCoin`}
          disabled={isDisabled}
        >
          <div className={`w-[92%] h-[92%] rounded-full overflow-hidden p-1 bg-gradient-to-br ${style.innerColor} flex items-center justify-center`}>
            <Image
              src={`/images/merge/abilities/${type.toLowerCase()}.webp`}
              alt={type}
              width={42}
              height={42}
              className="w-full h-full object-cover rounded-full"
              priority
            />
          </div>
        </TouchButton>
        {/* Индикатор стоимости - независимый элемент */}
        <div className={`absolute -top-3 -left-3 bg-gradient-to-br ${style.iconGradient} text-white text-sm font-bold rounded-full h-8 w-8 flex items-center justify-center shadow-lg border-2 ${style.iconBorder} z-20`}>
          {cost.toFixed(1)}
        </div>
      </div>
    </div>
  );
};

export default AbilityButton; 