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
  _sdkInitializing: false, // Флаг, указывающий что SDK инициализируется
  
  // Метод для получения SDK
  getSDK() {
    return this.sdk;
  },
  
  // Метод для получения контекста пользователя
  async getUserContext() {
    try {
      // Если у нас уже есть контекст пользователя, возвращаем его
      if (this.userContext && this.userContext.fid) {
        return this.userContext;
      }
      
      // Если SDK не инициализирован, проверяем window.farcaster
      if (!this.sdk) {
        if (typeof window !== 'undefined' && (window as any).farcaster) {
          const farcaster = (window as any).farcaster;
          
          try {
            // Попытка получить контекст через нативный SDK
            if (farcaster.getContext) {
              const nativeContext = await farcaster.getContext();
              
              if (nativeContext) {
                const transformedContext = transformUserContext(nativeContext);
                this.userContext = transformedContext;
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
      if (this.sdk.context) {
        try {
          const sdkContext = await this.sdk.context;
          
          if (sdkContext) {
            const transformedContext = transformUserContext(sdkContext);
            this.userContext = transformedContext;
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
    
    // Если SDK не инициализирован в store, но доступен в window, инициализируем его
    if (!isInit && hasWindowFarcaster && typeof (window as any).farcaster.getContext === 'function') {
      this.setSDK((window as any).farcaster);
      return true;
    }
    
    return isInit || hasWindowFarcaster;
  },
  
  // Метод для установки SDK
  setSDK(sdk: any) {
    this.sdk = sdk;
    this.isInitialized = true;
    this._sdkInitializing = false;
  },
  
  // Метод для установки контекста пользователя
  setUserContext(context: any) {
    const transformedContext = transformUserContext(context);
    this.userContext = transformedContext;
  },
  
  // Метод для проверки, аутентифицирован ли пользователь
  isAuthenticated() {
    return this._isAuthenticated;
  },
  
  // Метод для установки состояния аутентификации
  setIsAuthenticated(value: boolean) {
    this._isAuthenticated = value;
  },
  
  // Метод для добавления приложения в избранное
  async addToFavorites() {
    try {
      if (!this.sdk || !this.sdk.actions || !this.sdk.actions.addToHomeScreen) {
        console.warn('addToHomeScreen not available in SDK');
        return false;
      }
      
      const result = await this.sdk.actions.addToHomeScreen();
      return result;
    } catch (error) {
      console.error('Error adding to favorites:', error);
      return false;
    }
  },
  
  // Метод для отправки уведомления пользователю
  async requestNotificationPermission() {
    try {
      if (!this.sdk || !this.sdk.actions || !this.sdk.actions.requestNotificationPermission) {
        console.warn('requestNotificationPermission not available in SDK');
        return false;
      }
      
      const result = await this.sdk.actions.requestNotificationPermission();
      return result;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  },
  
  // Метод для проверки, находимся ли мы внутри Farcaster клиента
  isFarcasterClient() {
    return typeof window !== 'undefined' && (
      !!(window as any).farcaster || // Нативный SDK
      this.isInitialized // Инициализированный модульный SDK
    );
  },
  
  // Метод запуска инициализации SDK
  startInitializing() {
    if (this.isInitialized || this._sdkInitializing) return;
    this._sdkInitializing = true;
  },
  
  // Метод проверки, идет ли инициализация
  isInitializing() {
    return this._sdkInitializing;
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
    
    // Начинаем процесс инициализации
    farcasterStore.startInitializing();
    
    // Проверяем наличие нативного SDK в window
    if (typeof window !== 'undefined' && (window as any).farcaster) {
      try {
        const nativeSdk = (window as any).farcaster;
        farcasterStore.setSDK(nativeSdk);
        
        // Если есть метод ready(), вызываем его
        if (typeof nativeSdk.ready === 'function') {
          console.log('[FarcasterFrameHandler] Native SDK found, marking as initialized');
          // ВАЖНО: сам ready() мы здесь НЕ вызываем, его вызов происходит в HomeContent
          // после полной загрузки интерфейса
        }
        
        // Пытаемся получить контекст пользователя
        if (typeof nativeSdk.getContext === 'function') {
          nativeSdk.getContext().then((context: any) => {
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
        console.log('[FarcasterFrameHandler] Dynamically importing Farcaster Frame SDK');
        const sdkModule = await import('@farcaster/frame-sdk');
        const sdk = sdkModule.default;
        
        // Проверяем, что SDK загружен корректно
        if (!sdk || !sdk.actions || typeof sdk.actions.ready !== 'function') {
          console.warn('Farcaster Frame SDK не загружен корректно');
          return;
        }
        
        // Сохраняем SDK в глобальное хранилище
        farcasterStore.setSDK(sdk);
        
        // Проверяем, что компонент все еще смонтирован
        if (!isMountedRef.current) return;
        
        // Отмечаем, что SDK был инициализирован
        sdkInitializedRef.current = true;
        
        // Получаем контекст SDK
        try {
          const context = await sdk.context;
          
          // Сохраняем контекст пользователя в хранилище
          farcasterStore.setUserContext(context);
          
          // Проверяем, что компонент все еще смонтирован
          if (!isMountedRef.current) return;
          
          // Отмечаем что SDK полностью инициализирован
          // ВАЖНО: сам ready() мы здесь НЕ вызываем, его вызов происходит в HomeContent
          // после полной загрузки интерфейса
          console.log('[FarcasterFrameHandler] SDK initialized successfully');
          
          // Обновляем состояние только если компонент смонтирован
          safeSetState(setIsLoaded, true);
          safeSetState(setSdkInitialized, true);
        } catch (contextError) {
          console.warn('Failed to get Farcaster context, continuing initialization', contextError);
          
          // Даже при ошибке контекста отмечаем SDK как инициализированный
          if (isMountedRef.current) {
            safeSetState(setIsLoaded, true);
            safeSetState(setSdkInitialized, true);
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
    }, 200);

    return () => {
      // Очистка при размонтировании
      isMountedRef.current = false;
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Ничего не рендерим, компонент служит только для инициализации SDK
  return null;
};

export default FarcasterFrameHandler; 