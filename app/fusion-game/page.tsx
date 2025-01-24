"use client"

import dynamic from "next/dynamic"
import { GameProvider } from "../contexts/GameContext"
import { TranslationProvider } from "../contexts/TranslationContext"

const FusionGame = dynamic(() => import("../components/game/fusion/game/FusionGame"), { ssr: false })

export default function FusionGamePage() {
  return (
    <GameProvider>
      <TranslationProvider>
        <FusionGame />
      </TranslationProvider>
    </GameProvider>
  )
}

