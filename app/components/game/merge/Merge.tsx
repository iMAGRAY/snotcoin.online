"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useTranslation } from "../../../i18n"
import { useGameState, useGameDispatch } from "../../../contexts"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { ICONS } from "../../../constants/uiConstants"
import { useForceSave } from "../../../hooks/useForceSave"
import { ChestCarousel } from "../storage/ChestCarousel"
import { CHEST_IMAGES_ARRAY } from "../../../constants/storageConstants"
import FeedbackMessage from '../../ui/FeedbackMessage'
import { Clock, X } from 'lucide-react'

// Константы для хранения попыток
const MAX_MERGE_ATTEMPTS = 3;
const MERGE_ATTEMPT_RECOVERY_TIME = 8 * 60 * 60 * 1000; // 8 часов в миллисекундах
const LOCAL_STORAGE_KEY = 'mergeGameAttempts';

// Unlock durations in milliseconds
const DURATION_MS: Record<number, number> = { 1: 3 * 3600000, 2: 9 * 3600000, 3: 36 * 3600000 };

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

// Arrow button component for chest carousel
const ArrowButton: React.FC<{ direction: "left" | "right"; onClick: () => void }> = React.memo(
  ({ direction, onClick }) => {
    const isLeft = direction === "left";
    return (
      <button
        onClick={onClick}
        className={`absolute top-1/2 ${isLeft ? "left-4" : "right-4"} transform -translate-y-1/2 bg-gray-700 bg-opacity-50 text-white p-2 rounded-full z-30`}
      >
        {isLeft ? "<" : ">"}
      </button>
    )
  }
)
ArrowButton.displayName = "ArrowButton"

