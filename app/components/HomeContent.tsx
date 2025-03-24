"use client"

import React, { useRef, useEffect, useCallback, useMemo, Suspense } from "react"
import { AnimatePresence } from "framer-motion"
import dynamic from "next/dynamic"
import { GameProvider, useGameState, useGameDispatch } from "../contexts/GameContext"
import { TranslationProvider } from "../contexts/TranslationContext"
import type { Action } from "../types/gameTypes"
import type { TelegramWebApp } from "../types/telegram"
const LoadingScreen = dynamic(() => import("./LoadingScreen"), {
  ssr: false,
})
import { ErrorBoundary, ErrorDisplay } from "./ErrorBoundary"
import AuthenticationWindow from "./auth/AuthenticationWindow"

// Создаем простое хранилище аутентификации, чтобы не импортировать напрямую из компонента
const authStoreSimple = {
  getIsAuthenticated: () => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem("isAuthenticated") === "true";
  },
  getAuthToken: () => {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem("authToken");
    return token ? token : null;
  },
  clearAuthData: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("authToken");
  }
};

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

// Выносим функцию проверки аутентификации из компонента
const checkAuth = (dispatch: React.Dispatch<Action>) => {
  const isAuth = authStoreSimple.getIsAuthenticated()
  const authToken = authStoreSimple.getAuthToken()

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
    authStoreSimple.clearAuthData();
    dispatch({ type: "SET_USER", payload: null });
    return false;
  }
}

