"use client"

import React, { useState } from "react"
import { useTranslation } from "../../../i18n"
import { useGameState, useGameDispatch } from "../../../contexts"
import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import Image from "next/image"
import { ICONS } from "../../../constants/uiConstants"

// Динамически импортируем компонент MergeGameLauncher, чтобы работать с Planck на стороне клиента
const MergeGameLauncher = dynamic(() => import("./MergeGameLauncher"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center text-white text-2xl">
      Загрузка игры...
    </div>
  ),
})

interface MergeGameLauncherProps {
  onBack: () => void;
}

const Merge: React.FC = () => {
  const { t } = useTranslation()
  const { hideInterface } = useGameState()
  const dispatch = useGameDispatch()
  const [isGameLaunched, setIsGameLaunched] = useState(false)
  const [isOnline, setIsOnline] = useState(false)

  const handlePlayClick = () => {
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
    return <MergeGameLauncher onBack={handleBackToMenu} />
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
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-md">
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <motion.button
            onClick={handlePlayClick}
            className="relative px-6 py-4 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-2xl font-bold 
              text-white shadow-lg border-2 border-yellow-300 focus:outline-none focus:ring-2 
              focus:ring-yellow-300 focus:ring-opacity-50 h-16"
            whileHover={{ 
              scale: 1.05,
              boxShadow: "0 0 12px rgba(250, 204, 21, 0.7)",
            }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="flex items-center justify-center space-x-3">
              <Image 
                src={ICONS.LABORATORY.BUTTONS.CLAIM} 
                width={32} 
                height={32} 
                alt="Play" 
                className="inline-block" 
              />
              <span className="text-xl">{t("play") || "Play"}</span>
            </div>
          </motion.button>
          
          <motion.button
            onClick={handleToggleOnline}
            className={`relative px-6 py-4 rounded-2xl font-bold text-white shadow-lg border-2 focus:outline-none 
              focus:ring-2 focus:ring-opacity-50 h-16 
              ${isOnline 
                ? "bg-gradient-to-r from-blue-400 to-blue-600 border-blue-300 focus:ring-blue-300" 
                : "bg-gradient-to-r from-gray-500 to-gray-700 border-gray-400 focus:ring-gray-300"}`}
            whileHover={{ 
              scale: 1.05,
              boxShadow: isOnline 
                ? "0 0 12px rgba(96, 165, 250, 0.7)" 
                : "0 0 12px rgba(156, 163, 175, 0.7)",
            }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="flex items-center justify-center space-x-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
              </svg>
              <span className="text-xl">{isOnline ? "Online: On" : "Online: Off"}</span>
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  )
}

export default Merge 