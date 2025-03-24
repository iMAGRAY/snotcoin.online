"use client";

/**
 * Хук для работы с Telegram WebApp API
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { TelegramWebAppUser } from '../types/telegramAuth';

// Проверка на браузерное окружение
const isBrowser = typeof window !== 'undefined';

// Интерфейс результата работы хука
export interface TelegramWebAppResult {
  isLoading: boolean;
  isAvailable: boolean;
  initDataAvailable: boolean;
  userData: TelegramWebAppUser | null;
  initData: string | null;
  authDate: number | null;
  hash: string | null;
  error: string | null;
  loadWebAppScript: () => Promise<boolean>;
  closeWebApp: () => void;
  setBackgroundColor: (color: string) => void;
  deviceInfo: { platform: string; version: string };
}

// Дефолтный результат для серверного рендеринга
const defaultResult: TelegramWebAppResult = {
  isLoading: true,
  isAvailable: false,
  initDataAvailable: false,
  userData: null,
  initData: null,
  authDate: null,
  hash: null,
  error: null,
  loadWebAppScript: async () => false,
  closeWebApp: () => {},
  setBackgroundColor: () => {},
  deviceInfo: { platform: 'unknown', version: 'unknown' }
};

/**
 * Хук для работы с WebApp API Telegram
 */
