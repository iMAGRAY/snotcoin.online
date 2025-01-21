import type React from "react"
import { useEffect, useState, useCallback } from "react"
import { useGameState, useGameDispatch, useGameActions } from "../contexts/GameContext"
import { useNetwork } from "../hooks/useNetwork"
import { useAnalytics } from "../hooks/useAnalytics"
import {
  isTelegramWebAppAvailable,
  setTelegramBackButton,
  expandTelegramWebApp,
  setTelegramMainButton,
} from "../utils/telegramAuth"
import UserProfile from "./UserProfile"
import Laboratory from "./game/laboratory/laboratory"
import Storage from "./game/Storage"
import Fusion from "./game/fusion/Fusion"
import Games from "./game/Games"
import Settings from "./game/Settings"

const Game: React.FC = () => {
  const gameState = useGameState()
  const dispatch = useGameDispatch()
  const { saveGame, loadGame } = useGameActions()
  const [isLoading, setIsLoading] = useState(true)
  const { isOnline } = useNetwork()
  const { logEvent } = useAnalytics()

  const handleGameStateChange = useCallback(
    (change: any) => {
      dispatch(change)
      saveGame()
    },
    [dispatch, saveGame],
  )

  useEffect(() => {
    const initializeGame = async () => {
      setIsLoading(true)
      if (isTelegramWebAppAvailable()) {
        await loadGame()
        expandTelegramWebApp()
        setTelegramBackButton(true)
        setTelegramMainButton({
          text: "Save Game",
          color: "#4CAF50",
          textColor: "#FFFFFF",
          isVisible: true,
          isActive: true,
          onClick: saveGame,
        })
      }
      setIsLoading(false)
    }

    initializeGame()

    return () => {
      setTelegramBackButton(false)
    }
  }, [loadGame, saveGame])

  const renderActiveTab = () => {
    switch (gameState.activeTab) {
      case "laboratory":
        return <Laboratory />
      case "storage":
        return <Storage />
      case "fusion":
        return <Fusion />
      case "games":
        return <Games />
      case "settings":
        return <Settings onClose={() => {}} />
      default:
        return <Laboratory />
    }
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!isTelegramWebAppAvailable()) {
    return <div>This app can only be accessed through Telegram.</div>
  }

  return (
    <div style={{ backgroundColor: gameState.theme.backgroundColor, color: gameState.theme.textColor }}>
      <UserProfile />
      {renderActiveTab()}
      {!isOnline && (
        <div className="offline-warning">
          You are currently offline. Your progress will be saved and synced when you're back online.
        </div>
      )}
    </div>
  )
}

export default Game

