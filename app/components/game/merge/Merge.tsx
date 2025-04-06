"use client"

import React, { useState } from "react"
import { useTranslation } from "../../../i18n"
import { useGameState, useGameDispatch } from "../../../contexts"
import dynamic from "next/dynamic"

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

  const handlePlayClick = () => {
    // Скрываем интерфейс при запуске игры
    dispatch({ type: "SET_HIDE_INTERFACE", payload: true })
    setIsGameLaunched(true)
  }

  const handleBackToMenu = () => {
    dispatch({ type: "SET_HIDE_INTERFACE", payload: false })
    setIsGameLaunched(false)
  }

  if (isGameLaunched) {
    return <MergeGameLauncher onBack={handleBackToMenu} />
  }

  return (
    <div 
      className="flex flex-col items-center justify-center w-full h-[calc(100vh-5.5rem-60px)] p-4 relative"
      style={{
        backgroundImage: "url('/images/merge/background/merge-background.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}
    >
      <h1 className="text-white text-4xl font-bold mb-8 text-shadow">
        {t("mergeGameTitle") || "Merge Game"}
      </h1>
      
      <button 
        onClick={handlePlayClick}
        className="bg-gradient-to-b from-[#4a7a9e] to-[#2a3b4d] border-2 border-[#6a8aae] rounded-lg px-12 py-4 text-white text-2xl font-bold cursor-pointer shadow-lg transition-all duration-200 mt-8 hover:scale-105 hover:shadow-xl active:scale-[0.98]"
      >
        {t("play") || "Play"}
      </button>
    </div>
  )
}

export default Merge 