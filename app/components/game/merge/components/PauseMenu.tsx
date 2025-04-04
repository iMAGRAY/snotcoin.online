'use client'

import React from 'react';
import { motion } from 'framer-motion';

interface PauseMenuProps {
  resumeGame: () => void;
  onClose: () => void;
}

const PauseMenu: React.FC<PauseMenuProps> = ({ resumeGame, onClose }) => {
  return (
    <div className="absolute inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center">
      <motion.div 
        className="relative z-10 p-6 bg-gray-800 rounded-xl shadow-xl border border-gray-700 max-w-md w-full text-center"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <h2 className="text-xl font-bold text-white mb-4">Пауза</h2>
        
        <div className="flex justify-center mb-6">
          <img 
            src="/images/merge/merge.webp" 
            alt="Merge" 
            className="w-32 h-32 object-contain" 
          />
        </div>
        
        <p className="text-gray-300 mb-8">
          Хотите продолжить игру или выйти в главное меню?
        </p>
        
        <div className="flex flex-col gap-4 mt-6">
          <button 
            onClick={resumeGame}
            className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:from-yellow-500 hover:to-yellow-700 transition-all duration-300 transform hover:scale-105 active:scale-95 w-full"
          >
            Продолжить
          </button>
          
          <button 
            onClick={onClose}
            className="bg-gradient-to-r from-red-500 to-red-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:from-red-600 hover:to-red-800 transition-all duration-300 transform hover:scale-105 active:scale-95 w-full"
          >
            Выйти из игры
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default PauseMenu; 