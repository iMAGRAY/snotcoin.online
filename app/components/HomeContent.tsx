"use client"

import React, { useRef, useEffect, useCallback, useMemo, Suspense } from "react"
import { AnimatePresence } from "framer-motion"
import dynamic from "next/dynamic"
import { GameProvider, useGameState, useGameDispatch } from "../contexts/GameContext"
import { TranslationProvider } from "../contexts/TranslationContext"
import type { Action } from "../types/gameTypes"
import { useFarcaster } from "../contexts/FarcasterContext"
const LoadingScreen = dynamic(() => import("./LoadingScreen"), {
  ssr: false,
})
import { ErrorBoundary, ErrorDisplay } from "./ErrorBoundary"
import AuthenticationWindow from "./auth/AuthenticationWindow"
import { authStore } from './auth/AuthenticationWindow'

// Dynamically import components that use browser APIs
const Laboratory = dynamic(() => import("./game/laboratory/laboratory"), {
  ssr: false,
  loading: () => <LoadingScreen progress={25} statusMessage="Loading Laboratory..." />,
})

const Storage = dynamic(() => import("./game/storage/Storage"), {
  ssr: false,
  loading: () => <LoadingScreen progress={25} statusMessage="Loading Storage..." />,
})

const TabBar = dynamic(() => import("./TabBar/TabBar"), {
  ssr: false,
  loading: () => <LoadingScreen progress={25} statusMessage="Loading Navigation..." />,
})

const ProfilePage = dynamic(() => import("./game/profile/ProfilePage"), {
  ssr: false,
  loading: () => <LoadingScreen progress={25} statusMessage="Loading Profile..." />,
})

const Resources = dynamic(() => import("./common/Resources"), {
  ssr: false,
  loading: () => <LoadingScreen progress={25} statusMessage="Loading Resources..." />,
})

const Quests = dynamic(() => import("./game/quests/Quests"), {
  ssr: false,
  loading: () => <LoadingScreen progress={25} statusMessage="Loading Quests..." />,
})

const checkAuth = (dispatch: React.Dispatch<Action>) => {
  const isAuth = authStore.getIsAuthenticated()
  const authToken = authStore.getAuthToken()

  if (!isAuth || !authToken) {
    dispatch({ type: "SET_USER", payload: null })
    return false
  }

  try {
    // Проверяем, можно ли парсить токен как JSON
    if (typeof authToken === 'string' && authToken.startsWith('{')) {
      const userData = JSON.parse(authToken);
      dispatch({ type: "SET_USER", payload: userData });
      return true;
    } 
    // Если токен уже объект или не является валидным JSON
    else {
      // Если токен уже объект, используем его напрямую
      if (typeof authToken === 'object' && authToken !== null) {
        dispatch({ type: "SET_USER", payload: authToken });
        return true;
      }
      // Строка, но не JSON - используем как есть
      return true;
    }
  } catch (error) {
    // Ошибка парсинга токена
    authStore.clearAuthData();
    dispatch({ type: "SET_USER", payload: null });
    return false;
  }
}

