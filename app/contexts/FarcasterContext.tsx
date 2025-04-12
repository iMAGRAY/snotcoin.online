'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { isValidEthereumProvider } from '@/app/utils/providerHelpers';

// Типы для SDK Farcaster
interface FarcasterUser {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
}

// Состояние SDK
type SdkStatus = 'idle' | 'loading' | 'ready' | 'error';

// Интерфейс контекста
interface FarcasterContextProps {
  sdkStatus: SdkStatus;
  sdkUser: FarcasterUser | null;
  sdkError: Error | null;
  isInFarcasterApp: boolean;
  getProvider: () => Promise<any>;
}

const FarcasterContext = createContext<FarcasterContextProps | undefined>(
  undefined
);

export const useFarcaster = () => {
  const context = useContext(FarcasterContext);
  if (context === undefined) {
    throw new Error('useFarcaster must be used within a FarcasterProvider');
  }
  return context;
};

interface FarcasterProviderProps {
  children: ReactNode;
}

export const FarcasterProvider: React.FC<FarcasterProviderProps> = ({ children }) => {
  const [sdkStatus, setSdkStatus] = useState<SdkStatus>('idle');
  const [sdkUser, setSdkUser] = useState<FarcasterUser | null>(null);
  const [sdkError, setSdkError] = useState<Error | null>(null);
  const [isInFarcasterApp, setIsInFarcasterApp] = useState<boolean>(false);
  const [sdk, setSdk] = useState<any>(null);

  useEffect(() => {
    console.log('[FarcasterContext] useEffect for SDK context RUNNING.');
    
    // Функция для инициализации SDK
    const initFarcasterSdk = async () => {
      try {
        setSdkStatus('loading');
        
        let farcasterSdk;
        let userContext;
        
        // Проверяем наличие SDK в window
        if (typeof window !== 'undefined' && (window as any).farcaster) {
          console.log('[FarcasterContext] Найден нативный Farcaster SDK');
          setIsInFarcasterApp(true);
          farcasterSdk = (window as any).farcaster;
          
          // Пытаемся получить контекст
          if (typeof farcasterSdk.getContext === 'function') {
            try {
              userContext = await farcasterSdk.getContext();
            } catch (contextError) {
              console.warn('[FarcasterContext] Ошибка при получении контекста из нативного SDK:', contextError);
            }
          }
        } else {
          // Если нет SDK в window, пытаемся загрузить его динамически
          try {
            console.log('[FarcasterContext] Динамическая загрузка Farcaster Frame SDK');
            const sdkModule = await import('@farcaster/frame-sdk');
            farcasterSdk = sdkModule.default;
            
            // Получаем контекст из импортированного SDK
            try {
              userContext = await farcasterSdk.context;
            } catch (contextError) {
              console.warn('[FarcasterContext] Ошибка при получении контекста из импортированного SDK:', contextError);
            }
          } catch (importError) {
            console.error('[FarcasterContext] Ошибка при импорте SDK:', importError);
            setSdkError(importError instanceof Error ? importError : new Error(String(importError)));
            setSdkStatus('error');
            return;
          }
        }
        
        // Сохраняем SDK для последующего использования
        setSdk(farcasterSdk);
        
        // Вызываем метод ready() чтобы уведомить Farcaster, что приложение готово
        if (farcasterSdk && typeof farcasterSdk.actions?.ready === 'function') {
          console.log('[FarcasterContext] Called miniAppSdk.actions.ready()');
          try {
            await farcasterSdk.actions.ready().catch((e: Error | unknown) => {
              // Игнорируем ошибки, связанные с endpoint inspect-miniapp-url
              if (e && (e.toString().includes('inspect-miniapp-url') || 
                        e.toString().includes('client.warpcast.com'))) {
                console.log('[FarcasterContext] Игнорируем ошибку inspect-miniapp-url:', e.toString());
                // Это не критическая ошибка, можно продолжить
                return;
              }
              throw e; // Прокидываем другие ошибки для обработки
            });
          } catch (readyError) {
            console.warn('[FarcasterContext] Ошибка при вызове actions.ready():', readyError);
          }
        }
        
        // Обрабатываем данные пользователя, если они получены
        if (userContext && userContext.user) {
          console.log('[FarcasterContext] Resolved Mini App context:', userContext);
          console.log('[FarcasterContext] Setting user data (source: mini-app-sdk):', userContext.user);
          
          const userData = {
            fid: userContext.user.fid,
            username: userContext.user.username,
            displayName: userContext.user.displayName,
            pfpUrl: userContext.user.pfpUrl
          };
          
          setSdkUser(userData);
        }
        
        setSdkStatus('ready');
      } catch (error) {
        console.error('[FarcasterContext] Error initializing Farcaster SDK:', error);
        setSdkError(error instanceof Error ? error : new Error(String(error)));
        setSdkStatus('error');
      }
    };
    
    // Запускаем инициализацию SDK
    initFarcasterSdk();
    
    // Очистка при размонтировании
    return () => {
      console.log('[FarcasterContext] Cleanup');
    };
  }, []);
  
  // Безопасный метод получения провайдера
  const getProvider = async (): Promise<any> => {
    try {
      // Если есть SDK с методом wallet.ethProvider, используем его (рекомендуемый способ по документации)
      if (sdk && sdk.wallet && sdk.wallet.ethProvider) {
        console.log('[FarcasterContext] Используем sdk.wallet.ethProvider');
        return sdk.wallet.ethProvider;
      }
      
      // Если у window.farcaster есть wallet.ethProvider, используем его
      if (typeof window !== 'undefined' && (window as any).farcaster && 
          (window as any).farcaster.wallet && (window as any).farcaster.wallet.ethProvider) {
        console.log('[FarcasterContext] Используем window.farcaster.wallet.ethProvider');
        return (window as any).farcaster.wallet.ethProvider;
      }
      
      // Если у SDK есть метод getProvider, используем его
      if (sdk && typeof sdk.getProvider === 'function') {
        try {
          console.log('[FarcasterContext] Вызываем sdk.getProvider()');
          const provider = await sdk.getProvider();
          if (isValidEthereumProvider(provider)) {
            return provider;
          }
        } catch (providerError) {
          console.warn('[FarcasterContext] Ошибка при вызове sdk.getProvider:', providerError);
        }
      }
      
      // Если у window.farcaster есть метод getProvider, используем его
      if (typeof window !== 'undefined' && (window as any).farcaster && 
          typeof (window as any).farcaster.getProvider === 'function') {
        try {
          console.log('[FarcasterContext] Вызываем window.farcaster.getProvider()');
          const provider = await (window as any).farcaster.getProvider();
          if (isValidEthereumProvider(provider)) {
            return provider;
          }
        } catch (providerError) {
          console.warn('[FarcasterContext] Ошибка при вызове window.farcaster.getProvider:', providerError);
        }
      }
      
      // Если nothing else, используем window.ethereum как fallback
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        console.log('[FarcasterContext] Используем window.ethereum как fallback');
        return (window as any).ethereum;
      }
      
      // Если ничего не нашли, возвращаем null
      console.warn('[FarcasterContext] Не удалось получить провайдер, возвращаем null');
      return null;
    } catch (error) {
      console.error('[FarcasterContext] Ошибка при получении провайдера:', error);
      return null;
    }
  };

  return (
    <FarcasterContext.Provider 
      value={{ 
        sdkStatus, 
        sdkUser, 
        sdkError, 
        isInFarcasterApp,
        getProvider
      }}
    >
      {children}
    </FarcasterContext.Provider>
  );
}; 