const HomeContent: React.FC = () => {
  const dispatch = useGameDispatch()
  const gameState = useGameState()
  const [viewportHeight, setViewportHeight] = React.useState("100vh")
  const [isAuthenticated, setIsAuthenticated] = React.useState(false)
  
  // Refs для отслеживания состояний
  const hasDispatchedLoginRef = useRef(false);
  const sessionCheckErrorCountRef = useRef(0);
  const isCheckingSessionRef = useRef(false);
  
  // Инициализируем Telegram WebApp API при монтировании компонента
  useEffect(() => {
    // Сигнализируем Telegram о готовности WebApp и расширяем его
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      console.log('[Telegram WebApp] Вызов метода ready() для инициализации WebApp');
      
      // Приводим к правильному типу
      const webApp = window.Telegram.WebApp as TelegramWebApp;
      
      // Сообщаем Telegram, что приложение загружено и готово к работе
      webApp.ready();
      
      // Расширяем приложение на весь экран
      webApp.expand();
      
      // Устанавливаем обработчик для сообщений от MainButton
      if (webApp.MainButton) {
        webApp.MainButton.onClick(() => {
          console.log('[Telegram WebApp] MainButton нажата');
        });
      }
    } else {
      console.warn('[Telegram WebApp] API не найден при инициализации. WebApp может работать некорректно.');
    }
  }, []);

  // Упрощаем memoizedCheckAuth, убирая зависимость от isAuthenticated
  const memoizedCheckAuth = useCallback(() => {
    const authResult = checkAuth(dispatch);
    setIsAuthenticated(authResult);
    return authResult;
  }, [dispatch]);

  // Проверка auth состояния при монтировании и изменениях localStorage
  useEffect(() => {
    // Проверяем и устанавливаем флаг, чтобы избежать дополнительных ререндеров
    if (!isCheckingSessionRef.current) {
      isCheckingSessionRef.current = true;
      
      // Выполняем начальную проверку авторизации
      const isAuth = memoizedCheckAuth();
      
      // Если пользователь авторизован, устанавливаем соответствующий флаг
      if (isAuth && !hasDispatchedLoginRef.current) {
        hasDispatchedLoginRef.current = true;
        dispatch({ type: "LOGIN" });
      }
      
      isCheckingSessionRef.current = false;
    }

    // Добавляем слушатель для событий localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "isAuthenticated" || e.key === "authToken") {
        memoizedCheckAuth();
      }
    };

    // Подписываемся на изменения localStorage
    window.addEventListener("storage", handleStorageChange);

    // Отписываемся при размонтировании
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [dispatch, memoizedCheckAuth]); // Явно указываем зависимости

  // Проверяем авторизацию каждые 5 минут
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!isCheckingSessionRef.current) {
        isCheckingSessionRef.current = true;
        
        try {
          memoizedCheckAuth();
        } catch (error) {
          console.error("Ошибка при проверке сессии:", error);
          sessionCheckErrorCountRef.current++;
          
          // Если произошло слишком много ошибок, останавливаем проверки
          if (sessionCheckErrorCountRef.current > 3) {
            clearInterval(intervalId);
          }
        } finally {
          isCheckingSessionRef.current = false;
        }
      }
    }, 5 * 60 * 1000); // 5 минут
    
    return () => clearInterval(intervalId);
  }, [memoizedCheckAuth]);

  const handleAuthentication = useCallback(
    (userData: any) => {
      // Сбрасываем связанные флаги
      dispatch({ type: "SET_HIDE_INTERFACE", payload: false });
      
      // Устанавливаем пользователя
      dispatch({ type: "SET_USER", payload: userData });
      
      // Явно устанавливаем laboratory как активную вкладку
      dispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" });
      
      // Меняем состояние аутентификации последним, чтобы эффекты сработали корректно
      setIsAuthenticated(true);
    },
    [dispatch],
  )

  const renderActivePage = useMemo(() => {
    // Если после аутентификации активная вкладка всё ещё не установлена,
    // используем Laboratory по умолчанию
    if (!gameState.activeTab && isAuthenticated) {
      // Устанавливаем активную вкладку, чтобы в следующий раз она была определена
      setTimeout(() => {
        dispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" });
      }, 0);
      return <Laboratory />;
    }
    
    // Обработка других вкладок
    switch (gameState.activeTab) {
      case "laboratory":
        return <Laboratory />
      case "storage":
        return <Storage />
      case "quests":
        return <Quests />
      case "profile":
        return <ProfilePage />
      default:
        // Если ни один из кейсов не сработал, используем Laboratory
        return <Laboratory />
    }
  }, [gameState.activeTab, isAuthenticated, dispatch])

  const handleLogout = useCallback(() => {
    // Очищаем данные авторизации в нашем хранилище
    authStoreSimple.clearAuthData();
    
    // Обновляем состояние аутентификации
    setIsAuthenticated(false);
    
    // Сбрасываем состояние в GameContext
    dispatch({ type: "SET_USER", payload: null });
    dispatch({ type: "RESET_GAME_STATE" });
    
    // Очищаем ref для повторной авторизации
    hasDispatchedLoginRef.current = false;
    
    // Уведомляем другие части приложения о выходе
    const logoutEvent = new Event('logout');
    window.dispatchEvent(logoutEvent);
  }, [dispatch]);

  if (!isAuthenticated) {
    return <AuthenticationWindow onAuthenticate={handleAuthentication} />
  }

  return (
    <ErrorBoundary fallback={<ErrorDisplay message="An unexpected error occurred. Please try again." />}>
      <main
        className="flex flex-col w-full overflow-hidden bg-gradient-to-b from-gray-900 to-black relative"
        style={{
          height: viewportHeight,
          maxHeight: viewportHeight,
          maxWidth: "100vw",
          margin: "0 auto",
          backgroundColor: "var(--tg-theme-bg-color, #1c1c1e)",
          color: "var(--tg-theme-text-color, #ffffff)",
        }}
      >
        {gameState.isLoading ? (
          <LoadingScreen progress={75} statusMessage="Initializing game..." />
        ) : (
          <div className="flex flex-col h-full">
            {gameState.activeTab !== "profile" && !gameState.hideInterface && (
              <Suspense fallback={<LoadingScreen progress={50} statusMessage="Loading resources..." />}>
                <Resources
                  isVisible={true}
                  activeTab={gameState.activeTab}
                  snot={gameState.inventory.snot}
                  snotCoins={gameState.inventory.snotCoins}
                />
              </Suspense>
            )}
            <div className="flex-grow relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900 opacity-50 z-10" />
              <div className="relative z-20 h-full overflow-y-auto">
                <AnimatePresence mode="wait">
                  <Suspense fallback={<LoadingScreen progress={75} statusMessage="Loading content..." />}>
                    <ErrorBoundary fallback={<ErrorDisplay message="Failed to load game content. Please try again." />}>
                      {renderActivePage}
                    </ErrorBoundary>
                  </Suspense>
                </AnimatePresence>
              </div>
            </div>
            {!gameState.hideInterface && (
              <Suspense fallback={<LoadingScreen progress={90} statusMessage="Loading navigation..." />}>
                <TabBar />
              </Suspense>
            )}
          </div>
        )}
      </main>
    </ErrorBoundary>
  )
}

export default function HomeContentWrapper() {
  return (
    <GameProvider>
      <TranslationProvider>
        <ErrorBoundary fallback={<ErrorDisplay message="An unexpected error occurred. Please try again." />}>
          <HomeContent />
        </ErrorBoundary>
      </TranslationProvider>
    </GameProvider>
  )
}

