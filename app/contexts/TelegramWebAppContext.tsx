"use client"

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { TelegramWebApp } from '../types/telegram';
import type { TelegramWebAppUser } from '../types/telegramAuth';

// Проверка на браузерное окружение
const isBrowser = typeof window !== 'undefined';

interface WebAppContextType {
  isReady: boolean;
  isLoading: boolean;
  initData: string | null;
  userData: TelegramWebAppUser | null;
  authDate: number | null;
  hash: string | null;
  error: string | null;
}

const initialState: WebAppContextType = {
  isReady: false,
  isLoading: true,
  initData: null,
  userData: null,
  authDate: null,
  hash: null,
  error: null
};

const TelegramWebAppContext = createContext<WebAppContextType>(initialState);

export const TelegramWebAppProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  // Проверка на серверную часть
  if (!isBrowser) {
    return <>{children}</>;
  }
  
  const [state, setState] = useState<WebAppContextType>(initialState);
  // Ref для отслеживания монтирования компонента
  const isMountedRef = useRef(true);
  // Ref для отслеживания попыток инициализации
  const initAttemptedRef = useRef(false);
  // Ref для отслеживания таймера инициализации
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Безопасная функция обновления состояния
  const safeSetState = useCallback((newState: Partial<WebAppContextType>) => {
    if (isMountedRef.current) {
      setState(prev => ({ ...prev, ...newState }));
    }
  }, []);
  
  // Инициализация Telegram WebApp API
  const initializeTelegramWebApp = useCallback(() => {
    // Проверяем, что мы в браузере
    if (!isBrowser) return;
    
    // Отмечаем, что попытка инициализации была предпринята
    initAttemptedRef.current = true;
    
    try {
      console.log('[TelegramWebAppContext] Инициализация Telegram WebApp API');
      
      if (!isMountedRef.current) return;
      
      // Проверяем наличие Telegram API
      if (typeof window.Telegram !== 'undefined' && window.Telegram?.WebApp) {
        // Приводим к корректному типу
        const webApp = window.Telegram.WebApp as TelegramWebApp;
        
        // Сообщаем Telegram что приложение загружено
        webApp.ready();
        webApp.expand();
        
        // Получаем данные WebApp
        const initDataStr = webApp.initData;
        
        // Извлекаем пользователя из данных
        const initDataUnsafe = (webApp as any).initDataUnsafe || {};
        const userData = initDataUnsafe.user || null;
        const authDate = initDataUnsafe.auth_date || null;
        const hash = initDataUnsafe.hash || null;
        
        console.log('[TelegramWebAppContext] Инициализация успешна', {
          initDataAvailable: !!initDataStr,
          userDataAvailable: !!userData
        });
        
        safeSetState({
          isReady: true,
          isLoading: false,
          initData: initDataStr,
          userData,
          authDate,
          hash,
          error: null
        });
      } else {
        console.log('[TelegramWebAppContext] API не найден в window.Telegram.WebApp, возможно не в Telegram');
        
        // Если мы не в Telegram, просто отмечаем, что API не доступен
        safeSetState({
          isLoading: false,
          error: 'Telegram WebApp API недоступен (возможно вы не в Telegram)'
        });
      }
    } catch (error) {
      console.error('[TelegramWebAppContext] Ошибка при инициализации:', error);
      safeSetState({
        isLoading: false,
        error: `Ошибка при инициализации: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }, [safeSetState]);
  
  useEffect(() => {
    // Запускаем инициализацию только на клиенте
    if (!isBrowser) return;
    
    // Предотвращаем повторную инициализацию
    if (initAttemptedRef.current) return;
    
    // Отложенная инициализация для стабильности
    initTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !initAttemptedRef.current) {
        initializeTelegramWebApp();
      }
    }, 100);
    
    // Функция очистки при размонтировании
    return () => {
      isMountedRef.current = false;
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
    };
  }, [initializeTelegramWebApp]);
  
  return (
    <TelegramWebAppContext.Provider value={state}>
      {children}
    </TelegramWebAppContext.Provider>
  );
};

// Версия с проверкой браузерного окружения
export const useTelegramWebAppContext = () => {
  // Возвращаем начальное состояние для серверного рендера
  if (!isBrowser) {
    return initialState;
  }
  
  return useContext(TelegramWebAppContext);
}; 