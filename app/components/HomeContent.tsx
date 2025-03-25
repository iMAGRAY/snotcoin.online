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
  // Добавляем ref для отслеживания установки laboratory как активной вкладки
  const hasSetLaboratoryTabRef = useRef(false);
  // Добавляем ref для отслеживания обработки скрытия интерфейса
  const hasProcessedHideInterfaceRef = useRef(false);

  // Также добавляем состояние для загрузки данных пользователя
  const [isUserDataLoading, setIsUserDataLoading] = React.useState(false)
  // Создаем ref для состояния авторизации, чтобы избежать зацикливания
  const authStateRef = useRef(false);

  const memoizedCheckAuth = useCallback(() => {
    // Если данные пользователя загружаются, пропускаем проверку авторизации
    if (isUserDataLoading) return;
    
    const prevAuthState = authStateRef.current;
    const authResult = checkAuth(dispatch)
    
    // Обновляем состояние, только если оно изменилось, и используем ref 
    // для отслеживания изменений во избежание циклов обновлений
    if (prevAuthState !== authResult) {
      authStateRef.current = authResult;
      // Используем setTimeout для отложенного обновления состояния
      // чтобы разорвать цикл обновлений
      setTimeout(() => {
        if (document.body) { // Проверяем, что компонент все еще монтирован
          setIsAuthenticated(authResult);
        }
      }, 50);
    }
  }, [dispatch, isUserDataLoading])

  // Проверка auth состояния при монтировании и изменениях localStorage
  useEffect(() => {
    // Однократная функция выполнения проверки авторизации
    const performAuthCheck = () => {
      // Удаляем проверку !authStateRef.current, чтобы избежать бесконечной рекурсии
      memoizedCheckAuth();
    };
    
    // Выполняем начальную проверку авторизации
    performAuthCheck();

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
  }, [memoizedCheckAuth]) // Сохраняем только memoizedCheckAuth в зависимостях

  // Обновляем авторизацию с Farcaster, когда пользователь меняется
  useEffect(() => {
    // Предотвращаем повторные обновления, если они не нужны
    if (isCheckingSessionRef.current) return;
    
    // Маркируем, что мы выполняем проверку сессии
    isCheckingSessionRef.current = true;
    
    // Однократная функция установки вкладки laboratory
    const setLaboratoryTab = () => {
      if (!hasSetLaboratoryTabRef.current) {
        hasSetLaboratoryTabRef.current = true;
        
        // Проверка на активную вкладку внутри функции для избежания зависимости
        if (gameState.activeTab !== "laboratory") {
          dispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" });
        }
      }
    };
    
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
          
          // Обновляем состояние авторизации перед любыми другими обновлениями UI
          // Используем ref и отложенное обновление состояния
          if (!authStateRef.current) {
            authStateRef.current = true;
            // Избегаем вызова setState здесь, чтобы предотвратить циклы обновлений
            // Используем аккуратно setTimeout с достаточной задержкой
            setTimeout(() => {
              if (document.body) { // Убедимся, что компонент все еще монтирован
                setIsAuthenticated(true);
              }
            }, 50);
          }
          
          // Устанавливаем флаг загрузки данных ПЕРЕД обновлением интерфейса
          // чтобы избежать мерцания
          setIsUserDataLoading(true);
          
          // Показываем интерфейс и обновляем состояние игры
          dispatch({ type: "SET_HIDE_INTERFACE", payload: false });
          
          // Отмечаем, что уже выполнили логин - перемещаем сюда, чтобы избежать race condition
          hasDispatchedLoginRef.current = true;
          
          // Используем setTimeout для предотвращения зацикливания обновлений
          setTimeout(() => {
            dispatch({ type: "LOGIN" });
            
            // Устанавливаем laboratory как активную вкладку в отдельном таймере
            setTimeout(setLaboratoryTab, 100);
          }, 100);
          
          // Устанавливаем таймер для завершения загрузки данных
          const timer = setTimeout(() => {
            // Снимаем состояние загрузки данных
            setIsUserDataLoading(false);
          }, 1000); // Сокращаем время для лучшего пользовательского опыта
          
          return () => clearTimeout(timer);
        }
      } else if (authStateRef.current && !isFarcasterAuth) {
        // Если пользователь был аутентифицирован, но потерял авторизацию Farcaster
        authStateRef.current = false;
        setTimeout(() => {
          if (document.body) { // Убедимся, что компонент все еще монтирован
            setIsAuthenticated(false);
          }
        }, 50);
        dispatch({ type: "SET_USER", payload: null });
        hasDispatchedLoginRef.current = false;
        // Сбрасываем флаг установки вкладки laboratory
        hasSetLaboratoryTabRef.current = false;
      }
    } finally {
      // Сбрасываем флаг проверки сессии с небольшой задержкой
      // чтобы избежать быстрых повторных вызовов
      setTimeout(() => {
        isCheckingSessionRef.current = false;
      }, 50);
    }
  }, [farcasterUser, isFarcasterAuth, dispatch]);

  // Отдельный эффект для обработки изменения состояния интерфейса
  useEffect(() => {
    // Предотвращаем обработку, если уже в процессе обновления
    if (isCheckingSessionRef.current) return;
    
    // Используем локальную переменную для отслеживания внесённых изменений
    let changesApplied = false;

    // Используем ссылку на состояние авторизации вместо проверки isAuthenticated
    const isUserAuthenticated = authStateRef.current;
    
    if (gameState.hideInterface && isUserAuthenticated && !hasProcessedHideInterfaceRef.current) {
      // Устанавливаем флаг, что обработали скрытие интерфейса
      hasProcessedHideInterfaceRef.current = true;
      changesApplied = true;
      
      // Если интерфейс скрыт, показываем его
      dispatch({ type: "SET_HIDE_INTERFACE", payload: false });
      
      // Если вкладка не laboratory, устанавливаем ее
      if (gameState.activeTab !== "laboratory") {
        setTimeout(() => {
          dispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" });
        }, 50);
      }
    } else if (!gameState.hideInterface) {
      // Сбрасываем флаг, если интерфейс не скрыт
      if (hasProcessedHideInterfaceRef.current) {
        hasProcessedHideInterfaceRef.current = false;
        changesApplied = true;
      }
    }
    
    // Если были внесены изменения, добавляем небольшую задержку
    // перед следующим возможным обновлением для предотвращения циклов
    if (changesApplied) {
      isCheckingSessionRef.current = true;
      setTimeout(() => {
        isCheckingSessionRef.current = false;
      }, 50);
    }
  }, [gameState.hideInterface, gameState.activeTab, dispatch]);

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
    // Используем актуальное значение из authStateRef для большей надежности
    const isUserAuthenticated = authStateRef.current;
    
    if (isUserDataLoading || !isUserAuthenticated) {
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
        {!authStateRef.current ? (
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

