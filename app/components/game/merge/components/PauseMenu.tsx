'use client'

import React from 'react';
import { motion } from 'framer-motion';

interface PauseMenuProps {
  resumeGame?: () => void;
  onResume?: () => void;
  onClose?: () => void;
}

const PauseMenu: React.FC<PauseMenuProps> = ({ resumeGame, onResume, onClose }) => {
  // Используем либо новое свойство, либо старое
  const handleResume = onResume || resumeGame;
  const handleClose = onClose;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-80">
      <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border-2 border-gray-700 max-w-md w-full flex flex-col items-center">
        <h2 className="text-2xl font-bold text-white mb-8">Пауза</h2>
        
        <div className="space-y-4 w-full">
          <button 
            onClick={handleResume}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200"
          >
            Продолжить
          </button>
          
          <button 
            onClick={handleClose}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200"
          >
            Выйти из игры
          </button>
        </div>
      </div>
    </div>
  );
};

export default PauseMenu; 