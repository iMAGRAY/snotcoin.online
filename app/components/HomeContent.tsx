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
import { authService } from '../services/auth/authService'
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
const checkAuth = (
  dispatch: React.Dispatch<Action>, 
  isAuthenticated: boolean
) => {
  const authToken = authService.getToken()
  
  if (!isAuthenticated || !authToken) {
    // Не аутентифицирован
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
    authService.logout()
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
const ensureGameHasUniqueId = (
  dispatchFn?: React.Dispatch<Action>
): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    // Проверяем, есть ли уже ID игры
    let gameId = localStorage.getItem('game_id');
    let userId = localStorage.getItem('user_id');
    
    // Если ID отсутствуют или невалидны, создаем новый
    if (!gameId || gameId === 'undefined' || gameId === 'null' || gameId.trim() === '') {
      // Создаем уникальный ID игры
      gameId = `anonymous_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('game_id', gameId);
      console.log(`[HomeContent] Создан новый анонимный ID игры: ${gameId}`);
    }
    
    // Проверяем userId отдельно, чтобы обеспечить согласованность
    if (!userId || userId === 'undefined' || userId === 'null' || userId.trim() === '') {
      // Используем существующий gameId для user_id, чтобы синхронизировать их
      localStorage.setItem('user_id', gameId);
      console.log(`[HomeContent] user_id синхронизирован с game_id: ${gameId}`);
    } else if (userId !== gameId) {
      // Если они разные, логируем, но не меняем, это может быть номальной ситуацией при авторизации
      console.log(`[HomeContent] ID рассинхронизированы: game_id=${gameId}, user_id=${userId}`);
    }
    
    // Если функция dispatch передана и у нас есть действующий gameId, обновляем состояние игры
    // только если текущий userId в состоянии не совпадает с gameId из localStorage
    if (dispatchFn && gameId) {
      // Используем sessionStorage как флаг, чтобы избежать повторных диспатчей
      const syncPerformed = sessionStorage.getItem('id_sync_performed');
      if (!syncPerformed) {
        dispatchFn({
          type: "SET_USER",
          payload: { userId: gameId }
        });
        sessionStorage.setItem('id_sync_performed', 'true');
      }
    }
    
    // Проверяем, есть ли уже локальная резервная копия для userId
    try {
      // Создаем простое минимальное состояние для резервной копии
      // если у нас еще нет резервной копии
      const hasBackup = localStorage.getItem(`backup_${userId || gameId}_latest`);
      if (!hasBackup) {
        console.log(`[HomeContent] Создание начальной резервной копии для ${userId || gameId}`);
        
        const emptyState = {
          _userId: userId || gameId,
          _lastSaved: new Date().toISOString(),
          inventory: {
            snot: 0,
            snotCoins: 0,
            containerCapacity: 100,
            containerSnot: 0,
            fillingSpeed: 1,
            containerCapacityLevel: 1,
            fillingSpeedLevel: 1
          }
        };
        
        // Сохраняем минимальную резервную копию
        const backupKey = `backup_${userId || gameId}_${Date.now()}`;
        localStorage.setItem(backupKey, JSON.stringify({
          gameState: emptyState,
          timestamp: Date.now(),
          version: 1
        }));
        
        // Устанавливаем маркер последней копии
        localStorage.setItem(`backup_${userId || gameId}_latest`, backupKey);
      }
    } catch (backupError) {
      console.error('[HomeContent] Ошибка при создании начальной резервной копии:', backupError);
    }
    
    // Возвращаем используемый ID
    return gameId;
  } catch (error) {
    console.error("[HomeContent] Ошибка при создании ID игры:", error);
    
    // В случае ошибки обращения к localStorage попытаемся создать ID в памяти
    try {
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      console.log(`[HomeContent] Создан временный ID в памяти: ${tempId}`);
      // Не пытаемся сохранить в localStorage, так как это может привести к повторному исключению
      return tempId;
    } catch (fallbackError) {
      console.error('[HomeContent] Критическая ошибка при создании ID:', fallbackError);
      return null;
    }
  }
};

const HomeContent: React.FC = () => {
  const dispatch = useGameDispatch();
  const gameState = useGameState();
  const [viewportHeight, setViewportHeight] = React.useState("100vh");
  const { user: farcasterUser, isAuthenticated: isFarcasterAuth } = useFarcaster();
  
  // Refs для отслеживания состояния
  const idCreatedRef = useRef(false);
  const hasSyncedRef = useRef(false);
  
  // При инициализации компонента убеждаемся, что у игры есть уникальный ID
  useEffect(() => {
    if (!idCreatedRef.current) {
      ensureGameHasUniqueId(dispatch);
      idCreatedRef.current = true;
    }
  }, [dispatch]);
  
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
    return checkAuth(dispatch, isFarcasterAuth);
  }, [dispatch, isFarcasterAuth]);

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
      authService.logout();
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
    
    // Проверяем, что SDK доступно
    const hasSDK = typeof window !== 'undefined' && 
                  window.farcaster && 
                  typeof window.farcaster.ready === 'function';
                  
    if (!hasSDK) {
      console.warn('[HomeContent] Farcaster SDK недоступно, но получены данные пользователя');
    }
    
    // Устанавливаем данные пользователя
    dispatch({ 
      type: "SET_USER", 
      payload: {
        id: farcasterUser.id,
        name: farcasterUser.displayName || farcasterUser.username || 'Unknown',
        avatar: farcasterUser.avatar || '',
        fid: farcasterUser.fid,
        username: farcasterUser.username || '',
        email: '',
        auth_provider: 'farcaster',
        auth_id: farcasterUser.fid?.toString() || '',
        verified: true,
        // Добавляем время создания для отслеживания сессии
        created_at: new Date().toISOString(),
        // Дополнительная информация для логирования
        device_info: navigator?.userAgent || '',
        login_source: hasSDK ? 'sdk' : 'frame',
      }
    });
    
    // Отмечаем, что авторизация произведена
    localDispatch({ type: 'SET_DISPATCHED_LOGIN', payload: true });
    localDispatch({ type: 'SET_AUTHENTICATED', payload: true });
    
    // Сохраняем информацию о пользователе в localStorage, чтобы при обновлении страницы не терялась сессия
    if (typeof localStorage !== 'undefined') {
      try {
        // Создаем безопасный объект с данными пользователя для хранения
        const safeUserData = {
          id: farcasterUser.id,
          name: farcasterUser.displayName || farcasterUser.username || 'Unknown',
          avatar: farcasterUser.avatar || '',
          fid: farcasterUser.fid,
          username: farcasterUser.username || '',
          auth_provider: 'farcaster',
          created_at: new Date().toISOString(),
        };
        
        // Сохраняем данные через authService
        authService.saveUserData(safeUserData);
        authService.setAuthenticated(true);
        
        // Уведомляем другие вкладки об изменении статуса авторизации
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'isAuthenticated',
          newValue: 'true'
        }));
      } catch (error) {
        console.error('Ошибка сохранения данных пользователя Farcaster:', error);
      }
    }
    
    console.log('[HomeContent] Farcaster авторизация успешна');
  }, [farcasterUser, isFarcasterAuth, dispatch, localState.hasDispatchedLogin]);

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

  // Эффект для синхронизации userId в игровом состоянии
  useEffect(() => {
    const syncUserId = () => {
      // Если синхронизация уже выполнена, выходим
      if (hasSyncedRef.current) return;

      // Проверяем наличие userId в localStorage
      const storedUserId = localStorage.getItem('user_id') || localStorage.getItem('game_id');
      
      // Получаем userId из состояния игры
      const gameUserId = gameState._userId;
      
      // Если есть расхождение, обновляем состояние игры
      if (storedUserId && (!gameUserId || gameUserId !== storedUserId)) {
        console.log(`[HomeContent] Синхронизация ID: localStorage="${storedUserId}", gameState="${gameUserId || ''}"`);
        
        // Обновляем userId в состоянии игры напрямую через LOAD_GAME_STATE
        // вместо SET_USER для предотвращения циклов
        dispatch({
          type: "LOAD_GAME_STATE",
          payload: {
            ...gameState,
            _userId: storedUserId,
            // Сохраняем текущие данные пользователя
            user: gameState.user || null
          }
        });
        
        // Отмечаем, что синхронизация выполнена
        hasSyncedRef.current = true;
      } else {
        // Если ID уже совпадают, также отмечаем синхронизацию как выполненную
        hasSyncedRef.current = true;
      }
    };
    
    // Выполняем синхронизацию только один раз при монтировании или при изменении gameUserId
    syncUserId();
    
  }, [gameState, dispatch]);

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
    const isAuth = authService.isAuthenticated();
    if (isAuth) {
      const userData = authService.getCurrentUser();
      if (userData) {
        dispatch({ type: "SET_USER", payload: userData });
      }
    }
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

