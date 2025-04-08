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

  // Загрузка данных о попытках из localStorage при монтировании компонента
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData) as MergeGameAttemptsData;
          
          // Проверяем корректность данных
          if (parsedData.attemptsLeft === undefined || 
              parsedData.lastAttemptTime === undefined ||
              parsedData.nextRecoveryTime === undefined) {
            // Если данные некорректны, сбрасываем до начальных значений
            resetAttemptsToMax();
          } else {
            // Если данные корректны, проверяем, не нужно ли сбросить попытки
            const now = Date.now();
            // Если прошло больше 24 часов с последнего сохранения, сбрасываем попытки до максимума
            if (now - parsedData.lastAttemptTime > 24 * 60 * 60 * 1000) {
              resetAttemptsToMax();
            } else {
              // Иначе загружаем сохраненные данные
              setAttemptsData(parsedData);
            }
          }
        } catch (e) {
          // При ошибке парсинга, сбрасываем до начальных значений
          resetAttemptsToMax();
        }
      } else {
        // Если данных нет, инициализируем с максимальным количеством попыток
        resetAttemptsToMax();
      }
    }
  }, []);

  // Функция для сброса попыток до максимального значения
  const resetAttemptsToMax = () => {
    const initialData: MergeGameAttemptsData = {
      attemptsLeft: MAX_MERGE_ATTEMPTS,
      lastAttemptTime: Date.now(),
      nextRecoveryTime: 0
    };
    setAttemptsData(initialData);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialData));
  };

  // Обновление таймера и проверка восстановления попыток
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      // Если есть время восстановления и оно пришло
      if (attemptsData.nextRecoveryTime > 0 && now >= attemptsData.nextRecoveryTime && attemptsData.attemptsLeft < MAX_MERGE_ATTEMPTS) {
        // Рассчитываем, сколько попыток должно восстановиться
        const timeSinceLastAttempt = now - attemptsData.lastAttemptTime;
        const recoveredAttempts = Math.min(
          Math.floor(timeSinceLastAttempt / MERGE_ATTEMPT_RECOVERY_TIME),
          MAX_MERGE_ATTEMPTS - attemptsData.attemptsLeft
        );
        
        if (recoveredAttempts > 0) {
          const newAttemptsLeft = Math.min(attemptsData.attemptsLeft + recoveredAttempts, MAX_MERGE_ATTEMPTS);
          const newLastAttemptTime = attemptsData.lastAttemptTime + (recoveredAttempts * MERGE_ATTEMPT_RECOVERY_TIME);
          const newNextRecoveryTime = newAttemptsLeft < MAX_MERGE_ATTEMPTS ? newLastAttemptTime + MERGE_ATTEMPT_RECOVERY_TIME : 0;
          
          const updatedData: MergeGameAttemptsData = {
            attemptsLeft: newAttemptsLeft,
            lastAttemptTime: newLastAttemptTime,
            nextRecoveryTime: newNextRecoveryTime
          };
          
          setAttemptsData(updatedData);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedData));
        }
      }
      
      // Обновляем отображение оставшегося времени до восстановления попытки
      if (attemptsData.nextRecoveryTime > 0 && now < attemptsData.nextRecoveryTime) {
        const timeLeft = attemptsData.nextRecoveryTime - now;
        const hours = Math.floor(timeLeft / (60 * 60 * 1000));
        const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
        const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
        
        setRemainingTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setRemainingTime("");
      }
    }, 1000);
    
    return () => clearInterval(interval);
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
    
    // Сохраняем состояние игры принудительно после использования попытки
    forceSave(300).then(success => {
      if (success) {
        console.log('[MergeGame] Состояние игры сохранено после использования попытки');
      } else {
        console.warn('[MergeGame] Не удалось сохранить состояние игры после использования попытки');
      }
    });
    
    // Скрываем интерфейс при запуске игры
    dispatch({ type: "SET_HIDE_INTERFACE", payload: true })
    setIsGameLaunched(true)
  }

  const handleBackToMenu = () => {
    dispatch({ type: "SET_HIDE_INTERFACE", payload: false })
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