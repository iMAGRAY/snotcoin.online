"use client"

import React, { useState, useEffect } from "react"
import { useTranslation } from "../../../i18n"
import { useGameState, useGameDispatch } from "../../../contexts"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import Image from "next/image"
import { ICONS } from "../../../constants/uiConstants"
import { useForceSave } from "../../../hooks/useForceSave"

// Константы для хранения попыток
const MAX_MERGE_ATTEMPTS = 3;
const MERGE_ATTEMPT_RECOVERY_TIME = 8 * 60 * 60 * 1000; // 8 часов в миллисекундах
const LOCAL_STORAGE_KEY = 'mergeGameAttempts';

// Динамически импортируем компонент MergeGameLauncher, чтобы работать с Planck на стороне клиента
const MergeGameLauncher = dynamic(() => import("./MergeGameLauncher"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center text-white text-2xl">
      Загрузка игры...
    </div>
  ),
})

// Интерфейс для данных о попытках
interface MergeGameAttemptsData {
  attemptsLeft: number;
  lastAttemptTime: number; // время последней использованной попытки
  nextRecoveryTime: number; // время восстановления следующей попытки
}

const Merge: React.FC = () => {
  const { t } = useTranslation()
  const { hideInterface } = useGameState()
  const dispatch = useGameDispatch()
  const [isGameLaunched, setIsGameLaunched] = useState(false)
  const [isOnline, setIsOnline] = useState(false)
  
  // Хук для принудительного сохранения
  const forceSave = useForceSave();
  
  // Состояния для системы попыток
  const [attemptsData, setAttemptsData] = useState<MergeGameAttemptsData>({
    attemptsLeft: MAX_MERGE_ATTEMPTS,
    lastAttemptTime: 0,
    nextRecoveryTime: 0
  });
  const [remainingTime, setRemainingTime] = useState<string>("");
  
  // Главный хук для системы попыток
  useEffect(() => {
    const savedAttemptsDataString = localStorage.getItem(LOCAL_STORAGE_KEY);
    
    if (savedAttemptsDataString) {
      try {
        const savedAttemptsData: MergeGameAttemptsData = JSON.parse(savedAttemptsDataString);
        setAttemptsData(savedAttemptsData);
      } catch (error) {
        console.error("Ошибка при загрузке данных о попытках:", error);
        resetAttemptsData();
      }
    } else {
      resetAttemptsData();
    }
  }, []);

  // Функция для восстановления попытки
  const handleAttemptRecovery = () => {
    const now = Date.now();
    const newAttemptsLeft = Math.min(attemptsData.attemptsLeft + 1, MAX_MERGE_ATTEMPTS);
    const newNextRecoveryTime = newAttemptsLeft < MAX_MERGE_ATTEMPTS ? now + MERGE_ATTEMPT_RECOVERY_TIME : 0;
    
    const updatedData: MergeGameAttemptsData = {
      attemptsLeft: newAttemptsLeft,
      lastAttemptTime: now,
      nextRecoveryTime: newNextRecoveryTime
    };
    
    setAttemptsData(updatedData);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedData));
  };

  // Функция для сброса данных о попытках
  const resetAttemptsData = () => {
    const initialData: MergeGameAttemptsData = {
      attemptsLeft: MAX_MERGE_ATTEMPTS,
      lastAttemptTime: Date.now(),
      nextRecoveryTime: 0
    };
    setAttemptsData(initialData);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialData));
  };

  // Обновление таймера для восстановления попыток
  useEffect(() => {
    const updateRemainingTime = () => {
      if (attemptsData.attemptsLeft < MAX_MERGE_ATTEMPTS && attemptsData.nextRecoveryTime > 0) {
        const timeRemaining = Math.max(0, attemptsData.nextRecoveryTime - Date.now());
        
        if (timeRemaining <= 0) {
          // Если время восстановления истекло, добавляем попытку
          handleAttemptRecovery();
        } else {
          // Форматируем оставшееся время
          const minutes = Math.floor(timeRemaining / 60000);
          const seconds = Math.floor((timeRemaining % 60000) / 1000);
          setRemainingTime(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
        }
      } else {
        setRemainingTime("");
      }
    };

    const intervalId = setInterval(updateRemainingTime, 1000);
    updateRemainingTime(); // Сразу обновляем после монтирования

    return () => clearInterval(intervalId);
  }, [attemptsData]);

  const handlePlayClick = () => {
    if (attemptsData.attemptsLeft <= 0) {
      return; // Если нет попыток, не запускаем игру
    }
    
    // Уменьшаем количество попыток
    const now = Date.now();
    const newAttemptsLeft = attemptsData.attemptsLeft - 1;
    
    const updatedData: MergeGameAttemptsData = {
      attemptsLeft: newAttemptsLeft,
      lastAttemptTime: now,
      nextRecoveryTime: now + MERGE_ATTEMPT_RECOVERY_TIME
    };
    
    setAttemptsData(updatedData);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedData));
    
    // Логируем что система сохранений отключена
    forceSave(300);
    console.log('[MergeGame] Система сохранений отключена');
    
    // Скрываем интерфейс при запуске игры
    dispatch(prevState => ({
      ...prevState,
      hideInterface: true
    }));
    setIsGameLaunched(true)
  }

  const handleBackToMenu = () => {
    dispatch(prevState => ({
      ...prevState,
      hideInterface: false
    }));
    setIsGameLaunched(false)
  }

  const handleToggleOnline = () => {
    setIsOnline(!isOnline)
  }

  if (isGameLaunched) {
    return <MergeGameLauncher 
      onBack={handleBackToMenu} 
      attemptsData={attemptsData}
      maxAttempts={MAX_MERGE_ATTEMPTS}
      remainingTime={remainingTime}
    />
  }

  return (
    <div 
      className="flex flex-col items-center justify-center w-full h-full min-h-[calc(100vh-5.5rem-60px)] p-4 relative"
      style={{
        backgroundImage: "url('/images/merge/background/merge-background.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >
      <div className="w-full max-w-md bg-black bg-opacity-60 rounded-xl p-6 text-center">
        <h1 className="text-3xl font-bold text-yellow-400 mb-4">Merge Game</h1>
        <p className="text-white mb-6">Объединяй шары и зарабатывай SnotCoin!</p>
        
        <div className="flex flex-col space-y-4">
          <motion.button
            onClick={handlePlayClick}
            className={`w-full px-6 py-4 rounded-xl font-bold text-xl text-black relative overflow-hidden
              ${attemptsData.attemptsLeft > 0 
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700' 
                : 'bg-gray-500 cursor-not-allowed'}`}
            whileHover={attemptsData.attemptsLeft > 0 ? { scale: 1.05 } : {}}
            whileTap={attemptsData.attemptsLeft > 0 ? { scale: 0.95 } : {}}
            disabled={attemptsData.attemptsLeft <= 0}
          >
            {attemptsData.attemptsLeft > 0 
              ? (
                <div className="flex flex-col">
                  <span>Играть <span className="text-sm font-normal bg-yellow-700 bg-opacity-50 px-2 py-1 rounded-xl ml-1">({attemptsData.attemptsLeft}/{MAX_MERGE_ATTEMPTS})</span></span>
                  {remainingTime && attemptsData.attemptsLeft < MAX_MERGE_ATTEMPTS && (
                    <span className="text-xs mt-1 font-normal">Следующая попытка через: {remainingTime}</span>
                  )}
                </div>
              ) 
              : (
                <div className="flex flex-col">
                  <span>Нет попыток</span>
                  {remainingTime && (
                    <span className="text-xs mt-1 font-normal">Следующая попытка через: {remainingTime}</span>
                  )}
                </div>
              )}
          </motion.button>
          
          {/* Кнопка восстановления попыток */}
          {attemptsData.attemptsLeft < MAX_MERGE_ATTEMPTS && (
            <motion.button
              onClick={() => handleAttemptRecovery()}
              className="w-full px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Восстановить попытку</span>
              </div>
            </motion.button>
          )}
          
          {/* Кнопка PVP (Coming Soon) */}
          <motion.button
            className="w-full px-6 py-4 rounded-xl font-bold text-xl text-black relative overflow-hidden bg-gray-500 cursor-not-allowed"
            disabled={true}
          >
            <div className="flex items-center justify-center">
              <span>PVP</span>
              <span className="text-sm font-normal bg-gray-700 bg-opacity-70 px-2 py-1 rounded-xl ml-2">Coming Soon</span>
            </div>
          </motion.button>
          
          {/* Основной контент кнопок */}
          
          {/* <div className="flex items-center justify-center">
            <span className="text-white mr-2">Онлайн режим:</span>
            <div 
              onClick={handleToggleOnline}
              className={`w-12 h-6 rounded-full flex items-center cursor-pointer transition-all duration-300 ${isOnline ? 'bg-green-500 justify-end' : 'bg-gray-500 justify-start'}`}
            >
              <div className="w-5 h-5 bg-white rounded-full shadow-md mx-0.5"></div>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  )
}

export default Merge 