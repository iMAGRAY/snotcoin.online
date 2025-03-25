"use client"

import React, { useRef, useEffect, useCallback, useMemo, Suspense, useState } from "react"
import { AnimatePresence } from "framer-motion"
import dynamic from "next/dynamic"
import { GameProvider, useGameState, useGameDispatch } from "../contexts/GameContext"
import { TranslationProvider } from "../contexts/TranslationContext"
import type { Action } from "../types/gameTypes"
const LoadingScreen = dynamic(() => import("./LoadingScreen"), {
  ssr: false,
})
import { ErrorBoundary, ErrorDisplay } from "./ErrorBoundary"
import { AuthenticationWindow } from "./auth/AuthenticationWindow"
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

// Проверка авторизации пользователя
const checkAuth = (dispatch: React.Dispatch<Action>, urlParams?: URLSearchParams) => {
  // Проверяем параметры URL для Farcaster Frames (fid и username)
  if (urlParams && urlParams.has('fid') && urlParams.get('fid')) {
    const fid = parseInt(urlParams.get('fid') || '0', 10);
    const username = urlParams.get('username') || `user_${fid}`;
    const embed = urlParams.has('embed');
    
    if (fid > 0) {
      // Создаем пользователя на основе параметров URL (для фреймов)
      const frameUser = {
        id: `farcaster_${fid}`,
        fid: fid,
        username: username,
        displayName: username,
        pfp: null,
        address: null
      };
      
      // Сохраняем данные авторизации в хранилище
      authStore.setAuth(frameUser);
      authStore.setAuthToken(JSON.stringify(frameUser));
      
      // Устанавливаем пользователя в состояние
      dispatch({ type: "SET_USER", payload: frameUser });
      
      // Если передан параметр embed, скрываем интерфейс авторизации
      if (embed) {
        dispatch({ type: "SET_GAME_STARTED", payload: true });
      }
      
      return true;
    }
  }
  
  // Стандартная проверка авторизации через хранилище
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
  const [viewportHeight, setViewportHeight] = useState("100vh")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isFrameEmbed, setIsFrameEmbed] = useState(false)
  
  // Создаем ref на уровне компонента, а не внутри эффекта
  const hasDispatchedLoginRef = useRef(false);
  // Переносим sessionCheckErrorCountRef на уровень компонента
  const sessionCheckErrorCountRef = useRef(0);
  // Добавляем ref для отслеживания состояния проверки сессии
  const isCheckingSessionRef = useRef(false);
  
  // Проверяем параметры URL для интеграции с фреймами Farcaster
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      
      // Проверяем параметр embed - если true, то мы внутри фрейма
      const embed = params.has('embed') && params.get('embed') === 'true';
      setIsFrameEmbed(embed);
      
      // Выполняем проверку авторизации с учетом параметров URL
      const authResult = checkAuth(dispatch, params);
      setIsAuthenticated(authResult);
    }
  }, [dispatch]);
  
  // Обработка высоты viewport при монтировании
  useEffect(() => {
    const updateViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      setViewportHeight(`${window.innerHeight}px`);
    };
    
    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    
    return () => {
      window.removeEventListener('resize', updateViewportHeight);
    };
  }, []);

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

  // Используем один эффект для обработки аутентификации и всех связанных действий
  useEffect(() => {
    // Предотвращаем выполнение, если проверка аутентификации не завершена
    if (!isAuthenticated || !gameState.user?.fid) {
      return;
    }
    
    // Если пользователь аутентифицирован впервые
    if (!hasDispatchedLoginRef.current) {
      // Сбрасываем связанные флаги
      dispatch({ type: "SET_HIDE_INTERFACE", payload: false });
      
      dispatch({ type: "LOGIN" });
      
      // Устанавливаем laboratory как активную вкладку (если не установлено)
      if (gameState.activeTab !== "laboratory") {
        dispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" });
      }
      
      // Инициируем загрузку данных пользователя
      dispatch({ type: "LOAD_USER_DATA", payload: { isLoading: true } });
      
      hasDispatchedLoginRef.current = true;
      
      // Завершаем загрузку через 3 секунды
      const timer = setTimeout(() => {
        dispatch({ type: "LOAD_USER_DATA", payload: { isLoading: false } });
        
        // Дополнительная защита для гарантии правильного состояния
        if (gameState.activeTab !== "laboratory" || gameState.hideInterface) {
          dispatch({ type: "SET_HIDE_INTERFACE", payload: false });
          dispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" });
        }
      }, 3000);
      
      return () => clearTimeout(timer);
    }
    
    // Проверяем, нужно ли сбросить состояние
    if (gameState.hideInterface) {
      dispatch({ type: "SET_HIDE_INTERFACE", payload: false });
      
      // Если вкладка не laboratory, устанавливаем ее
      if (gameState.activeTab !== "laboratory") {
        dispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" });
      }
    }
  }, [isAuthenticated, gameState.user?.fid, dispatch, gameState.hideInterface, gameState.activeTab]);

  // Подписываемся на событие истечения сессии и проверяем актуальность авторизации
  useEffect(() => {
    if (!isAuthenticated || !gameState.user?.fid) {
      return; // Не проверяем сессию, если пользователь не аутентифицирован
    }
    
    // Обработчик истечения сессии
    const handleSessionExpired = () => {
      // Предотвращаем ререндер, если уже выполняется выход
      if (!isAuthenticated) return;
      
      authStore.clearAuthData();
      setIsAuthenticated(false);
      dispatch({ type: "SET_USER", payload: null });
    };
    
    // Проверка статуса сессии
    const checkSession = async () => {
      // Предотвращаем одновременные проверки
      if (isCheckingSessionRef.current || !isAuthenticated || !gameState.user?.fid) {
        return;
      }
      
      isCheckingSessionRef.current = true;
      
      try {
        // Получаем токен авторизации
        const authToken = authStore.getAuthToken();
        if (!authToken) {
          handleSessionExpired();
          isCheckingSessionRef.current = false;
          return;
        }
        
        // Подготавливаем токен для заголовка
        const token = typeof authToken === 'string' ? authToken : JSON.stringify(authToken);
        
        // Проверяем статус авторизации через API
        const response = await fetch('/api/auth/check-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            fid: gameState.user.fid
          })
        });
        
        if (!response.ok) {
          handleSessionExpired();
          sessionCheckErrorCountRef.current = 0; // Сбрасываем счетчик ошибок
        } else {
          // Сбрасываем счетчик ошибок при успешном запросе
          sessionCheckErrorCountRef.current = 0;
        }
      } catch (error) {
        // Учитываем количество неудачных попыток подключения
        sessionCheckErrorCountRef.current += 1;
        
        // Если ошибки сети продолжаются слишком долго, выполняем logout
        if (sessionCheckErrorCountRef.current > 3) {
          handleSessionExpired();
          sessionCheckErrorCountRef.current = 0;
        }
      } finally {
        isCheckingSessionRef.current = false;
      }
    };
    
    window.addEventListener('session_expired', handleSessionExpired);
    
    // Выполняем первую проверку с задержкой
    const initialCheckTimeout = setTimeout(() => {
      checkSession();
    }, 10000); // Задержка в 10 секунд перед первой проверкой
    
    // Настраиваем периодическую проверку сессии
    const sessionCheckInterval = setInterval(checkSession, 5 * 60 * 1000);
    
    return () => {
      window.removeEventListener('session_expired', handleSessionExpired);
      clearTimeout(initialCheckTimeout);
      clearInterval(sessionCheckInterval);
    };
  }, [isAuthenticated, gameState.user, dispatch]);

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
    authStore.clearAuthData();
    
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

