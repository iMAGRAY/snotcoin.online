"use client"

import React, { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useGameState, useGameDispatch } from "../../../contexts"
import type { Chest } from "../../../types/storage"
import ChestCarousel from "./ChestCarousel"
import { useTranslation } from "../../../i18n"
import FallingRewards from "../../effects/FallingRewards"
import ExplosionEffect from "../../effects/ExplosionEffect"
import { ICONS } from "../../../constants/uiConstants"
import { MotionDiv } from "../../motion/MotionWrapper"
import { OpenButton } from "./OpenButton"

const chests: Chest[] = [
  {
    id: 1,
    name: "commonChest",
    image: ICONS.STORAGE.LEVELS.LEVEL1,
    requiredSnot: 5,
    reward: () => Math.floor(Math.random() * 7) + 2, // 2-8
    description: "commonChestDescription",
  },
  {
    id: 2,
    name: "rareChest",
    image: ICONS.STORAGE.LEVELS.LEVEL2,
    requiredSnot: 50,
    reward: () => Math.floor(Math.random() * 46) + 25, // 25-70
    description: "rareChestDescription",
  },
  {
    id: 3,
    name: "legendaryChest",
    image: ICONS.STORAGE.LEVELS.LEVEL3,
    requiredSnot: 400,
    reward: () => Math.floor(Math.random() * 301) + 200, // 200-500
    description: "legendaryChestDescription",
  },
]

const ArrowButton: React.FC<{ direction: "left" | "right"; onClick: () => void }> = React.memo(
  ({ direction, onClick }) => (
    <motion.button
      onClick={onClick}
      className={`absolute top-2/3 -translate-y-1/2 z-10 ${direction === "left" ? "left-2" : "right-2"} w-12 h-16 flex items-center justify-center bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-full shadow-lg overflow-hidden border-2 border-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-opacity-50`}
      whileHover={{
        boxShadow: "0 0 12px rgba(250, 204, 21, 0.7)",
      }}
      initial={false}
    >
      <motion.div
        className="w-full h-full flex items-center justify-center"
        whileTap={{
          scale: 0.9,
        }}
      >
        {direction === "left" ? (
          <ChevronLeft className="w-8 h-8 text-white" />
        ) : (
          <ChevronRight className="w-8 h-8 text-white" />
        )}
      </motion.div>
    </motion.button>
  ),
)

ArrowButton.displayName = "ArrowButton"

const getRewardColor = (amount: number, maxAmount: number): string => {
  const percentage = (amount / maxAmount) * 100
  if (percentage <= 20) return "text-gray-400"
  if (percentage <= 50) return "text-blue-400"
  if (percentage <= 75) return "text-yellow-400"
  return "text-purple-400"
}

const RewardDisplay: React.FC<{
  amount: number | null
  maxAmount: number
  setRewardAmount: (amount: number | null) => void
}> = React.memo(({ amount, maxAmount, setRewardAmount }) => {
  const [showNumber, setShowNumber] = React.useState(true)

  React.useEffect(() => {
    if (amount !== null) {
      setShowNumber(true)
      const timer1 = setTimeout(() => setShowNumber(false), 1500)
      const timer2 = setTimeout(() => setRewardAmount(null), 1600)
      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
      }
    }
    return () => {}; // Пустая функция очистки для случая amount === null
  }, [amount, setRewardAmount])

  if (amount === null) return null

  const rewardColor = getRewardColor(amount, maxAmount)

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <AnimatePresence>
        {showNumber && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 0 }}
            animate={{ scale: 1, opacity: 1, y: -50 }}
            exit={{ scale: 0, opacity: 0, y: -50 }}
            transition={{ duration: 0.3 }}
            className={`bg-gray-800 ${rewardColor} text-6xl font-bold rounded-full p-8 shadow-lg`}
          >
            +{amount}
          </motion.div>
        )}
      </AnimatePresence>
      <FallingRewards amount={amount} onComplete={() => {}} uniqueId={amount} rewardColor={rewardColor} />
      <ExplosionEffect />
    </div>
  )
})

