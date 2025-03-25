"use client"

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { TelegramWebApp } from '../types/telegram';
import type { TelegramWebAppUser } from '../types/telegramAuth';

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
  const [state, setState] = useState<WebAppContextType>(initialState);
  // Ref для отслеживания монтирования компонента
  const isMountedRef = useRef(true);
  
  // Безопасная функция обновления состояния
  const safeSetState = useCallback((newState: Partial<WebAppContextType>) => {
    if (isMountedRef.current) {
      setState(prev => ({ ...prev, ...newState }));
    }
  }, []);
  
  // Инициализация Telegram WebApp API
  const initializeTelegramWebApp = useCallback(() => {
    try {
      console.log('[TelegramWebAppContext] Инициализация Telegram WebApp API');
      
      if (!isMountedRef.current) return;
      
      if (window.Telegram?.WebApp) {
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
        console.warn('[TelegramWebAppContext] API не найден в window.Telegram.WebApp');
        
        if (!isMountedRef.current) return;
        
        // Если API не доступен, пробуем загрузить скрипт
        const script = document.createElement('script');
        script.id = 'telegram-webapp-script';
        script.src = 'https://telegram.org/js/telegram-web-app.js';
        script.async = true;
        
        script.onload = () => {
          console.log('[TelegramWebAppContext] Скрипт WebApp загружен, повторная инициализация');
          
          // Даем время на инициализацию
          if (isMountedRef.current) {
            setTimeout(() => {
              if (isMountedRef.current) {
                initializeTelegramWebApp();
              }
            }, 500);
          }
        };
        
        script.onerror = () => {
          console.error('[TelegramWebAppContext] Не удалось загрузить скрипт WebApp');
          safeSetState({
            isLoading: false,
            error: 'Не удалось загрузить Telegram WebApp API'
          });
        };
        
        document.head.appendChild(script);
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
    // Запускаем инициализацию
    initializeTelegramWebApp();
    
    // Повторяем проверку через 1 секунду если API все еще не доступен
    const retryTimeout = setTimeout(() => {
      if (isMountedRef.current && !state.isReady && !state.error) {
        console.log('[TelegramWebAppContext] Повторная попытка инициализации');
        initializeTelegramWebApp();
      }
    }, 1000);
    
    // Функция очистки при размонтировании
    return () => {
      isMountedRef.current = false;
      clearTimeout(retryTimeout);
    };
  }, [state.isReady, state.error, initializeTelegramWebApp]);
  
  return (
    <TelegramWebAppContext.Provider value={state}>
      {children}
    </TelegramWebAppContext.Provider>
  );
};

export const useTelegramWebAppContext = () => useContext(TelegramWebAppContext); 