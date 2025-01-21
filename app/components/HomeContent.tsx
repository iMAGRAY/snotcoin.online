"use client"

import React, { useState, useEffect, useCallback, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import LoadingScreen from "./LoadingScreen"
import { ErrorBoundary, ErrorDisplay } from "./ErrorBoundary"
import dynamic from "next/dynamic"
import { GameProvider, useGameContext, useGameState } from "../contexts/GameContext"
import { TranslationProvider } from "../contexts/TranslationContext"
import Resources from "./common/Resources"
import { validateTelegramUser, getTelegramUser } from "../utils/telegramAuth"
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
  const [initializationAttempts, setInitializationAttempts] = useState(0)

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false)
  }, [])

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

  const initializeGame = useCallback(async () => {
    if (typeof window === "undefined") return

    try {
      // Wait for Telegram Web App to be available
      if (!window.Telegram?.WebApp) {
        console.log("Waiting for Telegram WebApp to initialize...")
        if (initializationAttempts < 5) {
          setTimeout(() => {
            setInitializationAttempts((prev) => prev + 1)
          }, 1000)
          return
        } else {
          throw new Error("Telegram WebApp initialization timeout")
        }
      }

      // Ensure we're running in Telegram environment
      const webApp = window.Telegram.WebApp
      if (!webApp) {
        throw new Error("Telegram WebApp is not available")
      }

      // Expand the Web App to full height
      webApp.expand()

      // Get the init data and validate the user
      const initData = webApp.initData
      const telegramUser = await validateTelegramUser(initData)
      if (!telegramUser) {
        throw new Error("Failed to validate user data")
      }

      // Save or update user in database
      const savedUser = await saveOrUpdateUser(telegramUser)
      dispatch({ type: "SET_USER", payload: savedUser })

      // Get or create game state
      const gameState = await getOrCreateUserGameState(savedUser.telegram_id)
      dispatch({ type: "LOAD_GAME_STATE", payload: gameState })

      setIsGameLoaded(true)
      setError(null)
    } catch (err) {
      console.error("Error in game initialization:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    }
  }, [dispatch, initializationAttempts])

  useEffect(() => {
    initializeGame()
  }, [initializeGame, initializationAttempts])

  // Add auto-retry logic for initialization errors
  useEffect(() => {
    if (error && initializationAttempts < 5) {
      const timer = setTimeout(() => {
        console.log(`Retrying initialization (attempt ${initializationAttempts + 1})...`)
        setInitializationAttempts((prev) => prev + 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [error, initializationAttempts])

  // Save game state when it changes
  useEffect(() => {
    if (state.user && isGameLoaded) {
      const saveGameState = async () => {
        try {
          if (state.user) {
            await updateGameState(state.user.telegram_id, state)
          }
        } catch (error) {
          console.error("Error saving game state:", error)
        }
      }

      saveGameState()
    }
  }, [state, isGameLoaded])

  const renderActivePage = useCallback(() => {
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
  }, [state.activeTab, closeSettings])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-center mb-4">{error}</p>
        {initializationAttempts >= 5 ? (
          <>
            <p className="text-center mb-4">
              Unable to initialize the game after multiple attempts. Please ensure you're opening this app through
              Telegram.
            </p>
            <button
              onClick={() => setInitializationAttempts(0)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
          </>
        ) : (
          <p className="text-center animate-pulse">Attempting to initialize... ({initializationAttempts}/5)</p>
        )}
        <div className="mt-4 text-center">
          <a
            href="https://core.telegram.org/bots/webapps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            Learn more about Telegram Web Apps
          </a>
        </div>
      </div>
    )
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
                key={state.activeTab}
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

