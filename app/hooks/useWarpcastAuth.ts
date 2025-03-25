"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { useGameDispatch } from '../contexts/GameContext';
import { AuthStatus, AuthStep, AuthState, WarpcastUser } from '../types/warpcastAuth';
import { logAuthError, logAuthInfo } from '../utils/auth-logger';

// Проверка на браузерное окружение
const isBrowser = typeof window !== 'undefined';

interface WarpcastAuthHookResult {
  user: WarpcastUser | null;
  status: AuthStatus;
  isLoading: boolean;
  handleAuth: () => Promise<boolean>;
  handleRetry: () => void;
  isAuthenticated: boolean;
  authToken: string | null;
  errorMessage: string | null;
  login: () => void;
  logout: () => void;
}

// Дефолтное значение для возврата при SSR
const defaultAuthResult: WarpcastAuthHookResult = {
  user: null,
  status: AuthStatus.LOADING,
  isLoading: true,
  handleAuth: async () => false,
  handleRetry: () => {},
  isAuthenticated: false,
  authToken: null,
  errorMessage: null,
  login: () => {},
  logout: () => {},
};

export const useWarpcastAuth = (): WarpcastAuthHookResult => {
  // Если код выполняется на сервере, возвращаем дефолтное значение
  if (!isBrowser) {
    return defaultAuthResult;
  }

  const [state, setState] = useState<AuthState>({
    status: AuthStatus.LOADING,
    user: null,
    error: null
  });
  
  const dispatch = useGameDispatch();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authAttempts, setAuthAttempts] = useState<number>(0);
  
  // Ref для отслеживания монтирования компонента
  const isMountedRef = useRef<boolean>(true);
  
  /**
   * Безопасное обновление состояния
   */
  const safeSetState = useCallback((newState: Partial<AuthState>) => {
    if (isMountedRef.current) {
      setState(prev => ({ ...prev, ...newState }));
    }
  }, []);
  
  /**
   * Обработка успешной аутентификации
   */
  const handleAuthSuccess = useCallback((user: WarpcastUser) => {
    dispatch({ type: "SET_USER", payload: user });
    dispatch({ type: "SET_GAME_STARTED", payload: true });
    
    safeSetState({
      status: AuthStatus.SUCCESS,
      user,
      error: null
    });
    
    return true;
  }, [dispatch, safeSetState]);
  
  /**
   * Обработка ошибки аутентификации
   */
  const handleAuthError = useCallback((error: string, details?: string) => {
    safeSetState({
      status: AuthStatus.ERROR,
      error,
      errorDetails: details
    });
    
    return false;
  }, [safeSetState]);
  
  /**
   * Аутентификация через Warpcast
   */
  const authenticateWithWarpcast = async (): Promise<boolean> => {
    try {
      logAuthInfo(AuthStep.WARPCAST_INIT as AuthStep, 'Начало процесса аутентификации через Warpcast');
      
      // Проверяем наличие Farcaster Frame SDK
      if (typeof window === 'undefined' || !window.farcaster) {
        logAuthError(
          AuthStep.WARPCAST_INIT as AuthStep,
          'Farcaster Frame SDK не найден',
          new Error('Farcaster Frame SDK not found')
        );
        return handleAuthError('Farcaster Frame SDK не найден');
      }
      
      // Получаем контекст пользователя
      const contextData = await window.farcaster.getContext();
      
      if (!contextData || !contextData.fid) {
        logAuthError(
          AuthStep.WARPCAST_VERIFY as AuthStep,
          'Не удалось получить FID пользователя',
          new Error('Failed to get user FID')
        );
        return handleAuthError('Не удалось получить данные пользователя');
      }
      
      // Формируем данные пользователя
      const userData: WarpcastUser = {
        fid: contextData.fid,
        username: contextData.username || `user_${contextData.fid}`,
        displayName: contextData.displayName || null,
        pfp: contextData.pfp?.url || null,
        address: contextData.custody?.address || null
      };
      
      // Генерируем токен
      const token = `warpcast_${userData.fid}_${Date.now()}`;
      
      // Сохраняем токен
      localStorage.setItem('warpcast_token', token);
      setAuthToken(token);
      
      // Сохраняем данные пользователя
      localStorage.setItem('warpcast_user', JSON.stringify(userData));
      
      logAuthInfo(
        AuthStep.WARPCAST_SUCCESS as AuthStep,
        'Аутентификация через Warpcast успешна',
        userData
      );
      return handleAuthSuccess(userData);
      
    } catch (error) {
      logAuthError(
        AuthStep.WARPCAST_ERROR as AuthStep,
        'Ошибка при аутентификации через Warpcast',
        error as Error
      );
      return handleAuthError(
        `Ошибка при аутентификации: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
  
  /**
   * Повторная попытка аутентификации
   */
  const handleRetry = useCallback(() => {
    safeSetState({
      status: AuthStatus.LOADING,
      user: null,
      error: null
    });
    
    window.location.reload();
  }, [safeSetState]);
  
  /**
   * Вход в систему
   */
  const login = useCallback(async () => {
    try {
      const result = await authenticateWithWarpcast();
      if (result) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Ошибка при входе:', error);
      handleAuthError('Ошибка при входе в систему');
    }
  }, [authenticateWithWarpcast, handleAuthError]);
  
  /**
   * Выход из системы
   */
  const logout = useCallback(() => {
    localStorage.removeItem('warpcast_token');
    localStorage.removeItem('warpcast_user');
    safeSetState({
      status: AuthStatus.INIT,
      user: null,
      error: null
    });
    setAuthToken(null);
    setIsAuthenticated(false);
    
    dispatch({ type: "RESET_GAME_STATE" });
  }, [dispatch, safeSetState]);
  
  /**
   * Загрузка пользовательского профиля
   */
  const loadUser = useCallback(() => {
    try {
      const storedUser = localStorage.getItem('warpcast_user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        safeSetState({
          status: AuthStatus.SUCCESS,
          user,
          error: null
        });
        setIsAuthenticated(true);
        dispatch({ type: "SET_USER", payload: user });
      }
    } catch (error) {
      console.error('Ошибка при загрузке пользователя из localStorage:', error);
    }
  }, [dispatch, safeSetState]);
  
  // Эффект для инициализации
  useEffect(() => {
    isMountedRef.current = true;
    loadUser();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [loadUser]);
  
  /**
   * Выполнение автоматической аутентификации при загрузке
   */
  useEffect(() => {
    if (!isBrowser) return;
    
    let isMounted = true;
    
    const performAuth = async () => {
      try {
        if (isAuthenticated || authAttempts > 3) return;
        
        setAuthAttempts(prev => prev + 1);
        
        const savedToken = localStorage.getItem('warpcast_token');
        if (savedToken) {
          setAuthToken(savedToken);
        }
        
        await handleAuth();
      } catch (error) {
        console.error('Ошибка при автоматической аутентификации:', error);
      }
    };
    
    if (document.readyState === 'complete') {
      performAuth();
    } else {
      window.addEventListener('load', performAuth);
      return () => {
        window.removeEventListener('load', performAuth);
      };
    }
    
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, authAttempts]);
  
  /**
   * Аутентификация
   */
  const handleAuth = useCallback(async (): Promise<boolean> => {
    try {
      if (!isBrowser) return false;
      
      safeSetState({ status: AuthStatus.LOADING });
      
      return await authenticateWithWarpcast();
    } catch (error) {
      return handleAuthError(`Ошибка при аутентификации: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [authenticateWithWarpcast, handleAuthError, safeSetState]);
  
  return {
    user: state.user,
    status: state.status,
    isLoading: state.status === AuthStatus.LOADING,
    handleAuth: authenticateWithWarpcast,
    handleRetry,
    isAuthenticated,
    authToken,
    errorMessage: state.error || null,
    login,
    logout
  };
}; 