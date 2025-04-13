"use client"

import React from 'react';
import AbilityButton from './AbilityButton';

interface GameFooterProps {
  containerCapacity: number;
  snotCoins: number;
  selectedAbility: string | null;
  onAbilityClick: (ability: string) => void;
}

export const GameFooter: React.FC<GameFooterProps> = ({
  containerCapacity,
  snotCoins,
  selectedAbility,
  onAbilityClick
}) => {
  // Определяем стоимость способностей
  const bullCost = containerCapacity * 0.3;
  const bombCost = containerCapacity * 0.1;
  const earthquakeCost = containerCapacity * 0.2;

  return (
    <div 
      className="w-full h-[70px] relative flex items-center justify-center"
      style={{
        backgroundImage: "url('/images/merge/Game/ui/Footer.webp')",
        backgroundRepeat: "repeat-x",
        backgroundSize: "auto 100%",
        backgroundPosition: "center"
      }}
    >
      <div className="relative w-full px-6">
        {/* Кнопки способностей подняты выше за счет отрицательного margin-top */}
        <div className="flex justify-around items-center w-full -mt-6">
          {/* Кнопка способности Bull */}
          <AbilityButton
            name="Bull"
            cost={bullCost}
            isSelected={selectedAbility === 'Bull'}
            isDisabled={snotCoins < bullCost}
            onClick={() => onAbilityClick('Bull')}
            imagePath="/images/merge/abilities/bull.webp"
            colorFrom="yellow-400"
            colorTo="amber-700"
            colorRing="yellow-600"
            colorRingHover="yellow-400"
            colorShadow="rgba(255,204,0,0.8)"
          />
          
          {/* Кнопка способности Bomb */}
          <AbilityButton
            name="Bomb"
            cost={bombCost}
            isSelected={selectedAbility === 'Bomb'}
            isDisabled={snotCoins < bombCost}
            onClick={() => onAbilityClick('Bomb')}
            imagePath="/images/merge/abilities/bomb.webp"
            colorFrom="red-400"
            colorTo="rose-700"
            colorRing="red-700"
            colorRingHover="red-400"
            colorShadow="rgba(255,0,0,0.5)"
          />
          
          {/* Кнопка способности Earthquake */}
          <AbilityButton
            name="Earthquake"
            cost={earthquakeCost}
            isSelected={selectedAbility === 'Earthquake'}
            isDisabled={snotCoins < earthquakeCost}
            onClick={() => onAbilityClick('Earthquake')}
            imagePath="/images/merge/abilities/eatherquake.webp"
            colorFrom="purple-400"
            colorTo="violet-700"
            colorRing="purple-700"
            colorRingHover="purple-400"
            colorShadow="rgba(147,51,234,0.5)"
          />
        </div>
      </div>
    </div>
  );
};

export default GameFooter; 