"use client"

import React, { useState, useEffect, useCallback, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import LoadingScreen from "./LoadingScreen"
import { ErrorBoundary, ErrorDisplay } from "./ErrorBoundary"
import dynamic from "next/dynamic"
import { GameProvider, useGameContext } from "../contexts/GameContext"
import { TranslationProvider } from "../contexts/TranslationContext"
import Resources from "./common/Resources"
import { parseInitDataUnsafe } from "../utils/telegramUtils"
import { getOrCreateUserGameState, updateGameState, saveOrUpdateUser } from "../utils/db"
import type { User, GameState } from "../types/gameTypes"

// Import all main components with error handling
const Laboratory = dynamic(
  () =>
    import("./game/laboratory/laboratory").catch((err) => {
      console.error("Error loading Laboratory:", err)
      return () => <ErrorDisplay message="Failed to load Laboratory component" />
    }),
  {
    loading: () => <LoadingScreen />,
    ssr: false,
  },
)

const Storage = dynamic(
  () =>
    import("./game/Storage").catch((err) => {
      console.error("Error loading Storage:", err)
      return () => <ErrorDisplay message="Failed to load Storage component" />
    }),
  {
    loading: () => <LoadingScreen />,
    ssr: false,
  },
)

const Games = dynamic(
  () =>
    import("./game/Games").catch((err) => {
      console.error("Error loading Games:", err)
      return () => <ErrorDisplay message="Failed to load Games component" />
    }),
  {
    loading: () => <LoadingScreen />,
    ssr: false,
  },
)

const TabBar = dynamic(
  () =>
    import("./TabBar/TabBar").catch((err) => {
      console.error("Error loading TabBar:", err)
      return () => <ErrorDisplay message="Failed to load TabBar component" />
    }),
  {
    loading: () => <LoadingScreen />,
    ssr: false,
  },
)

const Fusion = dynamic(
  () =>
    import("./game/fusion/Fusion").catch((err) => {
      console.error("Error loading Fusion:", err)
      return () => <ErrorDisplay message="Failed to load Fusion component" />
    }),
  {
    loading: () => <LoadingScreen />,
    ssr: false,
  },
)

const Settings = dynamic(
  () =>
    import("./game/Settings").catch((err) => {
      console.error("Error loading Settings:", err)
      return () => <ErrorDisplay message="Failed to load Settings component" />
    }),
  {
    loading: () => <LoadingScreen />,
    ssr: false,
  },
)

const ProfilePage = dynamic(
  () =>
    import("./game/profile/ProfilePage").catch((err) => {
      console.error("Error loading ProfilePage:", err)
      return () => <ErrorDisplay message="Failed to load ProfilePage component" />
    }),
  {
    loading: () => <LoadingScreen />,
    ssr: false,
  },
)

const isBrowser = typeof window !== "undefined"

function HomeContentInner() {
  const { state, dispatch } = useGameContext()
  const [viewportHeight, setViewportHeight] = useState("100vh")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isGameLoaded, setIsGameLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isBrowser) {
      const setAppHeight = () => {
        const vh = window.innerHeight * 0.01
        document.documentElement.style.setProperty("--vh", `${vh}px`)
        setViewportHeight(`${window.innerHeight}px`)
      }

      setAppHeight()
      window.addEventListener("resize", setAppHeight)
      return () => window.removeEventListener("resize", setAppHeight)
    }
  }, [])

  useEffect(() => {
    const initializeGame = async () => {
      if (isBrowser) {
        try {
          if (typeof window !== "undefined" && window.Telegram?.WebApp) {
            const initDataUnsafe = window.Telegram.WebApp.initDataUnsafe
            console.log("Raw initDataUnsafe:", initDataUnsafe)
            const telegramUser = parseInitDataUnsafe(initDataUnsafe)

            if (!telegramUser) {
              throw new Error("Invalid user data")
            }

            console.log("Parsed Telegram user:", telegramUser)

            // Save or update user in Supabase
            const savedUser = await saveOrUpdateUser(telegramUser)
            dispatch({ type: "SET_USER", payload: savedUser })

            // Get or create game state
            const gameState = await getOrCreateUserGameState(savedUser.telegram_id)
            dispatch({ type: "LOAD_GAME_STATE", payload: gameState })

            setIsGameLoaded(true)
          } else {
            setError("Telegram WebApp is not available")
          }
        } catch (err) {
          console.error("Error in game initialization:", err)
          setError(err instanceof Error ? err.message : "An unknown error occurred during initialization")
        }
      }
    }

    initializeGame()
  }, [dispatch])

  // Add a new effect to save game state when it changes
  useEffect(() => {
    if (state.user && isGameLoaded) {
      const saveGameState = async () => {
        try {
          await updateGameState(state.user.telegram_id, state)
        } catch (error) {
          console.error("Error saving game state:", error)
        }
      }

      saveGameState()
    }
  }, [state, isGameLoaded])

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false)
  }, [])

  const renderActivePage = () => {
    switch (state.activeTab) {
      case "fusion":
        return <Fusion />
      case "laboratory":
        return <Laboratory />
      case "storage":
        return <Storage />
      case "games":
        return <Games />
      case "profile":
        return <ProfilePage />
      case "settings":
        return <Settings onClose={closeSettings} />
      default:
        return <Laboratory />
    }
  }

  if (error) {
    return <ErrorDisplay message={`An error occurred: ${error}`} />
  }

  const gameState = useGameContext().state

  return (
    <main
      className="flex flex-col w-full overflow-hidden bg-gradient-to-b from-gray-900 to-black"
      style={{
        height: viewportHeight,
        maxHeight: viewportHeight,
        maxWidth: "100vw",
        margin: "0 auto",
        backgroundColor: "var(--tg-theme-bg-color, #1c1c1e)",
        color: "var(--tg-theme-text-color, #ffffff)",
      }}
    >
      <div className="flex flex-col h-full">
        {state.activeTab !== "profile" && (
          <ErrorBoundary
            fallback={<ErrorDisplay message="An error occurred while loading resources. Please try again." />}
          >
            <Suspense fallback={<LoadingScreen />}>
              <Resources
                isVisible={true}
                isSettingsOpen={isSettingsOpen}
                setIsSettingsOpen={setIsSettingsOpen}
                closeSettings={closeSettings}
                showStatusPanel={true}
                activeTab={state.activeTab}
                energy={state.energy}
                maxEnergy={state.maxEnergy}
                energyRecoveryTime={state.energyRecoveryTime}
                snotCoins={state.inventory.snotCoins}
                snot={state.inventory.snot}
              />
            </Suspense>
          </ErrorBoundary>
        )}
        <div className="flex-grow relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900 opacity-50 z-10" />
          <div className="relative z-20 h-full overflow-y-auto">
            <AnimatePresence mode="wait">
              <ErrorBoundary
                fallback={<ErrorDisplay message="An error occurred in the main content. Please try again." />}
              >
                <Suspense fallback={<LoadingScreen />}>{renderActivePage()}</Suspense>
              </ErrorBoundary>
            </AnimatePresence>
          </div>
        </div>
        <ErrorBoundary
          fallback={<ErrorDisplay message="An error occurred while loading the tab bar. Please try again." />}
        >
          <Suspense fallback={<LoadingScreen />}>
            <TabBar setIsSettingsOpen={setIsSettingsOpen} closeSettings={closeSettings} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </main>
  )
}

export default function HomeContent() {
  return (
    <GameProvider>
      <TranslationProvider>
        <ErrorBoundary fallback={<ErrorDisplay message="An unexpected error occurred. Please try again." />}>
          <Suspense fallback={<LoadingScreen />}>
            <HomeContentInner />
          </Suspense>
        </ErrorBoundary>
      </TranslationProvider>
    </GameProvider>
  )
}