RewardDisplay.displayName = "RewardDisplay"

// Open Chest Button - отдельный компонент, не вложенный в другие div
const OpenChestButton: React.FC<{onClick: () => void, text: string}> = React.memo(({onClick, text}) => {
  return (
    <motion.button
      onClick={onClick}
      className="fixed left-0 right-0 mx-auto bottom-20 w-3/5 max-w-sm z-50 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-bold px-6 rounded-2xl shadow-lg flex items-center justify-center space-x-2 border-2 border-yellow-300 h-16"
      whileHover={{ 
        scale: 1.05,
        boxShadow: "0 0 12px rgba(250, 204, 21, 0.7)"
      }}
      whileTap={{ scale: 0.95 }}
    >
      <span>{text}</span>
    </motion.button>
  );
});

OpenChestButton.displayName = "OpenChestButton";

const Storage: React.FC = () => {
  const gameState = useGameState()
  const gameDispatch = useGameDispatch()
  const { t } = useTranslation()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [isChestOpening, setIsChestOpening] = useState(false)
  const [rewardAmount, setRewardAmount] = useState<number | null>(null)

  const handleSwipe = useCallback((newDirection: number) => {
    setDirection(newDirection)
    setCurrentIndex((prevIndex) => {
      const nextIndex = prevIndex + newDirection
      if (nextIndex < 0) return chests.length - 1
      if (nextIndex >= chests.length) return 0
      return nextIndex
    })
  }, [])

  const handleNext = useCallback(() => {
    handleSwipe(1)
  }, [handleSwipe])

  const handlePrev = useCallback(() => {
    handleSwipe(-1)
  }, [handleSwipe])

  const handleOpenChest = useCallback(() => {
    const currentChest = chests[currentIndex]
    if (!currentChest) return

    if (gameState.inventory.snot >= currentChest.requiredSnot) {
      setIsChestOpening(true)
      setTimeout(() => {
        const reward = currentChest.reward()
        setRewardAmount(reward)
        setIsChestOpening(false)
        gameDispatch({ 
          type: "SET_RESOURCE", 
          payload: { 
            resource: "snot", 
            value: gameState.inventory.snot - currentChest.requiredSnot 
          } 
        })
        gameDispatch({ 
          type: "SET_RESOURCE", 
          payload: { 
            resource: "snotCoins", 
            value: gameState.inventory.snotCoins + reward 
          } 
        })
      }, 1000)
    } else {
      // Недостаточно SNOT для открытия сундука
    }
  }, [currentIndex, gameState.inventory.snot, gameDispatch])

  React.useEffect(() => {
    // Сброс состояния при размонтировании
    return () => {
      setIsChestOpening(false);
      setRewardAmount(null);
    };
  }, []);

  return (
    <>
      <motion.div 
        className="w-full h-full flex flex-col overflow-hidden bg-gradient-to-b from-gray-900 to-gray-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage:
              `url('${ICONS.STORAGE.BACKGROUND}')`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        />
        <div className="absolute inset-0 flex flex-col z-20">
          <div className="flex-grow flex flex-col">
            <div className="relative w-full max-w-md mx-auto h-full px-8">
              <ArrowButton direction="left" onClick={handlePrev} />
              <ArrowButton direction="right" onClick={handleNext} />
              <ChestCarousel
                currentIndex={currentIndex}
                direction={direction}
                chests={chests}
                onSwipe={handleSwipe}
                isChestOpening={isChestOpening}
                setCurrentIndex={setCurrentIndex}
              />
            </div>
          </div>
        </div>
        
        <RewardDisplay
          amount={rewardAmount}
          maxAmount={500} // Assuming 500 is the max reward
          setRewardAmount={setRewardAmount}
        />
      </motion.div>
      
      {/* Кнопка Open Chest - вне всех контейнеров */}
      <OpenChestButton onClick={handleOpenChest} text={t("openChest")} />
    </>
  )
}

Storage.displayName = "Storage"
export default React.memo(Storage)

