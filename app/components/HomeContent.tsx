"use client"

import React, { useState, useEffect, useCallback, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import LoadingScreen from "./LoadingScreen"
import { ErrorBoundary, ErrorDisplay } from "./ErrorBoundary"
import dynamic from "next/dynamic"
import { GameProvider, useGameContext, useGameState } from "../contexts/GameContext"
import { TranslationProvider } from "../contexts/TranslationContext"
import Resources from "./common/Resources"
import AuthenticationWindow from "./auth/AuthenticationWindow"
import { loadFromLocalStorage, clearUserFromLocalStorage } from "../utils/localStorage"
import { useAuth } from "../contexts/AuthContext" // Import useAuth

// Import all main components
const Laboratory = dynamic(() => import("./game/laboratory/laboratory"), {
  loading: () => <LoadingScreen />,
  ssr: false,
})
const Storage = dynamic(() => import("./game/storage/Storage"), {
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
const Settings = dynamic(() => import("./game/settings/Settings"), {
  loading: () => <LoadingScreen />,
  ssr: false,
})
const ProfilePage = dynamic(() => import("./game/profile/ProfilePage"), {
  loading: () => <LoadingScreen />,
  ssr: false,
})

const isBrowser = typeof window !== "undefined"

function HomeContent() {
  const { state, dispatch } = useGameContext()
  const gameState = useGameState()
  const [viewportHeight, setViewportHeight] = useState("100vh")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const { user, login } = useAuth() // Use useAuth hook

  useEffect(() => {
    const checkAuth = () => {
      const authToken = localStorage.getItem("authToken")
      if (authToken && !user) {
        // If there's a token but no user data, load it
        const userData = JSON.parse(atob(authToken))
        login(userData)
        dispatch({ type: "LOAD_USER_DATA", payload: userData })
      }
    }
    checkAuth()
    window.addEventListener("storage", checkAuth)
    return () => window.removeEventListener("storage", checkAuth)
  }, [dispatch, user, login]) // Updated dependencies

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
    console.log("Authentication state changed:", user) // Log user from useAuth
  }, [user])

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false)
  }, [])

  const handleAuthentication = useCallback(
    (userData?: any, token?: string) => {
      console.log("Handling authentication, userData:", userData)
      if (token) {
        localStorage.setItem("authToken", token)
      }
      if (userData) {
        console.log("Logging in user")
        login(userData)
        dispatch({ type: "SET_USER", payload: userData })
      }
    },
    [dispatch, login],
  )

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

  return (
    <ErrorBoundary fallback={<ErrorDisplay message="An unexpected error occurred. Please try again." />}>
      <Suspense fallback={<LoadingScreen />}>
        {!user ? ( // Condition changed to check for user from useAuth
          <AuthenticationWindow onAuthenticate={handleAuthentication} />
        ) : (
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
                      snot={gameState.inventory.snot}
                      snotCoins={gameState.inventory.snotCoins}
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
        )}
      </Suspense>
    </ErrorBoundary>
  )
}

export default function HomeContentWrapper() {
  return (
    <GameProvider>
      <TranslationProvider>
        <ErrorBoundary fallback={<ErrorDisplay message="An unexpected error occurred. Please try again." />}>
          <Suspense fallback={<LoadingScreen />}>
            <HomeContent />
          </Suspense>
        </ErrorBoundary>
      </TranslationProvider>
    </GameProvider>
  )
}

