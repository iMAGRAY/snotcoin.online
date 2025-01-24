"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import FusionMenu from "./FusionMenu"
import { useGameState, useGameDispatch } from "../../../contexts/GameContext"
import { formatTime } from "../../../utils/gameUtils"

const Fusion: React.FC = () => {
  const router = useRouter()
  const gameState = useGameState()
  const dispatch = useGameDispatch()
  const [timeUntilNextGame, setTimeUntilNextGame] = useState<string>("")

  useEffect(() => {
    const timer = setInterval(() => {
      dispatch({ type: "UPDATE_FUSION_GAME_AVAILABILITY" })
      const currentTime = Date.now()
      const timeSinceLastGame = currentTime - gameState.lastFusionGameTime
      const timeUntilNext = Math.max(0, 12 * 60 * 60 * 1000 - (timeSinceLastGame % (12 * 60 * 60 * 1000)))
      setTimeUntilNextGame(formatTime(timeUntilNext / 1000))
    }, 1000)

    return () => clearInterval(timer)
  }, [dispatch, gameState.lastFusionGameTime])

  useEffect(() => {
    if (!gameState.fusionGameActive && gameState.fusionGameStarted) {
      dispatch({ type: "RESET_FUSION_GAME" })
    }
  }, [gameState.fusionGameActive, gameState.fusionGameStarted, dispatch])

  useEffect(() => {
    if (gameState.activeTab === "fusion" && !gameState.fusionGameActive) {
      dispatch({ type: "RESET_FUSION_GAME" })
    }
  }, [gameState.activeTab, gameState.fusionGameActive, dispatch])

  const handleStartGame = () => {
    if (gameState.fusionAttemptsUsed < 2) {
      dispatch({ type: "SET_FUSION_GAME_ACTIVE", payload: true })
      router.push("/fusion-game")
    }
  }

  return (
    <FusionMenu
      onStartGame={handleStartGame}
      attemptsUsed={gameState.fusionAttemptsUsed}
      timeUntilNextGame={timeUntilNextGame}
    />
  )
}

export default React.memo(Fusion)