export const useTelegramWebApp = (): TelegramWebAppResult => {
  // Если код выполняется на сервере, возвращаем дефолтные значения
  if (!isBrowser) {
    return defaultResult;
  }
  
  // Состояние загрузки
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Состояние доступности WebApp
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  
  // Доступность initData
  const [initDataAvailable, setInitDataAvailable] = useState<boolean>(false);
  
  // Данные пользователя
  const [userData, setUserData] = useState<TelegramWebAppUser | null>(null);
  
  // Данные инициализации
  const [initData, setInitData] = useState<string | null>(null);
  const [authDate, setAuthDate] = useState<number | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  
  // Состояние ошибки
  const [error, setError] = useState<string | null>(null);
  
  // Ссылка на скрипт для отслеживания его загрузки
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  
  // Флаг для отслеживания монтирования компонента
  const isMountedRef = useRef<boolean>(true);
  
  // Дополнительные данные
  const [deviceInfo, setDeviceInfo] = useState({ platform: 'unknown', version: 'unknown' });
  
  /**
   * Безопасное обновление состояния
   */
  const safeSetState = useCallback((setter: Function, value: any) => {
    if (isMountedRef.current) {
      setter(value);
    }
  }, []);
  
  /**
   * Загрузка скрипта WebApp
   */
  const loadWebAppScript = async (): Promise<boolean> => {
    if (!isBrowser || !isMountedRef.current) return false;
    
    // Если скрипт уже есть, не загружаем его повторно
    if (scriptRef.current || document.getElementById('telegram-webapp-script')) {
      return true;
    }
    
    // Создаем и добавляем скрипт
    try {
      const script = document.createElement('script');
      script.id = 'telegram-webapp-script';
      script.src = 'https://telegram.org/js/telegram-web-app.js';
      script.async = true;
      document.head.appendChild(script);
      
      // Ждем загрузки скрипта с таймаутом
      const result = await Promise.race([
        new Promise<boolean>(resolve => {
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
        }),
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), 5000))
      ]);
      
      if (isMountedRef.current) {
        scriptRef.current = script;
      }
      return result;
    } catch (e) {
      if (isMountedRef.current) {
        setError(`Ошибка загрузки скрипта: ${e instanceof Error ? e.message : String(e)}`);
      }
      return false;
    }
  };
  
  /**
   * Закрытие WebApp
   */
  const closeWebApp = useCallback(() => {
    if (!isBrowser) return;
    
    // Проверяем наличие метода close
    const webApp = window.Telegram?.WebApp;
    try {
      if (webApp) {
        (webApp as any).close?.();
      }
    } catch (error) {
      console.error("Ошибка при закрытии WebApp:", error);
    }
  }, []);
  
  /**
   * Получение данных инициализации при первом рендере
   */
  useEffect(() => {
    if (!isBrowser) return;
    
    isMountedRef.current = true;
    
    const checkTelegramWebApp = () => {
      if (!isMountedRef.current) return;
      
      try {
        // Проверяем наличие Telegram WebApp
        const webAppAvailable = !!window.Telegram && !!window.Telegram.WebApp;
        safeSetState(setIsAvailable, webAppAvailable);
        
        if (webAppAvailable) {
          // Используем бесспорное утверждение, так как мы проверили, что оба не null/undefined
          const webApp = window.Telegram!.WebApp;
          
          // Проверяем что webApp определен перед доступом к свойствам
          if (webApp) {
            // Получаем данные WebApp
            const initDataStr = webApp.initData;
            safeSetState(setInitData, initDataStr);
            
            // Извлекаем пользователя из данных
            const initDataUnsafe = (webApp as any).initDataUnsafe || {};
            
            if (initDataUnsafe.user) {
              safeSetState(setUserData, initDataUnsafe.user);
            }
            
            // Проверка даты авторизации
            if (initDataUnsafe.auth_date) {
              safeSetState(setAuthDate, initDataUnsafe.auth_date);
            }
            
            // Проверка хеша
            if (initDataUnsafe.hash) {
              safeSetState(setHash, initDataUnsafe.hash);
            }
            
            // Отмечаем что WebApp готов
            safeSetState(setInitDataAvailable, !!initDataStr);
            
            // Подготавливаем данные об устройстве
            safeSetState(setDeviceInfo, {
              platform: (webApp as any).platform || 'unknown',
              version: (webApp as any).version || 'unknown'
            });
            
            console.log('[Telegram WebApp] Инициализирован успешно', {
              initDataAvailable: !!initDataStr,
              userDataAvailable: !!initDataUnsafe.user,
              platform: (webApp as any).platform
            });
          } else {
            console.warn('[Telegram WebApp] WebApp объект получен, но undefined');
            safeSetState(setError, 'WebApp объект получен, но undefined');
          }
        } else {
          console.warn('[Telegram WebApp] API не найден в window.Telegram.WebApp');
        }
      } catch (error) {
        console.error('[Telegram WebApp] Ошибка при получении данных:', error);
        safeSetState(setError, 'Не удалось получить данные WebApp: ' + String(error));
      } finally {
        if (isMountedRef.current) {
          safeSetState(setIsLoading, false);
        }
      }
    };
    
    // Проверяем немедленно и затем повторяем через 500мс
    // для случаев, когда скрипт Telegram WebApp может загрузиться после нашего хука
    checkTelegramWebApp();
    
    const retryTimeout = setTimeout(() => {
      if (isMountedRef.current && !isAvailable) {
        checkTelegramWebApp();
      }
    }, 500);
    
    return () => {
      isMountedRef.current = false;
      clearTimeout(retryTimeout);
    };
  }, [safeSetState, isAvailable]);
  
  // Функция для проверки полной загрузки WebApp
  const checkWebAppReady = useCallback(() => {
    if (!isBrowser) return false;
    
    const webApp = window.Telegram?.WebApp;
    if (!webApp) {
      console.warn("Telegram WebApp API не найдено");
      return false;
    }
    
    // Подготавливаем данные об устройстве
    safeSetState(setDeviceInfo, {
      platform: (webApp as any).platform || 'unknown',
      version: (webApp as any).version || 'unknown'
    });
    
    return true;
  }, [safeSetState]);
  
  // Функция для измения цвета WebApp
  const setBackgroundColor = useCallback((color: string) => {
    if (!isBrowser) return;
    
    const webApp = window.Telegram?.WebApp;
    if (webApp) {
      try {
        (webApp as any).setBackgroundColor?.(color);
      } catch (error) {
        console.error("Ошибка при установке цвета:", error);
      }
    }
  }, []);
  
  // Возвращаем состояние и функции
  return {
    isLoading,
    isAvailable,
    initDataAvailable,
    userData,
    initData,
    authDate,
    hash,
    error,
    loadWebAppScript,
    closeWebApp,
    setBackgroundColor,
    deviceInfo
  };
}; 