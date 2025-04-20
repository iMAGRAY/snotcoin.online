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
  lastAttemptTime: number;
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
    lastAttemptTime: 0
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

  // Функция для сброса данных о попытках
  const resetAttemptsData = () => {
    const initialData: MergeGameAttemptsData = {
      attemptsLeft: MAX_MERGE_ATTEMPTS,
      lastAttemptTime: Date.now()
    };
    setAttemptsData(initialData);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialData));
  };

  // Обновление таймера для восстановления попыток
  useEffect(() => {
    const updateRemainingTime = () => {
      if (attemptsData.attemptsLeft < MAX_MERGE_ATTEMPTS) {
        const timeRemaining = Math.max(0, MERGE_ATTEMPT_RECOVERY_TIME - (Date.now() - attemptsData.lastAttemptTime));
        
        if (timeRemaining <= 0) {
          // Если время восстановления истекло, добавляем попытку
          // handleAttemptRecovery();
        } else {
          // Форматируем оставшееся время в формате '1h 58m', только минуты или только часы, если что-то из них 0
          const hours = Math.floor(timeRemaining / 3600000);
          const minutes = Math.floor((timeRemaining % 3600000) / 60000);
          let formatted = '';
          if (hours > 0) formatted += `${hours}h`;
          if (minutes > 0) formatted += (hours > 0 ? ' ' : '') + `${minutes}m`;
          setRemainingTime(formatted);
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
      lastAttemptTime: now
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
      <div className="w-full max-w-md rounded-xl p-6 text-center relative border-2 border-yellow-700 shadow-lg"
        style={{
          background: 'linear-gradient(to right, rgba(42, 33, 18, 0.9), rgba(58, 44, 10, 0.9), rgba(24, 21, 16, 0.9))',
          boxShadow: '0 2px 8px #000',
          position: 'relative'
        }}
      >
        <div className="pointer-events-none absolute z-20 -top-2 -left-2 w-10 h-10 bg-[url('/images/ui/corner-tl.webp')] bg-no-repeat bg-contain" />
        <div className="pointer-events-none absolute z-20 -top-2 -right-2 w-10 h-10 bg-[url('/images/ui/corner-tr.webp')] bg-no-repeat bg-contain" />
        <div className="pointer-events-none absolute z-20 -bottom-2 -left-2 w-10 h-10 bg-[url('/images/ui/corner-bl.webp')] bg-no-repeat bg-contain" />
        <div className="pointer-events-none absolute z-20 -bottom-2 -right-2 w-10 h-10 bg-[url('/images/ui/corner-br.webp')] bg-no-repeat bg-contain" />
        
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 mb-4" style={{fontFamily: 'Friz Quadrata, serif'}}>Merge Game</h1>
        <p className="text-yellow-200/80 mb-6">Merge balls and earn SnotCoin!</p>
        
        <div className="flex flex-col space-y-4">
          <motion.button
            onClick={handlePlayClick}
            className={`w-full px-6 py-4 rounded-xl font-bold text-xl relative overflow-hidden
              ${attemptsData.attemptsLeft > 0 
                ? 'bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-300 text-[#2a1c0a] shadow-[0_0_8px_2px_#FFD70099] border-2 border-yellow-600' 
                : 'bg-gradient-to-r from-gray-800/90 via-gray-900/95 to-gray-950/95 border-2 border-gray-700 text-gray-400 opacity-80'}`}
            whileHover={attemptsData.attemptsLeft > 0 ? { scale: 1.05 } : {}}
            whileTap={attemptsData.attemptsLeft > 0 ? { scale: 0.95 } : {}}
            disabled={attemptsData.attemptsLeft <= 0}
            style={{textShadow: attemptsData.attemptsLeft > 0 ? '0 1px 2px #fff8, 0 0 2px #000' : '0 1px 2px #0008'}}
          >
            {attemptsData.attemptsLeft > 0 
              ? (
                <div className="flex flex-col">
                  <span>Play <span className="text-sm font-normal bg-yellow-700 bg-opacity-50 px-2 py-1 rounded-xl ml-1">({attemptsData.attemptsLeft}/{MAX_MERGE_ATTEMPTS})</span></span>
                  {remainingTime && attemptsData.attemptsLeft < MAX_MERGE_ATTEMPTS && (
                    <span className="text-xs mt-1 font-normal">Next attempt in: {remainingTime}</span>
                  )}
                </div>
              ) 
              : (
                <div className="flex flex-col">
                  <span>No attempts</span>
                  {remainingTime && (
                    <span className="text-xs mt-1 font-normal">Next attempt in: {remainingTime}</span>
                  )}
                </div>
              )}
          </motion.button>
          
          {/* Кнопка PVP (Coming Soon) */}
          <motion.button
            className="w-full px-6 py-4 rounded-xl font-bold text-xl text-gray-400 relative overflow-hidden bg-gradient-to-r from-gray-800/90 via-gray-900/95 to-gray-950/95 border-2 border-gray-700 opacity-80"
            disabled={true}
            style={{textShadow: '0 1px 2px #0008'}}
          >
            <div className="flex items-center justify-center">
              <span>PVP</span>
              <span className="text-sm font-normal bg-gray-700 bg-opacity-70 px-2 py-1 rounded-xl ml-2">Coming Soon</span>
            </div>
          </motion.button>
          
          {/* Основной контент кнопок */}
        </div>
      </div>
    </div>
  )
}

export default Merge 