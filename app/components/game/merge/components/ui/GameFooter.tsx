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
            type="Bull"
            cost={bullCost}
            isSelected={selectedAbility === 'Bull'}
            isDisabled={snotCoins < bullCost}
            onAbilityClick={onAbilityClick}
          />
          
          {/* Кнопка способности Bomb */}
          <AbilityButton
            type="Bomb"
            cost={bombCost}
            isSelected={selectedAbility === 'Bomb'}
            isDisabled={snotCoins < bombCost}
            onAbilityClick={onAbilityClick}
          />
          
          {/* Кнопка способности Earthquake */}
          <AbilityButton
            type="Earthquake"
            cost={earthquakeCost}
            isSelected={selectedAbility === 'Earthquake'}
            isDisabled={snotCoins < earthquakeCost}
            onAbilityClick={onAbilityClick}
          />
        </div>
      </div>
    </div>
  );
};

export default GameFooter; 