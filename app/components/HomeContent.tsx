"use client"

import React, { useRef, useEffect, useCallback, useMemo, Suspense, useState, useReducer } from "react"
import { AnimatePresence } from "framer-motion"
import dynamic from "next/dynamic"
import { useGameState, useGameDispatch } from "../contexts"
import type { Action } from "../types/gameTypes"
import { useFarcaster } from "../contexts/FarcasterContext"
import { MotionDiv } from "./motion/MotionWrapper"
const LoadingScreen = dynamic(() => import("./LoadingScreen"), {
  ssr: false,
})
import { ErrorBoundary, ErrorDisplay } from "./ErrorBoundary"
import AuthenticationWindow from "./auth/AuthenticationWindow"
import { authStore } from './auth/AuthenticationWindow'
import DevTools from './DevTools'

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

// Типы для локального редьюсера состояния
type AuthState = {
  isAuthenticated: boolean;
  isUserDataLoading: boolean;
  hasProcessedFrameParams: boolean;
  hasProcessedFarcasterFrame: boolean;
  hasDispatchedLogin: boolean;
};

type AuthAction = 
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'SET_USER_DATA_LOADING'; payload: boolean }
  | { type: 'SET_PROCESSED_FRAME_PARAMS'; payload: boolean }
  | { type: 'SET_PROCESSED_FARCASTER_FRAME'; payload: boolean } 
  | { type: 'SET_DISPATCHED_LOGIN'; payload: boolean };

// Функция для проверки авторизации
const checkAuth = (dispatch: React.Dispatch<Action>) => {
  const isAuth = authStore.getIsAuthenticated()
  const authToken = authStore.getAuthToken()

  if (!isAuth || !authToken) {
    dispatch({ type: "SET_USER", payload: null })
    
    // Даже если нет авторизации, убедимся, что у игры есть уникальный ID
    ensureGameHasUniqueId();
    
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
    
    // Даже при ошибке, гарантируем наличие ID
    ensureGameHasUniqueId();
    
    return false;
  }
}

// Редьюсер для локального состояния
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };
    case 'SET_USER_DATA_LOADING':
      return { ...state, isUserDataLoading: action.payload };
    case 'SET_PROCESSED_FRAME_PARAMS':
      return { ...state, hasProcessedFrameParams: action.payload };
    case 'SET_PROCESSED_FARCASTER_FRAME':
      return { ...state, hasProcessedFarcasterFrame: action.payload };
    case 'SET_DISPATCHED_LOGIN':
      return { ...state, hasDispatchedLogin: action.payload };
    default:
      return state;
  }
};

