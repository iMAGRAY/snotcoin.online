"use client"

import React from 'react';
import { motion } from 'framer-motion';

/**
 * Интерфейс пропсов модального окна для добавления в избранное
 */
interface AddToFavoritesModalProps {
  /** Функция вызываемая при подтверждении добавления в избранное */
  onConfirm: () => void;
  /** Функция вызываемая при отклонении добавления в избранное */
  onCancel: () => void;
}

/**
 * Модальное окно для предложения добавить приложение в избранное Farcaster
 */
const AddToFavoritesModal: React.FC<AddToFavoritesModalProps> = ({ onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70">
      <motion.div 
        className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full shadow-lg"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="p-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="w-10 h-10 text-white"
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor"
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
          </div>
          
          <h3 className="text-xl text-center font-bold text-white mb-2">
            Добавить RoyaleWay в избранное
          </h3>
          
          <p className="text-gray-300 text-center mb-6">
            Добавьте игру в избранное, чтобы быстро возвращаться к ней и получать уведомления о важных событиях.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-white"
            >
              Не сейчас
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-3 px-4 rounded-lg bg-green-600 hover:bg-green-500 transition-colors text-white font-medium"
            >
              Добавить
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AddToFavoritesModal; 