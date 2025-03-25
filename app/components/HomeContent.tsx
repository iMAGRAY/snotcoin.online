"use client"

import React, { useRef, useEffect, useCallback, useMemo, Suspense } from "react"
import { AnimatePresence } from "framer-motion"
import dynamic from "next/dynamic"
import { GameProvider, useGameState, useGameDispatch } from "../contexts/GameContext"
import { TranslationProvider } from "../contexts/TranslationContext"
import type { Action } from "../types/gameTypes"
import { useFarcaster } from "../contexts/FarcasterContext"
import { MotionDiv } from "./motion/MotionWrapper"
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
    // Предотвращаем повторные обновления, если они не нужны
    if (isCheckingSessionRef.current) return;
    
    // Маркируем, что мы выполняем проверку сессии
    isCheckingSessionRef.current = true;
    
    try {
      if (farcasterUser && isFarcasterAuth) {
        // Проверяем, не выполнили ли мы уже логин
        if (!hasDispatchedLoginRef.current) {
          // Устанавливаем данные пользователя
          dispatch({ type: "SET_USER", payload: {
            id: farcasterUser.id,
            farcaster_fid: farcasterUser.fid,
            username: farcasterUser.username,
            displayName: farcasterUser.displayName
          }});
          
          // Обновляем состояние аутентификации перед любыми другими обновлениями UI
          if (!isAuthenticated) {
            setIsAuthenticated(true);
          }
          
          // Устанавливаем флаг загрузки данных ПЕРЕД обновлением интерфейса
          // чтобы избежать мерцания
          setIsUserDataLoading(true);
          
          // Показываем интерфейс и обновляем состояние игры
          dispatch({ type: "SET_HIDE_INTERFACE", payload: false });
          dispatch({ type: "LOGIN" });
          
          // Устанавливаем laboratory как активную вкладку, если она не активна
          if (gameState.activeTab !== "laboratory") {
            dispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" });
          }
          
          // Отмечаем, что уже выполнили логин
          hasDispatchedLoginRef.current = true;
          
          // Устанавливаем таймер для завершения загрузки данных
          const timer = setTimeout(() => {
            // Снимаем состояние загрузки данных
            setIsUserDataLoading(false);
          }, 1000); // Сокращаем время для лучшего пользовательского опыта
          
          return () => clearTimeout(timer);
        }
      } else if (isAuthenticated && !isFarcasterAuth) {
        // Если пользователь был аутентифицирован, но потерял авторизацию Farcaster
        setIsAuthenticated(false);
        dispatch({ type: "SET_USER", payload: null });
        hasDispatchedLoginRef.current = false;
      }
    } finally {
      // Сбрасываем флаг проверки сессии
      isCheckingSessionRef.current = false;
    }
  }, [isFarcasterAuth, farcasterUser, dispatch]);

  // Отдельный эффект для обработки изменения состояния интерфейса
  useEffect(() => {
    // Если интерфейс скрыт, показываем его
    if (gameState.hideInterface && isAuthenticated) {
      dispatch({ type: "SET_HIDE_INTERFACE", payload: false });
      
      // Если вкладка не laboratory, устанавливаем ее
      if (gameState.activeTab !== "laboratory") {
        dispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" });
      }
    }
  }, [gameState.hideInterface, gameState.activeTab, isAuthenticated, dispatch]);

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
  };

  // Функция рендеринга содержимого при аутентификации
  const renderAuthenticatedContent = () => {
    return (
      <>
        {!gameState.hideInterface && (
          <header className="flex justify-between items-center p-2 bg-gray-800 shadow-md z-10">
            <Resources 
              isVisible={true} 
              activeTab={gameState.activeTab} 
              snot={gameState.inventory?.snot || 0} 
              snotCoins={gameState.inventory?.snotCoins || 0}
              containerCapacity={gameState.inventory?.containerCapacity}
              containerLevel={gameState.inventory?.containerCapacityLevel}
              containerSnot={gameState.inventory?.containerSnot}
              containerFillingSpeed={gameState.inventory?.fillingSpeed}
              fillingSpeedLevel={gameState.inventory?.fillingSpeedLevel}
            />
          </header>
        )}

        <main className="flex-grow overflow-hidden relative" style={{ paddingBottom: 'var(--tab-bar-height, 4rem)' }}>
          <ErrorBoundary fallback={<ErrorDisplay message="Произошла непредвиденная ошибка в игре. Попробуйте перезагрузить страницу." />}>
            {renderActiveTab()}
          </ErrorBoundary>
        </main>

        {!gameState.hideInterface && <TabBar />}
      </>
    );
  }

  return (
    <div
      className="game-container flex flex-col h-screen bg-gradient-to-b from-gray-900 to-gray-800"
      style={{ height: viewportHeight }}
    >
      <AnimatePresence mode="wait">
        {!isAuthenticated ? (
          <AuthenticationWindow key="auth" onAuthenticate={handleAuthentication} />
        ) : (
          <MotionDiv
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col h-full w-full"
          >
            {renderAuthenticatedContent()}
          </MotionDiv>
        )}
      </AnimatePresence>
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

