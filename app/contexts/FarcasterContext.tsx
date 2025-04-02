'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// import { useRouter } from 'next/navigation'; // Не используется
// import { FarcasterSDK, FARCASTER_SDK } from '@/app/types/farcaster'; // Старые типы не нужны
import { FarcasterUser, FarcasterContext as SDKContext } from '@/app/types/farcaster'; // Используем только FarcasterUser
// import { UserData } from '@/app/types/auth'; // Не используется
// import { useAuth } from '@/app/hooks/useAuth'; // Не используется
import { logAuth, AuthStep, AuthLogType, logAuthInfo, logAuthError } from '@/app/utils/auth-logger';

// Импортируем SDK для Mini Apps
import { sdk as miniAppSdk } from '@farcaster/frame-sdk';

// Импортируем функции для режима разработчика
import { isFarcasterDevMockActive } from '../utils/devTools/farcasterDevMock';

// Типы для статуса SDK
type SdkStatus = 'idle' | 'loading' | 'ready' | 'error';

interface FarcasterContextProps {
  // Убираем user, isAuthenticated, isLoading, login, logout, refreshUserData, fetchUserByFid
  sdkUser: FarcasterUser | null;
  sdkStatus: SdkStatus;
  sdkError: string | null;
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

/**
 * Получить пользовательские данные из различных форматов контекста
 */
const extractUserData = (context: any): FarcasterUser | null => {
  if (!context) return null;
  
  console.log('[FarcasterContext] Extracting user data from context:', context);
  
  // Для мока разработчика и других SDK с прямым доступом к полям
  if (typeof context.fid === 'number') {
    return {
      fid: context.fid,
      username: context.username || 'unknown',
      displayName: context.displayName || context.username || 'Unknown User',
      pfp: context.pfp && typeof context.pfp === 'object' 
          ? context.pfp 
          : { url: context.pfpUrl || '' }
    };
  }
  
  // Для стандартного формата Mini App SDK
  if (context.user && typeof context.user.fid === 'number') {
    return {
      fid: context.user.fid,
      username: context.user.username || 'unknown',
      displayName: context.user.displayName || context.user.username || 'Unknown User',
      pfp: context.user.pfp && typeof context.user.pfp === 'object'
          ? context.user.pfp
          : { url: context.user.pfpUrl || '' }
    };
  }
  
  // Последняя попытка извлечь данные из нестандартного формата
  console.warn('[FarcasterContext] Using fallback extraction method for non-standard context format');
  try {
    // Попытка найти любое числовое значение, которое может быть FID
    let possibleFid: number | null = null;
    
    // Проверяем все свойства верхнего уровня для поиска FID
    for (const key in context) {
      if (typeof context[key] === 'number' && key.toLowerCase().includes('fid')) {
        possibleFid = context[key];
        break;
      }
      // Также проверяем внутри вложенных объектов
      if (context[key] && typeof context[key] === 'object') {
        for (const subKey in context[key]) {
          if (typeof context[key][subKey] === 'number' && subKey.toLowerCase().includes('fid')) {
            possibleFid = context[key][subKey];
            break;
          }
        }
      }
    }
    
    if (possibleFid) {
      return {
        fid: possibleFid,
        username: 'unknown-' + possibleFid,
        displayName: 'Unknown User ' + possibleFid,
        pfp: { url: '' }
      };
    }
  } catch (error) {
    console.error('[FarcasterContext] Error in fallback extraction:', error);
  }
  
  return null;
};

// Создаем запасной контекст для режима разработки, если не смогли получить из SDK
const createFallbackContext = (): any => {
  const fid = Math.floor(Math.random() * 1000000) + 100000; // Случайный FID
  return {
    fid: fid,
    username: `dev_user_${fid}`,
    displayName: `Dev User ${fid}`,
    user: {
      fid: fid,
      username: `dev_user_${fid}`,
      displayName: `Dev User ${fid}`,
      pfp: { url: 'https://cdn.warpcast.com/profile-pictures/default-profile.png', verified: true }
    },
    client: {
      clientFid: 9152,
      added: true,
      safeAreaInsets: { top: 0, bottom: 20, left: 0, right: 0 }
    },
    authenticated: true,
    verifiedAddresses: [`0x${fid.toString(16).padStart(40, '0')}`],
  };
};

export const FarcasterProvider: React.FC<FarcasterProviderProps> = ({ children }) => {
  // Убираем useAuth
  // const { user: authUser, isAuthenticated, isLoading: isAuthLoading } = useAuth(); 
  const [sdkUser, setSdkUser] = useState<FarcasterUser | null>(null);
  const [sdkStatus, setSdkStatus] = useState<SdkStatus>('idle');
  const [sdkError, setSdkError] = useState<string | null>(null);
  // const router = useRouter(); // Не используется
  // const isSdkInitializedRef = useRef<boolean>(false); // Не используется

  // Убираем login, logout, refreshUserData, fetchUserByFid
  
  // --- Удаляем всю старую логику инициализации SDK (loadScript, initializeSdk, старый useEffect) --- 

  // --- Новая логика инициализации для Mini App (остается) --- 
  useEffect(() => {
    let isMounted = true;
    console.log('[FarcasterContext] useEffect for SDK context RUNNING.');
    setSdkStatus('loading');
    setSdkError(null);

    const getFarcasterContext = async () => {
      try {
        // Проверяем, активен ли режим разработчика
        const isDevMode = process.env.NODE_ENV === 'development';
        const isDevMockActive = isDevMode && isFarcasterDevMockActive();
        
        let contextData: any = null;
        let source = 'unknown';
        
        if (isDevMockActive) {
          console.log('[FarcasterContext] Developer Mode detected! Using mock Farcaster SDK.');
          
          // Получаем контекст из мока window.farcaster
          try {
            if (typeof window !== 'undefined' && window.farcaster) {
              const mockContextPromise = window.farcaster.getContext();
              contextData = await mockContextPromise;
              source = 'dev-mock';
              console.log('[FarcasterContext] Retrieved mock context:', contextData);
              
              // Вызываем ready для скрытия сплэш-скрина Farcaster
              if (window.farcaster && typeof window.farcaster.ready === 'function') {
                await window.farcaster.ready();
                console.log('[FarcasterContext] Called window.farcaster.ready()');
              }
              
              // Также пробуем вызвать actions.ready если он доступен
              if (window.farcaster && window.farcaster.actions && typeof window.farcaster.actions.ready === 'function') {
                await window.farcaster.actions.ready();
                console.log('[FarcasterContext] Called window.farcaster.actions.ready()');
              }
            } else {
              throw new Error('window.farcaster is not available in dev mode');
            }
          } catch (mockError: any) {
            console.error('[FarcasterContext] Error in dev mode:', mockError);
            logAuthError(AuthStep.FARCASTER_INIT, 'Error in dev mode', { error: mockError.message });
            
            // Создаем запасной контекст для режима разработки, если window.farcaster недоступен
            if (isDevMode) {
              console.log('[FarcasterContext] Using fallback context for development mode');
              contextData = createFallbackContext();
              source = 'dev-fallback';
            } else {
              // Продолжаем к стандартной инициализации как запасной вариант
              console.log('[FarcasterContext] Falling back to standard initialization');
            }
          }
        }
        
        // Если не получили контекст из мока, используем стандартный Mini App SDK
        if (!contextData) {
          try {
            // Проверяем доступность SDK
            if (!miniAppSdk || typeof miniAppSdk.context === 'undefined') {
              throw new Error('miniAppSdk.context is not available');
            }
            
            // Получаем контекст из SDK
            const contextPromise = miniAppSdk.context;
            contextData = await contextPromise;
            source = 'mini-app-sdk';
            console.log('[FarcasterContext] Resolved Mini App context:', contextData);
            
            // Вызываем ready для скрытия сплэш-скрина Farcaster
            try {
              await miniAppSdk.actions.ready();
              console.log('[FarcasterContext] Called miniAppSdk.actions.ready()');
            } catch (readyError) {
              console.warn('[FarcasterContext] Failed to call miniAppSdk.actions.ready():', readyError);
            }
          } catch (miniAppError: any) {
            console.error('[FarcasterContext] Error with Mini App SDK:', miniAppError);
            
            // В режиме разработки используем запасной контекст при ошибке SDK
            if (isDevMode) {
              console.log('[FarcasterContext] Using fallback context for development mode after SDK error');
              contextData = createFallbackContext();
              source = 'dev-fallback-after-sdk-error';
            } else {
              throw miniAppError; // Проброс ошибки для обработки ниже в production
            }
          }
        }

        if (!isMounted) {
           console.log('[FarcasterContext] Unmounted after resolving context.');
           return;
        }
        
        // Извлекаем данные пользователя из контекста
        const userData = extractUserData(contextData);
        
        if (userData && typeof userData.fid === 'number') {
          console.log(`[FarcasterContext] Setting user data (source: ${source}):`, userData);
          setSdkUser(userData);
          setSdkStatus('ready');
          logAuthInfo(AuthStep.FARCASTER_INIT, `Context received from ${source}`, { fid: userData.fid });
        } else {
          console.warn(`[FarcasterContext] Context resolved from ${source}, but missing user data or FID.`, contextData);
          
          // В режиме разработки используем запасной пользовательский объект
          if (isDevMode) {
            const fallbackUser = {
              fid: 123456789,
              username: 'dev_user',
              displayName: 'Dev User',
              pfp: { url: 'https://cdn.warpcast.com/profile-pictures/default-profile.png' }
            };
            console.log('[FarcasterContext] Using fallback user data for development:', fallbackUser);
            setSdkUser(fallbackUser);
            setSdkStatus('ready');
            logAuthInfo(AuthStep.FARCASTER_INIT, `Using fallback user data for development`, { fid: fallbackUser.fid });
          } else {
            setSdkUser(null);
            setSdkStatus('error');
            setSdkError(`Context resolved, but missing user data or FID (source: ${source})`);
            logAuthError(AuthStep.FARCASTER_INIT, 'Context missing user data or FID', { context: contextData });
          }
        }
      } catch (error: any) {
        console.error('[FarcasterContext] Error resolving or processing context:', error);
        
        if (isMounted) {
          // В режиме разработки используем запасной пользовательский объект при любой ошибке
          if (process.env.NODE_ENV === 'development') {
            const fallbackUser = {
              fid: 123456789,
              username: 'dev_user',
              displayName: 'Dev User (Fallback)',
              pfp: { url: 'https://cdn.warpcast.com/profile-pictures/default-profile.png' }
            };
            console.log('[FarcasterContext] Using fallback user data after error:', fallbackUser);
            setSdkUser(fallbackUser);
            setSdkStatus('ready');
            logAuthInfo(AuthStep.FARCASTER_INIT, `Using fallback user data after error`, { fid: fallbackUser.fid });
          } else {
            setSdkUser(null);
            setSdkStatus('error');
            setSdkError(error.message || 'Failed to resolve or process context');
            logAuthError(AuthStep.FARCASTER_INIT, 'Error resolving or processing context', { error: error.message });
          }
        }
      }
    };

    getFarcasterContext();

    return () => {
      console.log('[FarcasterContext] useEffect CLEANUP running.');
      isMounted = false;
    };
  }, []);

  // Обновляем значение контекста
  const value: FarcasterContextProps = {
    sdkUser,
    sdkStatus,
    sdkError,
  };

  return (
    <FarcasterContext.Provider value={value}>
      {children}
    </FarcasterContext.Provider>
  );
}; 