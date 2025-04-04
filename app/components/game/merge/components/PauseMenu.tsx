'use client'

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface PauseMenuProps {
  resumeGame: () => void;
  onClose: () => void;
}

const PauseMenu: React.FC<PauseMenuProps> = ({ resumeGame, onClose }) => {
  return (
    <div className="absolute inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center">
      <div className="relative z-10 p-6 bg-gray-800 rounded-xl shadow-xl border border-gray-700 max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Пауза</h2>
        
        <div className="flex flex-col gap-4 mt-6">
          <button 
            onClick={resumeGame}
            className="w-full py-3 px-4 text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            Продолжить
          </button>
          
          <button 
            onClick={onClose}
            className="w-full py-3 px-4 text-lg font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition"
          >
            Выйти из игры
          </button>
        </div>
      </div>
    </div>
  );
};

export default PauseMenu; 