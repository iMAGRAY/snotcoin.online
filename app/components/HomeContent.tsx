"use client"

import React, { useState, useEffect, useCallback, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import LoadingScreen from "./LoadingScreen"
import { ErrorBoundary, ErrorDisplay } from "./ErrorBoundary"
import dynamic from "next/dynamic"
import { GameProvider, useGameContext } from "../contexts/GameContext"
import { TranslationProvider } from "../contexts/TranslationContext"
import Resources from "./common/Resources"
import { audioManager } from "../utils/AudioManager"
import { parseInitDataUnsafe, isTokenExpired } from "../utils/telegramUtils"
import { createNewUser, getUserByTelegramId, compareAndUpdateUserData } from "../utils/db"
import type { TelegramUser } from "../types/gameTypes"

// Import all main components
const Laboratory = dynamic(() => import("./game/laboratory/laboratory"), {
  loading: () => <LoadingScreen />,
  ssr: false,
})
const Storage = dynamic(() => import("./game/Storage"), {
  loading: () => <LoadingScreen />,
  ssr: false,
})
const Games = dynamic(() => import("./game/Games"), {
  loading: () => <LoadingScreen />,
  ssr: false,
})
const TabBar = dynamic(() => import("./TabBar/TabBar"), {
  loading: () => <LoadingScreen />,
  ssr: false,
})
const Fusion = dynamic(() => import("./game/fusion/Fusion"), {
  loading: () => <LoadingScreen />,
  ssr: false,
})
const Settings = dynamic(() => import("./game/Settings"), {
  loading: () => <LoadingScreen />,
  ssr: false,
})
const ProfilePage = dynamic(() => import("./game/profile/ProfilePage"), {
  loading: () => <LoadingScreen />,
  ssr: false,
})

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
          const initAuth = async () => {
            if (typeof window !== "undefined" && window.Telegram?.WebApp) {
              try {
                const initDataUnsafe = window.Telegram.WebApp.initDataUnsafe
                const telegramUser: TelegramUser = parseInitDataUnsafe(initDataUnsafe)

                if (isTokenExpired(telegramUser.auth_date)) {
                  throw new Error("Authentication expired")
                }

                dispatch({ type: "SET_USER", payload: telegramUser })

                let dbUser = await getUserByTelegramId(telegramUser.id)
                if (!dbUser) {
                  dbUser = await createNewUser(telegramUser)
                } else {
                  dbUser = await compareAndUpdateUserData(dbUser, telegramUser)
                }

                dispatch({
                  type: "LOAD_GAME_STATE",
                  payload: {
                    inventory: dbUser.inventories,
                    ...dbUser.game_progress,
                    wallet: dbUser.wallets[0],
                  },
                })

                setIsGameLoaded(true)
              } catch (err) {
                console.error("Error during authentication:", err)
                setError("An error occurred during authentication")
              }
            } else {
              setError("Telegram WebApp is not available")
            }
          }

          await initAuth()

          await new Promise((resolve) => setTimeout(resolve, 1000))

          dispatch({ type: "SET_GAME_STARTED", payload: true })
        } catch (err) {
          console.error("Error in game initialization:", err)
          setError(err instanceof Error ? err.message : "An unknown error occurred during initialization")
        }
      }
    }

    initializeGame()

    return () => {
      // Cleanup function
    }
  }, [dispatch])

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

  const gameState = useGameContext().state

  return (
    <ErrorBoundary
      fallback={<ErrorDisplay message="An unexpected error occurred in the game provider. Please try again." />}
    >
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
                  energy={gameState.energy}
                  maxEnergy={gameState.maxEnergy}
                  energyRecoveryTime={gameState.energyRecoveryTime}
                  snotCoins={gameState.inventory.snotCoins}
                  snot={gameState.inventory.snot}
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
    </ErrorBoundary>
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