const Merge: React.FC = () => {
  const { t } = useTranslation()
  const { hideInterface, inventory } = useGameState()
  const gameDispatch = useGameDispatch()
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
  
  // Chest carousel state under Play and PVP buttons
  const chestCount = CHEST_IMAGES_ARRAY.length
  const [activeChestIndex, setActiveChestIndex] = useState(0)
  const carouselContainerRef = useRef<HTMLDivElement>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const handlePrevChest = useCallback(() => {
    setActiveChestIndex(prev => (prev - 1 + chestCount) % chestCount)
  }, [chestCount])
  const handleNextChest = useCallback(() => {
    setActiveChestIndex(prev => (prev + 1) % chestCount)
  }, [chestCount])

  // Slots for chest cards: 0 = empty, 1-3 = chest level
  const [chestSlots, setChestSlots] = useState<number[]>(Array(4).fill(0))
  // Unlock times for each slot (timestamp in ms)
  const [chestUnlockTimes, setChestUnlockTimes] = useState<number[]>(Array(4).fill(0))
  // Current time for countdown
  const [now, setNow] = useState<number>(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  // Open card when ready
  const handleOpenCard = useCallback((index: number) => {
    // Only reset unlock time, keep the chest slot
    setChestUnlockTimes(prev => {
      const next = [...prev]; next[index] = 0; return next
    })
    setConfirmSlot(null)
  }, [])

  const handleFillCard = useCallback(() => {
    const firstEmpty = chestSlots.findIndex(slot => slot === 0)
    if (firstEmpty === -1) return
    const level = Math.floor(Math.random() * CHEST_IMAGES_ARRAY.length) + 1
    // Set chest slot (unlock time will be set on confirm)
    setChestSlots(prev => {
      const next = [...prev]; next[firstEmpty] = level; return next
    })
  }, [chestSlots])
  
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
    showFeedback('Attempts restored!');
  };

  // Функция для добавления RoyalCoin
  const addRoyalCoins = (amount: number = 100) => {
    gameDispatch(prev => ({
      ...prev,
      inventory: {
        ...prev.inventory,
        snotCoins: (prev.inventory.snotCoins || 0) + amount
      }
    }));
    showFeedback(`Added ${amount} RoyalCoins!`);
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
    gameDispatch(prevState => ({
      ...prevState,
      hideInterface: true
    }));
    setIsGameLaunched(true)
  }

  const handleBackToMenu = () => {
    gameDispatch(prevState => ({
      ...prevState,
      hideInterface: false
    }));
    setIsGameLaunched(false)
  }

  const handleToggleOnline = () => {
    setIsOnline(!isOnline)
  }

  // Confirm dialog slot index for starting countdown
  const [confirmSlot, setConfirmSlot] = useState<number | null>(null)

  // In-game feedback message
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg)
    setTimeout(() => setFeedbackMessage(null), 3000)
  }

  if (isGameLaunched) {
    return <MergeGameLauncher 
      onBack={handleBackToMenu} 
      attemptsData={attemptsData}
      maxAttempts={MAX_MERGE_ATTEMPTS}
      remainingTime={remainingTime}
    />;
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
      {/* Fixed Fill Card, Reset Attempts, and RoyalCoin buttons at top */}
      <div className="fixed left-0 right-0 top-4 flex justify-center gap-3 z-50">
        <motion.button
          onClick={handleFillCard}
          className="px-4 py-3 rounded-lg font-bold text-base relative overflow-hidden bg-gradient-to-b from-blue-400 to-blue-600 text-white border-b-[4px] border-blue-700 shadow-lg"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Add thin border */}
          <div className="absolute inset-0 z-0 overflow-hidden rounded-lg">
            <div className="absolute inset-0 border border-white/20 rounded-lg"></div>
          </div>
        
          <div className="flex items-center justify-center relative z-10">
            <span className="text-white font-bold" style={{textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'}}>
              Fill Card
            </span>
          </div>
        </motion.button>

        {/* Reset Attempts button */}
        <motion.button
          onClick={resetAttemptsData}
          className="px-4 py-3 rounded-lg font-bold text-base relative overflow-hidden bg-gradient-to-b from-green-400 to-green-600 text-white border-b-[4px] border-green-700 shadow-lg"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Add thin border */}
          <div className="absolute inset-0 z-0 overflow-hidden rounded-lg">
            <div className="absolute inset-0 border border-white/20 rounded-lg"></div>
          </div>
        
          <div className="flex items-center justify-center relative z-10">
            <span className="text-white font-bold" style={{textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'}}>
              Reset Attempts
            </span>
          </div>
        </motion.button>
        
        {/* Add RoyalCoins button */}
        <motion.button
          onClick={() => addRoyalCoins(100)}
          className="px-4 py-3 rounded-lg font-bold text-base relative overflow-hidden bg-gradient-to-b from-amber-400 to-amber-600 text-white border-b-[4px] border-amber-700 shadow-lg"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Add thin border */}
          <div className="absolute inset-0 z-0 overflow-hidden rounded-lg">
            <div className="absolute inset-0 border border-white/20 rounded-lg"></div>
          </div>
        
          <div className="flex items-center justify-center gap-2 relative z-10">
            <Image src={ICONS.KINGCOIN} alt="RoyalCoin" width={24} height={24} className="object-contain" />
            <span className="text-white font-bold" style={{textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'}}>
              +100 RoyalCoins
            </span>
          </div>
        </motion.button>
      </div>

      {/* Play and PVP buttons and chest cards (no wrapper) */}
      <div className="flex w-full mb-4 gap-4">
          <motion.button
            onClick={handlePlayClick}
            className={`flex-1 px-6 py-4 rounded-xl font-bold text-xl relative overflow-hidden shadow-lg ${
                attemptsData.attemptsLeft > 0 
                ? 'bg-gradient-to-b from-yellow-400 to-yellow-600 text-white border-b-[6px] border-yellow-700' 
                : 'bg-gradient-to-b from-gray-600 to-gray-800 text-gray-300 border-b-[6px] border-gray-900'
            }`}
            whileHover={attemptsData.attemptsLeft > 0 ? { scale: 1.05 } : {}}
            whileTap={attemptsData.attemptsLeft > 0 ? { scale: 0.95 } : {}}
            disabled={attemptsData.attemptsLeft <= 0}
            style={{textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000'}}
          >
            {/* Add thin border */}
            <div className="absolute inset-0 z-0 overflow-hidden rounded-xl">
              <div className="absolute inset-0 border border-white/20 rounded-xl"></div>
            </div>

            <div className="relative z-10">
              {attemptsData.attemptsLeft > 0 
                ? (
                  <div className="flex flex-col">
                    <span className="text-[28px]">Solo <span className="text-sm font-normal bg-yellow-700 px-2 py-1 rounded-xl ml-1">({attemptsData.attemptsLeft}/{MAX_MERGE_ATTEMPTS})</span></span>
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
            </div>
          </motion.button>
          
          {/* Кнопка PVP (Coming Soon) */}
          <motion.button
            className="flex-1 px-6 py-4 rounded-xl font-bold text-xl relative overflow-hidden bg-gradient-to-b from-blue-400 to-blue-600 text-white border-b-[6px] border-blue-700 shadow-lg"
            disabled={true}
          >
            {/* Add thin border */}
            <div className="absolute inset-0 z-0 overflow-hidden rounded-xl">
              <div className="absolute inset-0 border border-white/20 rounded-xl"></div>
            </div>
          
            <div className="flex items-center justify-center relative z-10">
              <span className="text-white text-[32px] font-black" style={{textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000'}}>
                PVP
              </span>
            </div>
          </motion.button>
      </div>
      
      {/* Chest card slots fixed above TabBar */}
      <div className="fixed left-0 right-0 bottom-28 px-4 flex justify-center gap-4 z-40">
        {chestSlots.map((slot, idx) => {
          const unlockTime = chestUnlockTimes[idx] || 0
          const remainingMs = unlockTime ? unlockTime - now : 0
          const hours = Math.floor(remainingMs / 3600000)
          const minutes = Math.floor((remainingMs % 3600000) / 60000)
          const timeLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
          // Dynamic background color based on rarity
          let bgColor = 'bg-white/10'
          if (slot === 1) {
            bgColor = 'bg-gray-700/80'
          } else if (slot === 2) {
            bgColor = 'bg-green-800/80'
          } else if (slot === 3) {
            bgColor = 'bg-purple-800/80'
          }
          // Updated glassmorphic style with rarity colors
          const containerClasses = `${bgColor} backdrop-blur-sm border-2 ${
            slot === 1 
              ? 'border-gray-500/70'
              : slot === 2
                ? 'border-green-500/70'
                : slot === 3
                  ? 'border-purple-500/70'
                  : 'border-white/30'
          } shadow-lg shadow-black/60`
          return (
            <div
              key={idx}
              onClick={() => {
                // only interact if slot has chest and not already unlocking
                if (slot > 0 && chestUnlockTimes[idx] === 0) {
                  // always show confirmation dialog; cost (0 or 1 SC) is handled in the overlay
                  setConfirmSlot(idx)
                }
              }}
              style={{ cursor: slot > 0 && chestUnlockTimes[idx] === 0 ? 'pointer' : 'default' }}
              className={`relative w-28 h-36 ${containerClasses} rounded-xl overflow-hidden flex flex-col shadow-lg hover:shadow-xl transition-all duration-300 ${
                slot > 0 && chestUnlockTimes[idx] === 0 
                  ? 'hover:scale-105 active:scale-95 transition-transform duration-200' 
                  : ''
              } ${slot > 0 ? 'ring-2 ring-opacity-70 ring-offset-0 ring-offset-transparent' + 
                  (slot === 1 ? ' ring-gray-400' : 
                   slot === 2 ? ' ring-green-400' : 
                   ' ring-purple-400') : ''}`}
            >
              {/* Add glossy effect */}
              <div className="absolute inset-0 z-0 overflow-hidden rounded-xl">
                {/* Subtle diagonal glossy sheen */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent"></div>
                
                {/* Very thin top edge highlight */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/60"></div>
                
                {/* Subtle bottom shadow for minimal depth */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/30"></div>
                
                {/* Additional glow effect for occupied slots */}
                {slot > 0 && (
                  <div className={`absolute inset-0 opacity-30 ${
                    slot === 1 
                      ? 'bg-gradient-to-br from-gray-300/20 to-gray-700/20' 
                      : slot === 2 
                        ? 'bg-gradient-to-br from-green-300/20 to-green-700/20' 
                        : 'bg-gradient-to-br from-purple-300/20 to-purple-700/20'
                  }`}></div>
                )}
              </div>

              {/* Locked badge for unavailable slots */}
              {slot > 0 && chestUnlockTimes[idx] === 0 && chestUnlockTimes.some(time => time > 0 && time > now) && (
                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-white text-xl font-semibold" style={{textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000'}}>
                  Locked
                </div>
              )}
              {slot > 0 ? (
                <>
                  <div className="relative flex-grow w-full h-full flex items-center justify-center">
                    {/* Display time at the top for chests not being unlocked */}
                    {chestUnlockTimes[idx] === 0 && !chestUnlockTimes.some(time => time > 0 && time > now) && (
                      <div className="absolute top-1 z-10 text-white text-2xl font-black" style={{textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000'}}>
                        {slot === 1 
                          ? <>3<span className="text-base inline-block relative" style={{top: '0.1em', marginLeft: '0.2em'}}>h</span></>
                          : slot === 2 
                            ? <>9<span className="text-base inline-block relative" style={{top: '0.1em', marginLeft: '0.2em'}}>h</span></>
                            : <>36<span className="text-base inline-block relative" style={{top: '0.1em', marginLeft: '0.2em'}}>h</span></>
                        }
                      </div>
                    )}
                    
                    {/* Display countdown timer for chests being unlocked */}
                    {chestUnlockTimes[idx] !== undefined && chestUnlockTimes[idx] > 0 && chestUnlockTimes[idx] > now && (
                      <div className="absolute top-1 z-10">
                        <span className="text-amber-300 font-bold text-2xl" style={{textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000'}}>
                          {hours > 0 
                            ? <>{hours}<span className="text-xl inline-block relative" style={{top: '0.3em', marginLeft: '0.15em'}}>h</span> {minutes}<span className="text-xl inline-block relative" style={{top: '0.3em', marginLeft: '0.15em'}}>m</span></>
                            : <>{minutes}<span className="text-xl inline-block relative" style={{top: '0.3em', marginLeft: '0.15em'}}>m</span></>
                          }
                        </span>
                      </div>
                    )}
                    <Image
                      src={CHEST_IMAGES_ARRAY[slot - 1] || '/images/merge/chests/common.webp'}
                      alt={`Chest Level ${slot}`}
                      fill
                      sizes="100%"
                      style={{ objectFit: 'contain', padding: '0.5rem' }}
                      draggable={false}
                      className={`
                        ${slot === 1 
                          ? 'drop-shadow-[0_0_6px_rgba(180,180,180,0.5)]' 
                          : slot === 2 
                            ? 'drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]' 
                            : 'drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                        }
                      `}
                    />
                    {/* Add rarity label below chest */}
                    <div className="absolute bottom-1 z-10">
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                        slot === 1 
                          ? 'bg-gray-600/70 text-gray-200' 
                          : slot === 2 
                            ? 'bg-green-600/70 text-green-100' 
                            : 'bg-purple-600/70 text-purple-100'
                      }`}>
                        {slot === 1 ? 'Common' : slot === 2 ? 'Uncommon' : 'Rare'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-grow flex items-center justify-center">
                  <span className="text-white opacity-50 font-semibold">Empty</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {/* Add keyframes for button animation in the component */}
      <style jsx>{`
        @keyframes buttonShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      {/* Confirm dialog overlay for starting countdown */}
      {confirmSlot !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <AnimatePresence>
            <motion.div 
              className="bg-gradient-to-br from-[#3a5c82]/90 to-[#4a7a9e]/90 rounded-2xl p-8 max-w-xs mx-auto border border-[#5889ae]/70 backdrop-blur-sm shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3),0_8px_10px_-6px_rgba(0,0,0,0.2),0_0_0_1px_rgba(88,137,174,0.2),inset_0_1px_1px_rgba(255,255,255,0.15)]"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
            >
              {/* Header with icon */}
              <div className="flex items-center justify-center space-x-2 mb-6">
                <div className="bg-[#5889ae]/30 p-2 rounded-full">
                  <Clock className="w-6 h-6 text-yellow-400" />
                </div>
                <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">Start countdown?</h3>
              </div>
              
              {/* Show chest level info */}
              {confirmSlot !== null && chestSlots[confirmSlot] !== undefined && chestSlots[confirmSlot] > 0 && (
                <div className="mb-6 flex flex-col items-center justify-center">
                  <div className="relative w-48 h-48 mb-2">
                    <Image
                      src={confirmSlot !== null && chestSlots[confirmSlot] !== undefined ? 
                        (CHEST_IMAGES_ARRAY[chestSlots[confirmSlot] - 1] || '/images/merge/chests/common.webp') : 
                        '/images/merge/chests/common.webp'}
                      alt={`Chest Level ${confirmSlot !== null && chestSlots[confirmSlot] !== undefined ? chestSlots[confirmSlot] : 1}`}
                      fill
                      sizes="100%"
                      style={{ objectFit: 'contain' }}
                      draggable={false}
                      className="drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]"
                    />
                  </div>
                  <div className="bg-yellow-600/20 text-amber-300 text-xs font-bold px-3 py-1 rounded-full">
                    Arena {confirmSlot !== null && chestSlots[confirmSlot] !== undefined ? chestSlots[confirmSlot] : 1}
                  </div>
                </div>
              )}
              
              {/* Buttons with better styling */}
              <div className="flex flex-col space-y-3">
                <motion.button
                  onClick={() => {
                    // Check if another chest is already being unlocked
                    if (chestUnlockTimes.some(time => time > now)) {
                      // If player doesn't have enough KingCoin
                      if (inventory.snotCoins < 1) {
                        showFeedback('Not enough KingCoin.')
                        return;
                      }
                      
                      // Pay 1 SC to unlock immediately
                      gameDispatch(prev => ({
                        ...prev,
                        inventory: {
                          ...prev.inventory,
                          snotCoins: (prev.inventory.snotCoins || 0) - 1
                        }
                      }))
                      
                      // Reset the unlock time for this chest (immediately unlock)
                      if (confirmSlot !== null) {
                        handleOpenCard(confirmSlot)
                      }
                    } else {
                      // Normal unlock (start countdown)
                      if (confirmSlot !== null && chestSlots[confirmSlot]) {
                        const level = chestSlots[confirmSlot]
                        setChestUnlockTimes(prev => {
                          const next = [...prev]
                          if (confirmSlot !== null && level) {
                            next[confirmSlot] = Date.now() + (DURATION_MS[level] || 10800000) // Используем 3 часа по умолчанию
                          }
                          return next
                        })
                        setConfirmSlot(null)
                      }
                    }
                  }}
                  disabled={chestUnlockTimes.some(time => time > now) && inventory.snotCoins < 1}
                  className="w-full px-6 py-4 rounded-xl font-bold text-xl relative overflow-hidden bg-[#00ff00] text-white border-2 border-green-600 border-b-4 border-green-800 shadow-[0_7px_12px_-2px_rgba(0,0,0,0.8)] flex items-center justify-center transition-all duration-300"
                  style={{textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000'}}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Gloss overlay */}
                  <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-xl pointer-events-none"></div>
                  <div className="flex flex-col items-center">
                    <span className="text-center text-4xl font-bold">Start Now</span>
                    {chestUnlockTimes.some(time => time > now) ? (
                      <div className="flex items-center space-x-1 text-amber-300 font-medium mt-1">
                        <Image src={ICONS.KINGCOIN} alt="Coin" width={32} height={32} className="object-contain" />
                        <span className="text-3xl font-black">1</span>
                      </div>
                    ) : (
                      <span className="text-sm text-green-300 font-medium mt-1">Free</span>
                    )}
                  </div>
                </motion.button>
                
                <motion.button
                  onClick={() => setConfirmSlot(null)}
                  className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-gray-700 to-gray-800 text-[#a8c7e1] hover:bg-gray-600 transition-all duration-300 border border-gray-600/50 shadow-lg flex items-center justify-center"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <X className="w-5 h-5 mr-2" />
                  <span>Cancel</span>
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
      {/* End of Play/PVP and chest cards */}
      {/* In-game feedback */}
      <FeedbackMessage message={feedbackMessage} type="info" position="top" />
    </div>
  )
}

export default Merge 