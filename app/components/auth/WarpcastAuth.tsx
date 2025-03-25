'use client';

import React, { useState, useEffect, useRef } from 'react';
import { logAuthInfo, AuthStep } from '@/app/utils/auth-logger';
import { farcasterStore } from '../FarcasterFrameHandler';

// Объявляем интерфейс для Farcaster Context
interface FarcasterContext {
  fid: number;
  username: string;
  displayName: string;
  pfp?: {
    url: string;
    verified: boolean;
  };
  verified: boolean;
  custody?: {
    address: string;
    type: string;
  };
  verifications?: string[];
  domain?: string;
  url?: string;
}

// Добавляем типы для нестандартных объектов фреймов/мобильных приложений
interface FrameObject {
  isFrameLoaded?: () => boolean;
  [key: string]: any;
}

interface WarpcastAuthProps {
  onSuccess: (userData: any) => void;
  onError: (error: string) => void;
}

// Расширяем тип Window для поддержки мобильного объекта fc
declare global {
  interface Window {
    fc?: {
      isFrameLoaded?: () => boolean;
      [key: string]: any;
    };
    // Примечание: farcaster уже определен в farcaster.d.ts как FarcasterSDK
  }
}

export default function WarpcastAuth({ onSuccess, onError }: WarpcastAuthProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sdkCheckAttempts, setSdkCheckAttempts] = useState(0);
  const isAuthenticatedRef = useRef(false); // Используем ref для отслеживания состояния аутентификации
  
  // Безопасная функция обновления состояния загрузки
  const safeSetIsLoading = (value: boolean) => {
    // Обновляем только если значение изменилось
    setIsLoading(prev => {
      if (prev === value) return prev;
      return value;
    });
  };

  // Функция для проверки наличия SDK
  const checkFarcasterSDK = (): boolean => {
    // Если пользователь уже аутентифицирован, сразу возвращаем true
    if (isAuthenticatedRef.current || farcasterStore.isAuthenticated()) {
      isAuthenticatedRef.current = true;
      return true;
    }
    
    if (typeof window === 'undefined') {
      return false;
    }
    
    // Проверяем, доступен ли объект fc в мобильном приложении
    if (typeof (window as any).fc !== 'undefined') {
      const fc = (window as any).fc as FrameObject;
      return true;
    }
    
    // Проверяем, доступен ли объект farcaster в браузере
    if (!(window as any).farcaster) {
      return false;
    }
    
    const farcaster = (window as any).farcaster;
    
    // Проверяем наличие Frames SDK
    if (typeof farcaster.frame !== 'undefined') {
      return true;
    }
    
    // Проверяем, есть ли необходимые методы
    if (!farcaster.getContext) {
      return false;
    }
    
    return true;
  };

  // Функция для загрузки SDK скрипта
  const loadFarcasterSDK = () => {
    // Проверяем, не загружен ли скрипт уже
    if (document.getElementById('farcaster-sdk-script')) {
      return;
    }
    
    // Определяем, находимся ли мы в фрейме
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
    const isFrameMode = isInIframe || document.referrer.includes('warpcast.com');
    
    // Загружаем только официальный Warpcast SDK
    const script = document.createElement('script');
    script.src = 'https://warpcast.com/~/sdk.js';
    script.id = 'farcaster-sdk-script';
    script.async = true;
    script.onload = () => {
      // При загрузке скрипта попробуем сразу инициализировать SDK
      if (window.farcaster && typeof window.farcaster.ready === 'function') {
        try {
          window.farcaster.ready();
        } catch (error) {
          console.error('Ошибка при вызове farcaster.ready()', error);
        }
      }
    };
    script.onerror = () => console.error('Ошибка загрузки Farcaster SDK скрипта');
    document.body.appendChild(script);
  };

  // Функция инициализации авторизации
  const initWarpcastAuth = async () => {
    // Если мы не в состоянии загрузки, прерываем выполнение
    if (!isLoading) return;
    
    try {
      // Предотвращаем повторную инициализацию
      if (isAuthenticatedRef.current) {
        safeSetIsLoading(false);
        return;
      }
      
      // Проверяем, не авторизован ли пользователь уже
      if (farcasterStore.isSDKInitialized() && farcasterStore.isAuthenticated()) {
        isAuthenticatedRef.current = true;
        safeSetIsLoading(false);
        return;
      }

      logAuthInfo(AuthStep.INIT, 'Инициализация авторизации через Warpcast');
      
      // Проверяем, доступен ли SDK через FarcasterFrameHandler
      if (farcasterStore.isSDKInitialized()) {
        // Получаем контекст пользователя
        const userContext = await farcasterStore.getUserContext();
        
        if (userContext) {
          logAuthInfo(AuthStep.VALIDATE_DATA, 'Получены данные пользователя из farcasterStore', {
            fid: userContext.fid,
            username: userContext.username
          });
          
          // Отправляем данные на сервер для валидации и создания JWT
          const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
          const response = await fetch(`${baseUrl}/api/farcaster/auth`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fid: userContext.fid,
              username: userContext.username,
              displayName: userContext.displayName,
              pfp: userContext.pfp?.url,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            logAuthInfo(AuthStep.AUTH_ERROR, 'Ошибка при отправке данных на сервер', {
              status: response.status,
              statusText: response.statusText,
              error: errorText
            });
            throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}\n${errorText}`);
          }

          const data = await response.json();

          if (data.success && data.tokens) {
            // Сохраняем в localStorage для совместимости с dataService
            try {
              localStorage.setItem('auth_token', data.tokens.accessToken);
              console.log('[WarpcastAuth] Токен сохранен в localStorage для совместимости с dataService');
              
              // Важно! Сохраняем user_id, полученный с сервера, а не генерируем его на клиенте
              if (data.user && data.user.id) {
                localStorage.setItem('user_id', data.user.id);
                console.log(`[WarpcastAuth] ID пользователя ${data.user.id} сохранен в localStorage`);
              }
            } catch (storageError) {
              console.warn('[WarpcastAuth] Не удалось сохранить токен в localStorage:', storageError);
            }

            // Вызываем колбэк успешной авторизации
            if (data.user) {
              onSuccess(data.user);
            }

            logAuthInfo(AuthStep.AUTH_COMPLETE, 'Авторизация через Warpcast успешна');
            // Отмечаем в store, что пользователь уже аутентифицирован
            farcasterStore.setIsAuthenticated(true);
            isAuthenticatedRef.current = true;
            
            // Вызываем колбэк успеха перед обновлением состояния
            safeSetIsLoading(false);
            return;
          } else {
            logAuthInfo(AuthStep.AUTH_ERROR, 'Ошибка при обработке данных пользователя', { error: data.message });
            const errorMsg = data.message || 'Ошибка авторизации';
            safeSetIsLoading(false);
            // Сначала выключаем загрузку, затем устанавливаем ошибку
            setErrorMessage(errorMsg);
            onError(errorMsg);
            return;
          }
        } else {
          logAuthInfo(AuthStep.AUTH_ERROR, 'Не удалось получить контекст пользователя из farcasterStore');
        }
      } else {
        logAuthInfo(AuthStep.INIT, 'SDK не найден в farcasterStore, ждем инициализации');
      }
      
      // Если SDK еще не доступен, но попыток было мало, увеличиваем счетчик и ждем
      if (!checkFarcasterSDK()) {
        if (sdkCheckAttempts < 5) {
          // Увеличиваем счетчик попыток и пытаемся загрузить SDK
          setSdkCheckAttempts(prev => prev + 1);
          
          // При первой попытке загружаем SDK скрипт
          if (sdkCheckAttempts === 0 && typeof document !== 'undefined') {
            loadFarcasterSDK();
          }
          
          return;
        }
        
        // Если SDK все еще недоступен после нескольких попыток
        const errorMsg = 'Farcaster SDK не доступен. Убедитесь, что вы открыли страницу в Warpcast или включили Frame support.';
        safeSetIsLoading(false);
        // Сначала выключаем загрузку, затем устанавливаем ошибку
        setErrorMessage(errorMsg);
        return;
      }

      // Здесь мы уверены, что SDK доступен
      // Уведомляем Farcaster, что страница готова
      const farcaster = (window as any).farcaster;
      if (farcaster && typeof farcaster.ready === 'function') {
        farcaster.ready();
      }
      
      logAuthInfo(AuthStep.AUTH_START, 'Запрос пользовательских данных Farcaster');
      
      // Определяем, какой метод использовать для получения данных
      let userContext: FarcasterContext | null = null;
      
      // Пробуем разные методы для получения контекста пользователя
      if (farcaster.getContext) {
        userContext = await farcaster.getContext();
      } else if ((window as any).fc && (window as any).fc.getContext) {
        userContext = await (window as any).fc.getContext();
      } else {
        throw new Error('Не найден метод для получения данных пользователя');
      }
      
      logAuthInfo(AuthStep.VALIDATE_DATA, 'Получен ответ от Farcaster API', {
        hasUserContext: !!userContext,
        hasFid: userContext?.fid ? 'yes' : 'no',
        data: userContext
      });
      
      if (!userContext || !userContext.fid) {
        logAuthInfo(AuthStep.AUTH_ERROR, 'Не удалось получить данные пользователя Farcaster');
        const errorMsg = 'Не удалось получить данные пользователя. Пожалуйста, войдите в Warpcast.';
        safeSetIsLoading(false);
        // Сначала выключаем загрузку, затем устанавливаем ошибку
        setErrorMessage(errorMsg);
        onError(errorMsg);
        return;
      }
      
      logAuthInfo(AuthStep.VALIDATE_DATA, 'Получены данные пользователя Farcaster', {
        fid: userContext.fid,
        username: userContext.username
      });

      // Отправляем данные на сервер для валидации и создания JWT
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${baseUrl}/api/farcaster/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fid: userContext.fid,
          username: userContext.username,
          displayName: userContext.displayName,
          pfp: userContext.pfp?.url,
        }),
      });

      const data = await response.json();

      if (data.success && data.tokens) {
        // Сохраняем в localStorage для совместимости с dataService
        try {
          localStorage.setItem('auth_token', data.tokens.accessToken);
          console.log('[WarpcastAuth] Токен сохранен в localStorage для совместимости с dataService');
          
          // Важно! Сохраняем user_id, полученный с сервера, а не генерируем его на клиенте
          if (data.user && data.user.id) {
            localStorage.setItem('user_id', data.user.id);
            console.log(`[WarpcastAuth] ID пользователя ${data.user.id} сохранен в localStorage`);
          }
        } catch (storageError) {
          console.warn('[WarpcastAuth] Не удалось сохранить токен в localStorage:', storageError);
        }

        // Вызываем колбэк успешной авторизации
        if (data.user) {
          onSuccess(data.user);
        }

        logAuthInfo(AuthStep.AUTH_COMPLETE, 'Авторизация через Warpcast успешна');
        // Отмечаем в store, что пользователь уже аутентифицирован
        farcasterStore.setIsAuthenticated(true);
        isAuthenticatedRef.current = true;
        
        // Вызываем колбэк успеха перед обновлением состояния
        safeSetIsLoading(false);
      } else {
        logAuthInfo(AuthStep.AUTH_ERROR, 'Ошибка при обработке данных пользователя', { error: data.message });
        const errorMsg = data.message || 'Ошибка авторизации';
        safeSetIsLoading(false);
        // Сначала выключаем загрузку, затем устанавливаем ошибку
        setErrorMessage(errorMsg);
        onError(errorMsg);
      }
    } catch (error) {
      logAuthInfo(AuthStep.AUTH_ERROR, 'Неожиданная ошибка при авторизации через Warpcast', {
        error: error instanceof Error ? error.message : String(error)
      });
      const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      safeSetIsLoading(false);
      // Сначала выключаем загрузку, затем устанавливаем ошибку
      setErrorMessage(errorMsg);
      onError(errorMsg);
    }
  };

  // useEffect для настройки таймера опроса SDK только при монтировании
  useEffect(() => {
    // Проверяем, не аутентифицирован ли уже пользователь
    if (farcasterStore.isAuthenticated()) {
      isAuthenticatedRef.current = true;
      safeSetIsLoading(false);
      return () => {}; // Возвращаем пустую функцию очистки
    }
    
    let interval: NodeJS.Timeout | null = null;
    let retryCount = 0;
    const maxRetries = 10;
    
    // Функция для проверки доступности SDK
    const checkSDKAvailability = async () => {
      // Если пользователь уже аутентифицирован, прекращаем опрос
      if (isAuthenticatedRef.current || farcasterStore.isAuthenticated()) {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
        isAuthenticatedRef.current = true;
        safeSetIsLoading(false);
        return;
      }
      
      logAuthInfo(AuthStep.INIT, `Проверка SDK, попытка ${retryCount + 1}/${maxRetries}`);
      
      if (farcasterStore.isSDKInitialized()) {
        logAuthInfo(AuthStep.INIT, 'SDK доступен в farcasterStore, получение контекста');
        const userContext = await farcasterStore.getUserContext();
        
        if (userContext) {
          logAuthInfo(AuthStep.VALIDATE_DATA, 'Получен контекст пользователя', {
            fid: userContext.fid,
            username: userContext.username
          });
          
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
          
          // Вызываем initWarpcastAuth для завершения авторизации
          initWarpcastAuth();
          return;
        }
      }
      
      retryCount++;
      if (retryCount >= maxRetries) {
        logAuthInfo(AuthStep.AUTH_ERROR, `Превышено максимальное количество попыток получения SDK (${maxRetries})`);
        
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
        
        // Если SDK не удалось получить, пытаемся загрузить его самостоятельно
        if (sdkCheckAttempts === 0) {
          logAuthInfo(AuthStep.INIT, 'Попытка загрузить SDK самостоятельно');
          loadFarcasterSDK();
          setSdkCheckAttempts(1);
        }
      }
    };
    
    // Запускаем проверку доступности SDK сразу
    checkSDKAvailability();
    
    // Запускаем интервал проверки SDK только если пользователь еще не аутентифицирован
    interval = setInterval(checkSDKAvailability, 1000);
    
    // Очищаем интервал при размонтировании компонента
    return () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
  }, []); // Пустой массив зависимостей, чтобы эффект выполнился только при монтировании

  // useEffect для реакции на изменение sdkCheckAttempts
  useEffect(() => {
    // Пропускаем первый рендер (sdkCheckAttempts = 0)
    if (sdkCheckAttempts === 0) return;
    
    // Если пользователь уже аутентифицирован, останавливаем процесс
    if (isAuthenticatedRef.current || farcasterStore.isAuthenticated()) {
      isAuthenticatedRef.current = true;
      safeSetIsLoading(false);
      return;
    }
    
    // Запускаем инициализацию только при изменении sdkCheckAttempts > 0
    initWarpcastAuth();
  }, [sdkCheckAttempts]); // Не добавляем isLoading и другие состояния в зависимости

  // useEffect для проверки состояния аутентификации при изменении isLoading
  useEffect(() => {
    // Этот эффект запускается только в ответ на изменение isLoading
    // Проверяем Farcaster store при загрузке компонента
    if (farcasterStore.isAuthenticated()) {
      isAuthenticatedRef.current = true;
      
      // Если компонент все еще в состоянии загрузки, но пользователь уже аутентифицирован
      if (isLoading) {
        safeSetIsLoading(false);
      }
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-center mb-4">Авторизация через Warpcast</h2>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mb-4"></div>
          <p className="text-gray-700">
            Выполняется авторизация через Warpcast...
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Попытка: {sdkCheckAttempts + 1}/6
          </p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-center mb-4">Ошибка авторизации</h2>
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4 w-full text-center">
          <p className="font-bold">Не удалось подключиться к Warpcast</p>
          <p>{errorMessage}</p>
          
          <div className="mt-2 text-xs text-gray-700">
            <p>SDK проверок: {sdkCheckAttempts}</p>
            <p>User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</p>
          </div>
        </div>
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Для авторизации откройте эту страницу в приложении Warpcast.
          </p>
          <a 
            href={`https://warpcast.com/~/launch?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : 'https://snotcoin.online')}`}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full transition-colors inline-block"
          >
            Открыть в Warpcast
          </a>
          
          <div className="mt-4 text-xs text-gray-500 p-2 border border-gray-200 rounded bg-gray-50">
            <p className="font-semibold mb-1">Примечание для разработчиков:</p>
            <p>Farcaster SDK доступен в трех форматах:</p>
            <ul className="list-disc list-inside">
              <li>В приложении Warpcast (мобильный)</li>
              <li>В WebView браузера Warpcast</li>
              <li>В Farcaster Frames</li>
            </ul>
            <p className="mt-1">
              Убедитесь, что вы открываете приложение в одном из этих контекстов.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
} 