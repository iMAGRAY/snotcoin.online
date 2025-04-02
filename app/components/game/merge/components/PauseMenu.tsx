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
    <div 
      className="fixed inset-0 flex items-center justify-center z-[10000]" 
      style={{ 
        backgroundImage: 'url(/images/merge/Game/BackGround.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundBlendMode: 'overlay',
        backgroundColor: 'rgba(0, 0, 0, 0.8)'
      }}
    >
      <motion.div 
        className="relative z-10 p-6 bg-gray-800 rounded-xl shadow-xl border border-gray-700 max-w-md w-full text-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
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
          Хотите вернуться к игре или выйти в основное меню?
        </p>
        
        <div className="space-y-4">
          <motion.button
            onClick={resumeGame}
            className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:from-yellow-500 hover:to-yellow-700 transition-all duration-300 w-full"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Продолжить
          </motion.button>
          
          <motion.button
            onClick={onClose}
            className="bg-gradient-to-r from-red-500 to-red-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:from-red-600 hover:to-red-800 transition-all duration-300 w-full"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Выйти из игры
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default PauseMenu; 