const HomeContent: React.FC = () => {
  const dispatch = useGameDispatch()
  const gameState = useGameState()
  const [viewportHeight, setViewportHeight] = React.useState("100vh")
  const [isAuthenticated, setIsAuthenticated] = React.useState(false)
  const { user: farcasterUser, isAuthenticated: isFarcasterAuth } = useFarcaster();
  
  // Создаем ref на уровне компонента, а не внутри эффекта
  const hasDispatchedLoginRef = useRef(false);
  // Переносим sessionCheckErrorCountRef на уровень компонента
  const sessionCheckErrorCountRef = useRef(0);
  // Добавляем ref для отслеживания состояния проверки сессии
  const isCheckingSessionRef = useRef(false);

  // Также добавляем состояние для загрузки данных пользователя
  const [isUserDataLoading, setIsUserDataLoading] = React.useState(false)

  const memoizedCheckAuth = useCallback(() => {
    const prevAuthState = isAuthenticated;
    const authResult = checkAuth(dispatch)
    
    // Обновляем состояние, только если оно изменилось
    if (prevAuthState !== authResult) {
      setIsAuthenticated(authResult)
    }
  }, [dispatch, isAuthenticated])

  // Проверка auth состояния при монтировании и изменениях localStorage
  useEffect(() => {
    // Флаг для отслеживания первого вызова
    let isFirstRun = true;
    
    // Выполняем начальную проверку авторизации
    if (isFirstRun) {
      memoizedCheckAuth();
      isFirstRun = false;
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "isAuthenticated" || e.key === "authToken") {
        memoizedCheckAuth()
      }
    }

    const handleLogout = () => {
      memoizedCheckAuth()
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("logout", handleLogout)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("logout", handleLogout)
    }
  }, [memoizedCheckAuth])

  // Обновляем авторизацию с Farcaster, когда пользователь меняется
  useEffect(() => {
    if (farcasterUser && isFarcasterAuth) {
      dispatch({ type: "SET_USER", payload: {
        id: farcasterUser.id,
        farcaster_fid: farcasterUser.fid,
        username: farcasterUser.username,
        displayName: farcasterUser.displayName
      }});
      setIsAuthenticated(true);
      
      if (!hasDispatchedLoginRef.current) {
        dispatch({ type: "SET_HIDE_INTERFACE", payload: false });
        dispatch({ type: "LOGIN" });
        
        if (gameState.activeTab !== "laboratory") {
          dispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" });
        }
        
        // Устанавливаем состояние загрузки данных
        setIsUserDataLoading(true);
        
        hasDispatchedLoginRef.current = true;
        
        const timer = setTimeout(() => {
          // Снимаем состояние загрузки данных
          setIsUserDataLoading(false);
          
          if (gameState.activeTab !== "laboratory" || gameState.hideInterface) {
            dispatch({ type: "SET_HIDE_INTERFACE", payload: false });
            dispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" });
          }
        }, 3000);
        
        return () => clearTimeout(timer);
      }
    } else {
      if (isAuthenticated) {
        setIsAuthenticated(false);
        dispatch({ type: "SET_USER", payload: null });
      }
    }
    
    // Проверяем, нужно ли сбросить состояние
    if (gameState.hideInterface) {
      dispatch({ type: "SET_HIDE_INTERFACE", payload: false });
      
      // Если вкладка не laboratory, устанавливаем ее
      if (gameState.activeTab !== "laboratory") {
        dispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" });
      }
    }
  }, [isFarcasterAuth, farcasterUser, dispatch, gameState.hideInterface, gameState.activeTab, isAuthenticated]);

  // Фиксим мобильный viewport
  useEffect(() => {
    const fixViewportHeight = () => {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty("--vh", `${vh}px`)
      setViewportHeight(`${window.innerHeight}px`)
    }

    fixViewportHeight()
    window.addEventListener("resize", fixViewportHeight)
    return () => window.removeEventListener("resize", fixViewportHeight)
  }, [])

  const renderActiveTab = () => {
    if (isUserDataLoading || !isAuthenticated) {
      return (
        <LoadingScreen
          progress={isUserDataLoading ? 75 : 0}
          statusMessage={isUserDataLoading ? "Загрузка данных..." : "Инициализация..."}
        />
      )
    }

    switch (gameState.activeTab) {
      case "laboratory":
        return <Laboratory />
      case "storage":
        return <Storage />
      case "profile":
        return <ProfilePage />
      case "quests":
        return <Quests />
      default:
        return <Laboratory />
    }
  }

  // Функция для обработки аутентификации
  const handleAuthentication = (userData: any) => {
    // Обработка успешной аутентификации
    console.log('Authenticated:', userData);
  };

  return (
    <div
      className="game-container flex flex-col h-screen bg-gradient-to-b from-gray-900 to-gray-800"
      style={{ height: viewportHeight }}
    >
      {!isAuthenticated ? (
        <AnimatePresence mode="wait">
          <AuthenticationWindow key="auth" onAuthenticate={handleAuthentication} />
        </AnimatePresence>
      ) : (
        <>
          {!gameState.hideInterface && (
            <header className="flex justify-between items-center p-2 bg-gray-800 shadow-md">
              <Resources 
                isVisible={true} 
                activeTab={gameState.activeTab} 
                snot={0} 
                snotCoins={0} 
              />
            </header>
          )}

          <main className="flex-grow overflow-hidden relative">
            <ErrorBoundary fallback={<ErrorDisplay message="Произошла непредвиденная ошибка в игре. Попробуйте перезагрузить страницу." />}>
              {renderActiveTab()}
            </ErrorBoundary>
          </main>

          {!gameState.hideInterface && <TabBar />}
        </>
      )}
    </div>
  )
}

export default function HomeContentWrapper() {
  // Wrap the component in error boundary
  return (
    <ErrorBoundary fallback={<ErrorDisplay message="Не удалось загрузить игру. Пожалуйста, перезагрузите страницу." />}>
      <Suspense fallback={<LoadingScreen progress={10} statusMessage="Загрузка игры..." />}>
        <HomeContent />
      </Suspense>
    </ErrorBoundary>
  )
}

