"use client"

import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import TouchButton from "./TouchButton";
import { MergeGameAttemptsData } from "../../utils/types";

export interface GameOverDialogProps {
  finalScore: number;
  bestScore: number;
  attemptsData: MergeGameAttemptsData;
  maxAttempts: number;
  onRestartClick: () => void;
  onBackClick: () => void;
}

const GameOverDialog: React.FC<GameOverDialogProps> = ({
  finalScore,
  bestScore,
  attemptsData,
  maxAttempts,
  onRestartClick,
  onBackClick
}) => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 z-20">
      <motion.div 
        className="w-80 bg-gradient-to-b from-[#2a3b4d] to-[#1a2b3d] p-8 rounded-2xl border-2 border-[#4a7a9e] shadow-2xl"
        initial={{ scale: 0.8, y: 50, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.8, y: 50, opacity: 0 }}
        transition={{ type: 'spring', damping: 15 }}
      >
        <h2 className="text-red-500 text-4xl font-bold text-center mb-6">GAME OVER</h2>
        <div className="text-white text-center mb-6">
          <p className="text-xl mb-2">Итоговый счет</p>
          <p className="text-3xl font-bold">{finalScore}</p>
          {bestScore > 0 && (
            <p className="text-sm mt-2">Лучший счет: <span className="font-bold">{bestScore}</span></p>
          )}
          <div className="mt-4 p-3 bg-gradient-to-r from-[#1a1a2e] to-[#162447] rounded-2xl border border-red-500/20 shadow-lg">
            <div className="mb-2 flex items-center justify-center">
              <p className="text-sm font-medium text-gray-300">Осталось попыток:</p>
            </div>
            <div className="flex justify-center gap-2">
              {[...Array(maxAttempts)].map((_, index) => (
                <div 
                  key={index} 
                  className={`w-8 h-8 rounded-full flex items-center justify-center 
                    ${index < attemptsData.attemptsLeft 
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 shadow-[0_0_8px_rgba(250,204,21,0.7)]' 
                      : 'bg-gray-700 opacity-50'}`}
                >
                  {index < attemptsData.attemptsLeft ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col space-y-3">
          {attemptsData.attemptsLeft > 0 && (
            <TouchButton 
              onClick={onRestartClick}
              className="relative w-full px-6 py-3 bg-gradient-to-r from-blue-400 to-blue-600 rounded-2xl font-bold 
                text-white shadow-lg border-2 border-blue-300 focus:outline-none focus:ring-2 
                focus:ring-blue-300 focus:ring-opacity-50 h-14 hover:scale-105 hover:shadow-lg"
            >
              <div className="flex items-center justify-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-lg font-bold">Начать заново</span>
              </div>
            </TouchButton>
          )}
          <TouchButton 
            onClick={onBackClick}
            className="relative w-full px-6 py-4 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-2xl font-bold 
              text-black shadow-lg border-2 border-yellow-300 focus:outline-none focus:ring-2 
              focus:ring-yellow-300 focus:ring-opacity-50 h-16 hover:scale-105 hover:shadow-lg"
          >
            <div className="flex items-center justify-center space-x-2">
              <Image 
                src="/images/laboratory/buttons/claim-button.webp" 
                width={28} 
                height={28} 
                alt="Back" 
                className="h-7 w-7 mr-1" 
              />
              <span className="text-lg font-bold">Выйти в меню</span>
            </div>
          </TouchButton>
        </div>
      </motion.div>
    </div>
  );
};

export default GameOverDialog; 