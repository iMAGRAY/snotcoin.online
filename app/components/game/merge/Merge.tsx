"use client"

import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "../../../i18n"
import { useGameState, useGameDispatch } from "../../../contexts/game/hooks"
import dynamic from "next/dynamic"

// Динамически импортируем игру, чтобы избежать проблем с рендерингом на сервере
const MergeGame = dynamic(() => import("./MergeGame"), {
  ssr: false,
})

// Объявляем тип для window.__PHASER_GAMES__
declare global {
  interface Window {
    __PHASER_GAMES__?: Record<string, any>;
  }
}

const Merge: React.FC = () => {
  const { t } = useTranslation()
  const gameState = useGameState()
  const dispatch = useGameDispatch()
  const [isGameActive, setIsGameActive] = useState(false)

  // Функция для очистки существующих игр Phaser
  const cleanupExistingGames = () => {
    if (typeof window !== 'undefined' && window.__PHASER_GAMES__) {
      // Уничтожаем все существующие экземпляры Phaser
      console.log('Очистка существующих игр перед запуском новой');
      for (const existingGameId in window.__PHASER_GAMES__) {
        try {
          const existingGame = window.__PHASER_GAMES__[existingGameId];
          if (existingGame && existingGame.destroy) {
            console.log('Уничтожаем существующий экземпляр Phaser:', existingGameId);
            existingGame.destroy(true);
            delete window.__PHASER_GAMES__[existingGameId];
          }
        } catch (e) {
          console.error('Ошибка при уничтожении существующей игры:', e);
        }
      }
    }
  };

  const handlePlayClick = () => {
    // Очищаем существующие игры перед запуском новой
    cleanupExistingGames();
    setIsGameActive(true);
  }

  const handleCloseGame = () => {
    setIsGameActive(false);
    // Очищаем существующие игры после закрытия
    cleanupExistingGames();
    // Явно устанавливаем активную вкладку "merge" при выходе из игры
    dispatch({
      type: "SET_ACTIVE_TAB",
      payload: "merge"
    });
  }

  // Очищаем игры при монтировании и размонтировании компонента
  useEffect(() => {
    // Очищаем при монтировании
    cleanupExistingGames();
    
    // Очищаем при размонтировании
    return () => {
      cleanupExistingGames();
    };
  }, []);

  return (
    <motion.div
      className="relative w-full h-full flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-gray-800" />
      
      <div className="relative z-10 p-6 bg-gray-800 rounded-xl shadow-xl border border-gray-700 max-w-md w-full text-center">
        <h2 className="text-xl font-bold text-white mb-4">{t("merge")}</h2>
        
        <div className="flex justify-center mb-6">
          <img 
            src="/images/merge/merge.webp" 
            alt="Merge" 
            className="w-32 h-32 object-contain" 
          />
        </div>
        
        <p className="text-gray-300 mb-8">
          Игра Merge: объединяйте шары одинакового уровня, чтобы создавать шары более высокого уровня!
        </p>
        
        <button
          onClick={handlePlayClick}
          className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:from-yellow-500 hover:to-yellow-700 transition-all duration-300 transform hover:scale-105 active:scale-95"
        >
          Играть
        </button>
      </div>
      
      {isGameActive && <MergeGame onClose={handleCloseGame} />}
    </motion.div>
  )
}

export default React.memo(Merge) 