// Функция для создания и сохранения уникального ID игры
const ensureGameHasUniqueId = () => {
  if (typeof window === 'undefined') return;
  
  try {
    // Проверяем, есть ли уже ID игры
    let gameId = localStorage.getItem('game_id');
    
    if (!gameId) {
      // Создаем уникальный ID игры
      gameId = `anonymous_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('game_id', gameId);
      localStorage.setItem('user_id', gameId); // Дублируем для совместимости
      console.log(`[HomeContent] Создан новый анонимный ID игры: ${gameId}`);
    }
  } catch (error) {
    console.error("[HomeContent] Ошибка при создании ID игры:", error);
  }
};

const HomeContent: React.FC = () => {
  const dispatch = useGameDispatch();
  const gameState = useGameState();
  const [viewportHeight, setViewportHeight] = React.useState("100vh");
  const { user: farcasterUser, isAuthenticated: isFarcasterAuth } = useFarcaster();
  
  // При инициализации компонента убеждаемся, что у игры есть уникальный ID
  useEffect(() => {
    ensureGameHasUniqueId();
  }, []);
  
  // Ref для безопасного отслеживания предыдущего состояния авторизации
  const prevAuthValueRef = useRef<boolean | null>(null);
  
  // Используем useReducer вместо множественных useState
  const [localState, localDispatch] = useReducer(authReducer, {
    isAuthenticated: false,
    isUserDataLoading: false,
    hasProcessedFrameParams: false,
    hasProcessedFarcasterFrame: false,
    hasDispatchedLogin: false
  });
  
  // Мемоизированная функция проверки авторизации
  const checkAuthentication = useCallback(() => {
    return checkAuth(dispatch);
  }, [dispatch]);

  // Выносим функцию updateAuthState на верхний уровень компонента
  const updateAuthState = useCallback((newAuthState: boolean) => {
    // Используем ref для отслеживания предыдущего значения
    // чтобы избежать сравнения с localState, которое может вызвать цикл обновлений
    if (prevAuthValueRef.current !== newAuthState) {
      prevAuthValueRef.current = newAuthState;
      localDispatch({ type: 'SET_AUTHENTICATED', payload: newAuthState });
    }
  }, []);

  // Эффект для обработки авторизации
  useEffect(() => {
    let isMounted = true;
    
    // Функция для проверки авторизации
    const performAuthCheck = async () => {
      try {
        if (!isMounted) return;
        
        const isAuthValid = await checkAuthentication();
        updateAuthState(isAuthValid);
      } catch (error) {
        console.error("Auth check error:", error);
      }
    };
    
    // Только первоначальная проверка при монтировании
    if (prevAuthValueRef.current === null) {
      performAuthCheck();
    }
    
    // Обработчики событий
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "isAuthenticated" || e.key === "authToken") {
        performAuthCheck();
      }
    };
    
    const handleLogout = () => {
      performAuthCheck();
    };
    
    // Обработчик для истекшего токена
    const handleTokenExpired = () => {
      console.log("[HomeContent] Получено событие истечения токена, переаутентификация...");
      localDispatch({ type: 'SET_AUTHENTICATED', payload: false });
      authStore.clearAuthData(); // Очищаем устаревшие данные аутентификации
      performAuthCheck();
    };
    
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("logout", handleLogout);
    window.addEventListener("auth-token-expired", handleTokenExpired);
    
    // Проверка каждые 5 секунд
    const intervalId = setInterval(performAuthCheck, 5000);
    
    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("logout", handleLogout);
      window.removeEventListener("auth-token-expired", handleTokenExpired);
    };
  }, [checkAuthentication, updateAuthState]);

  // Эффект для обработки авторизации через Farcaster
  useEffect(() => {
    if (!farcasterUser || !isFarcasterAuth || localState.hasDispatchedLogin) {
      return;
    }
    
    // Устанавливаем данные пользователя
    dispatch({ 
      type: "SET_USER", 
      payload: {
        id: farcasterUser.id,
        farcaster_fid: farcasterUser.fid,
        username: farcasterUser.username,
        displayName: farcasterUser.displayName
      }
    });
    
    // Обновляем локальное состояние используя общую функцию updateAuthState
    updateAuthState(true);
    localDispatch({ type: 'SET_USER_DATA_LOADING', payload: true });
    localDispatch({ type: 'SET_DISPATCHED_LOGIN', payload: true });
    
    // Показываем интерфейс
    dispatch({ type: "SET_HIDE_INTERFACE", payload: false });
  }, [farcasterUser, isFarcasterAuth, dispatch, updateAuthState]);

  // Фиксим мобильный viewport
  useEffect(() => {
    const fixViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
      setViewportHeight(`${window.innerHeight}px`);
    };

    fixViewportHeight();
    window.addEventListener("resize", fixViewportHeight);
    return () => window.removeEventListener("resize", fixViewportHeight);
  }, []);

  // Эффект для обработки параметров Farcaster фрейма
  useEffect(() => {
    if (localState.hasProcessedFarcasterFrame) {
      return;
    }
    
    if (typeof window !== 'undefined') {
      const isFarcasterFrame = window.location.href.includes('?fc=1') || 
                            window.location.href.includes('&fc=1') || 
                            (window.parent !== window);
      
      if (isFarcasterFrame) {
        localDispatch({ type: 'SET_PROCESSED_FARCASTER_FRAME', payload: true });
        
        // Для фреймов автоматически показываем интерфейс с лабораторией
        dispatch({ type: "SET_HIDE_INTERFACE", payload: false });
        dispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" });
      }
    }
  }, [dispatch]);

  // Эффект для обработки параметров URL
  useEffect(() => {
    if (localState.hasProcessedFrameParams) {
      return;
    }
    
    try {
      const url = window.location.href;
      if (url.includes('fid=') && (url.includes('trusted=') || url.includes('buttonIndex='))) {
        localDispatch({ type: 'SET_PROCESSED_FRAME_PARAMS', payload: true });
        
        // Устанавливаем нужные значения
        dispatch({ type: "SET_HIDE_INTERFACE", payload: false });
        dispatch({ type: "SET_ACTIVE_TAB", payload: "profile" });
      }
    } catch (error) {
      console.error("Error handling frame parameters:", error);
    }
  }, [dispatch]);

  // Функция рендеринга активной вкладки
  const renderActiveTab = () => {
    if (localState.isUserDataLoading || !localState.isAuthenticated) {
      return (
        <LoadingScreen
          progress={localState.isUserDataLoading ? 75 : 0}
          statusMessage={localState.isUserDataLoading ? "Загрузка данных..." : "Инициализация..."}
        />
      );
    }

    switch (gameState.activeTab) {
      case "laboratory":
        return <Laboratory />;
      case "storage":
        return <Storage />;
      case "profile":
        return <ProfilePage />;
      case "quests":
        return <Quests />;
      default:
        return <Laboratory />;
    }
  };

  // Функция для обработки аутентификации
  const handleAuthentication = () => {
    // Просто триггерим проверку авторизации
    checkAuthentication();
  };

  // Функция рендеринга содержимого при аутентификации
  const renderAuthenticatedContent = () => {
    return (
      <>
        {!gameState.hideInterface && (
          <header className="flex justify-between items-center p-2 bg-gray-800 shadow-md z-10">
            <Resources 
              isVisible={true} 
              activeTab={gameState.activeTab || "laboratory"} 
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
  };

  return (
    <div
      className="game-container flex flex-col h-screen bg-gradient-to-b from-gray-900 to-gray-800"
      style={{ height: viewportHeight }}
    >
      <AnimatePresence mode="wait">
        {!localState.isAuthenticated ? (
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
  );
};

export default function HomeContentWrapper() {
  return (
    <ErrorBoundary fallback={<ErrorDisplay message="Не удалось загрузить игру. Пожалуйста, перезагрузите страницу." />}>
      <Suspense fallback={<LoadingScreen progress={10} statusMessage="Загрузка игры..." />}>
        <HomeContent />
        {/* Добавляем компонент DevTools в режиме разработки */}
        {process.env.NODE_ENV !== 'production' && <DevTools />}
      </Suspense>
    </ErrorBoundary>
  );
}

