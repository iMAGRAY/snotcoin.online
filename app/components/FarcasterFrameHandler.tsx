"use client"

import { useEffect, useState, useRef } from 'react';

// Интерфейс для контекста пользователя Farcaster
interface FarcasterUserContext {
  user?: {
    fid?: number;
    username?: string;
    displayName?: string;
    pfp?: {
      url?: string;
      verified?: boolean;
    };
  };
  [key: string]: any;
}

// Преобразование контекста в стандартный формат для нашего приложения
const transformUserContext = (context: FarcasterUserContext): any => {
  if (!context || !context.user) return null;
  
  return {
    fid: context.user.fid,
    username: context.user.username,
    displayName: context.user.displayName,
    pfp: context.user.pfp,
    verified: context.user.pfp?.verified,
    custody: context.custody,
    verifications: context.verifications
  };
};

// Глобальное хранилище для SDK и данных пользователя
export const farcasterStore = {
  isInitialized: false,
  sdk: null as any,
  userContext: null as any,
  _isAuthenticated: false, // Флаг состояния аутентификации
  
  // Метод для получения SDK
  getSDK() {
    console.log('Getting SDK from store, initialized:', this.isInitialized, 'sdk:', this.sdk ? 'available' : 'null');
    return this.sdk;
  },
  
  // Метод для получения контекста пользователя
  async getUserContext() {
    console.log('Getting user context from store, context:', this.userContext ? 'available' : 'null');
    
    try {
      // Если у нас уже есть контекст пользователя, возвращаем его
      if (this.userContext && this.userContext.fid) {
        console.log('Returning cached user context:', this.userContext);
        return this.userContext;
      }
      
      // Если SDK не инициализирован, проверяем window.farcaster
      if (!this.sdk) {
        console.log('SDK not initialized, checking window.farcaster');
        
        if (typeof window !== 'undefined' && (window as any).farcaster) {
          const farcaster = (window as any).farcaster;
          
          try {
            // Попытка получить контекст через нативный SDK
            if (farcaster.getContext) {
              console.log('Trying to get context via window.farcaster.getContext');
              const nativeContext = await farcaster.getContext();
              
              if (nativeContext) {
                const transformedContext = transformUserContext(nativeContext);
                this.userContext = transformedContext;
                console.log('Retrieved user context from window.farcaster:', transformedContext);
                return transformedContext;
              }
            }
          } catch (error) {
            console.warn('Error getting context from window.farcaster:', error);
          }
        }
        
        return null;
      }
      
      // Попытка получить контекст через SDK модуль
      console.log('Trying to get context via SDK module');
      if (this.sdk.context) {
        try {
          const sdkContext = await this.sdk.context;
          console.log('Raw SDK context:', sdkContext);
          
          if (sdkContext) {
            const transformedContext = transformUserContext(sdkContext);
            this.userContext = transformedContext;
            console.log('Retrieved and transformed user context from SDK:', transformedContext);
            return transformedContext;
          }
        } catch (error) {
          console.error('Error getting context from SDK:', error);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Unexpected error in getUserContext:', error);
      return null;
    }
  },
  
  // Метод для проверки, инициализирован ли SDK
  isSDKInitialized() {
    // Проверяем SDK через store или window.farcaster
    const isInit = this.isInitialized && this.sdk !== null;
    const hasWindowFarcaster = typeof window !== 'undefined' && !!(window as any).farcaster;
    
    console.log('Checking if SDK initialized:', isInit, 'store state:', this.isInitialized, 'window.farcaster:', hasWindowFarcaster);
    
    // Если SDK не инициализирован в store, но доступен в window, инициализируем его
    if (!isInit && hasWindowFarcaster && typeof (window as any).farcaster.getContext === 'function') {
      console.log('SDK found in window.farcaster, initializing store');
      this.setSDK((window as any).farcaster);
      return true;
    }
    
    return isInit || hasWindowFarcaster;
  },
  
  // Метод для установки SDK
  setSDK(sdk: any) {
    console.log('Setting SDK in store', sdk ? 'SDK available' : 'SDK null');
    this.sdk = sdk;
    this.isInitialized = true;
  },
  
  // Метод для установки контекста пользователя
  setUserContext(context: any) {
    const transformedContext = transformUserContext(context);
    console.log('Setting user context in store:', transformedContext);
    this.userContext = transformedContext;
  },
  
  // Новый метод для проверки, аутентифицирован ли пользователь
  isAuthenticated() {
    console.log('Checking if user is authenticated:', this._isAuthenticated);
    return this._isAuthenticated;
  },
  
  // Новый метод для установки состояния аутентификации
  setIsAuthenticated(value: boolean) {
    console.log('Setting authentication state:', value);
    this._isAuthenticated = value;
  }
};

/**
 * Компонент для работы с Farcaster Frames SDK
 * Инициализирует SDK и вызывает метод ready() сразу после загрузки
 */
const FarcasterFrameHandler = () => {
  // Проверка браузерного окружения
  if (typeof window === 'undefined') {
    return null; // Ничего не рендерим на сервере
  }

  const [isLoaded, setIsLoaded] = useState(false);
  const [sdkInitialized, setSdkInitialized] = useState(false);
  
  // Ref для отслеживания монтирования компонента
  const isMountedRef = useRef(true);
  // Ref для отслеживания инициализации SDK
  const sdkInitializedRef = useRef(false);
  // Ref для отслеживания таймера
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Безопасная функция обновления состояния
  const safeSetState = (setter: Function, value: any) => {
    if (isMountedRef.current) {
      setter(value);
    }
  };

  // Используем try-catch внутри useEffect для предотвращения падения приложения
  useEffect(() => {
    // Сбрасываем флаги при монтировании компонента
    isMountedRef.current = true;
    sdkInitializedRef.current = false;
    
    // Проверяем наличие нативного SDK в window
    if (typeof window !== 'undefined' && (window as any).farcaster) {
      console.log('Native Farcaster SDK detected in window');
      
      try {
        const nativeSdk = (window as any).farcaster;
        farcasterStore.setSDK(nativeSdk);
        
        // Если есть метод ready(), вызываем его
        if (typeof nativeSdk.ready === 'function') {
          nativeSdk.ready();
          console.log('Called ready() on native Farcaster SDK');
        }
        
        // Пытаемся получить контекст пользователя
        if (typeof nativeSdk.getContext === 'function') {
          nativeSdk.getContext().then((context: any) => {
            console.log('Retrieved context from native SDK:', context);
            farcasterStore.setUserContext(context);
          }).catch((error: any) => {
            console.warn('Failed to get context from native SDK:', error);
          });
        }
        
        sdkInitializedRef.current = true;
        safeSetState(setIsLoaded, true);
        safeSetState(setSdkInitialized, true);
      } catch (error) {
        console.error('Error initializing native Farcaster SDK:', error);
      }
    }

    const initFarcaster = async () => {
      // Если SDK уже был инициализирован, не инициализируем повторно
      if (sdkInitializedRef.current) return;
      
      try {
        // Динамический импорт SDK только на клиенте
        const sdkModule = await import('@farcaster/frame-sdk');
        const sdk = sdkModule.default;
        
        // Проверяем, что SDK загружен корректно
        if (!sdk || !sdk.actions || typeof sdk.actions.ready !== 'function') {
          console.warn('Farcaster Frame SDK не загружен корректно');
          return;
        }
        
        // Сохраняем SDK в глобальное хранилище
        farcasterStore.setSDK(sdk);
        console.log('SDK set in store, initialized:', farcasterStore.isInitialized);
        
        // Проверяем, что компонент все еще смонтирован
        if (!isMountedRef.current) return;
        
        // Отмечаем, что SDK был инициализирован
        sdkInitializedRef.current = true;
        
        // Получаем контекст SDK
        try {
          const context = await sdk.context;
          console.log('Farcaster Frame SDK initialized', context);
          
          // Сохраняем контекст пользователя в хранилище
          farcasterStore.setUserContext(context);
          
          // Проверяем, что компонент все еще смонтирован
          if (!isMountedRef.current) return;
          
          // Вызываем метод ready() для уведомления Farcaster, что фрейм готов
          sdk.actions.ready();
          console.log('Farcaster ready() called');
          
          // Обновляем состояние только если компонент смонтирован
          safeSetState(setIsLoaded, true);
          safeSetState(setSdkInitialized, true);
        } catch (contextError) {
          console.warn('Failed to get Farcaster context, but will still call ready()', contextError);
          
          // Даже при ошибке контекста пытаемся вызвать ready()
          if (isMountedRef.current) {
            try {
              sdk.actions.ready();
              console.log('Farcaster ready() called despite context error');
              
              safeSetState(setIsLoaded, true);
              safeSetState(setSdkInitialized, true);
            } catch (readyError) {
              console.error('Failed to call ready()', readyError);
            }
          }
        }
      } catch (error) {
        console.error('Error initializing Farcaster Frame SDK:', error);
      }
    };

    // Отложенная инициализация для улучшения стабильности
    // Сохраняем ссылку на таймер, чтобы можно было очистить
    timeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && !sdkInitializedRef.current) {
        initFarcaster();
      }
    }, 300);
    
    // Функция очистки при размонтировании компонента
    return () => {
      // Обновляем флаг монтирования
      isMountedRef.current = false;
      
      // Очищаем таймер, если он был установлен
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // Компонент не рендерит UI
  return null;
};

export default FarcasterFrameHandler; 