"use client";

/**
 * Хук для работы с аутентификацией через Telegram
 */

import { useState, useCallback } from 'react';
import { useGameDispatch } from '../contexts/GameContext';
import { TelegramUser, AuthStatus } from '../types/telegramAuth';
import { AuthLogType, AuthStep, logAuth, logAuthError, logAuthInfo } from '../utils/auth-logger';

// Используем localStorage вместо импорта из AuthenticationWindow 
const localAuthStore = {
  setAuthData(token: any, isAuth: boolean) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('authToken', typeof token === 'string' ? token : JSON.stringify(token));
    localStorage.setItem('isAuthenticated', isAuth ? 'true' : 'false');
  },
  clearAuthData() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('authToken');
    localStorage.removeItem('isAuthenticated');
  }
};

/**
 * Результат работы хука аутентификации
 */
interface TelegramAuthHookResult {
  user: TelegramUser | null;
  status: AuthStatus;
  isLoading: boolean;
  handleAuth: () => Promise<boolean>;
  handleRetry: () => Promise<boolean>;
  closeWebApp: () => void;
  openInTelegram: () => void;
  errorMessage: string | null;
}

/**
 * Упрощенный хук для работы с аутентификацией 
 */
export const useTelegramAuth = (
  onAuthenticate: (userData: TelegramUser) => void
): TelegramAuthHookResult => {
  const [status, setStatus] = useState<AuthStatus>(AuthStatus.INIT);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const dispatch = useGameDispatch();
  
  /**
   * Обработка успешной аутентификации
   */
  const handleAuthSuccess = useCallback((userData: TelegramUser) => {
    setUser(userData);
    setStatus(AuthStatus.SUCCESS);
    setErrorMessage(null);
    
    // Сохраняем в localStorage
    localAuthStore.setAuthData(userData, true);
    
    // Обновляем состояние игры
    dispatch({ type: "SET_USER", payload: userData });
    
    // Вызываем callback
    onAuthenticate(userData);
    
    return true;
  }, [dispatch, onAuthenticate]);
  
  /**
   * Обработка ошибки аутентификации
   */
  const handleAuthError = useCallback((error: string) => {
    setStatus(AuthStatus.ERROR);
    setErrorMessage(error);
    return false;
  }, []);
  
  /**
   * Основная функция аутентификации
   */
  const handleAuth = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      logAuthInfo(AuthStep.INIT, 'Начало процесса аутентификации');
      
      // В нашем упрощенном случае сразу создаем дефолтного пользователя
      const defaultUser: TelegramUser = {
        id: String(Date.now()),
        telegram_id: Date.now(),
        first_name: "Telegram",
        last_name: "User",
        username: `user_${Date.now().toString(36)}`,
        photo_url: "https://telegram.org/img/t_logo.png"
      };
      
      // Логируем успешную аутентификацию
      logAuth(
        AuthStep.AUTH_COMPLETE,
        AuthLogType.INFO,
        'Успешная аутентификация с дефолтным пользователем',
        { userId: defaultUser.id }
      );
      
      return handleAuthSuccess(defaultUser);
    } catch (error) {
      // Логируем ошибку
      logAuthError(
        AuthStep.AUTH_ERROR,
        'Ошибка при аутентификации',
        error instanceof Error ? error : new Error(String(error))
      );
      
      return handleAuthError('Произошла ошибка при аутентификации. Пожалуйста, попробуйте снова.');
    } finally {
      setIsLoading(false);
    }
  }, [handleAuthSuccess, handleAuthError]);
  
  /**
   * Функция для повторной попытки аутентификации
   */
  const handleRetry = useCallback(async (): Promise<boolean> => {
    return handleAuth();
  }, [handleAuth]);
  
  /**
   * Функция для закрытия WebApp
   */
  const closeWebApp = useCallback(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      window.Telegram.WebApp.close();
    }
  }, []);
  
  /**
   * Функция для открытия в Telegram
   */
  const openInTelegram = useCallback(() => {
    const botUrl = 'https://t.me/SnotCoinBot';
    window.open(botUrl, '_blank');
  }, []);
  
  return {
    user,
    status,
    isLoading,
    handleAuth,
    handleRetry,
    closeWebApp,
    openInTelegram,
    errorMessage
  };
}; 