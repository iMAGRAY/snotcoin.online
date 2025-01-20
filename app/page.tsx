"use client"

import dynamic from "next/dynamic"
import { GameProvider } from "./contexts/GameContext"
import { TranslationProvider } from "./contexts/TranslationContext"
const HomeContent = dynamic(() => import("./components/HomeContent"), { ssr: false })

export default function Home() {
  return (
    <GameProvider>
      <TranslationProvider>
        <HomeContent />
      </TranslationProvider>
    </GameProvider>
  )
}

