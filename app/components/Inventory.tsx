import React from 'react';
import { useGameState } from '../contexts/GameContext';

const Inventory: React.FC = () => {
  const { inventory } = useGameState();

  return (
    <div className="hidden">
      {/* This component doesn't render anything visible */}
      {/* It's just a placeholder for inventory logic */}
    </div>
  );
};

export default Inventory;

