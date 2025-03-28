'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// import { useRouter } from 'next/navigation'; // Не используется
// import { FarcasterSDK, FARCASTER_SDK } from '@/app/types/farcaster'; // Старые типы не нужны
import { FarcasterUser } from '@/app/types/farcaster'; // Используем только FarcasterUser
// import { UserData } from '@/app/types/auth'; // Не используется
// import { useAuth } from '@/app/hooks/useAuth'; // Не используется
import { logAuth, AuthStep, AuthLogType, logAuthInfo, logAuthError } from '@/app/utils/auth-logger';

// Импортируем SDK для Mini Apps
import { sdk as miniAppSdk } from '@farcaster/frame-sdk';

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

// Убираем декларацию для window.farcaster
// declare global { ... }

export const FarcasterProvider: React.FC<FarcasterProviderProps> = ({ children }) => {
  // Убираем useAuth
  // const { user: authUser, isAuthenticated, isLoading: isAuthLoading } = useAuth(); 
  const [sdkUser, setSdkUser] = useState<FarcasterUser | null>(null);
  const [sdkStatus, setSdkStatus] = useState<SdkStatus>('idle'); // Начинаем с idle
  const [sdkError, setSdkError] = useState<string | null>(null);
  // const router = useRouter(); // Не используется
  // const isSdkInitializedRef = useRef<boolean>(false); // Не используется

  // Убираем login, logout, refreshUserData, fetchUserByFid
  
  // --- Удаляем всю старую логику инициализации SDK (loadScript, initializeSdk, старый useEffect) --- 

  // --- Новая логика инициализации для Mini App (остается) --- 
  useEffect(() => {
    let isMounted = true;
    // Убираем лишний лог о запуске эффекта
    setSdkStatus('loading');
    setSdkError(null);

    const getMiniAppContext = async () => {
      try {
        const contextPromise = miniAppSdk.context;
        if (!contextPromise) {
           throw new Error('miniAppSdk.context property is not available.');
        }
        
        const context = await contextPromise; 
        // Убираем вывод всего контекста, оставляем только финальный лог с данными пользователя

        if (!isMounted) {
           // Этот лог можно оставить для отладки размонтирования
           return;
        }

        if (context && context.user && typeof context.user.fid === 'number') {
          const userData: FarcasterUser = {
            fid: context.user.fid,
            username: context.user.username || 'N/A',
            displayName: context.user.displayName || 'N/A',
            pfp: { url: context.user.pfpUrl || '' },
            // verifications: context.user.verifiedAddresses || [], // Пока оставляем закомментированным
          };
          
          // Можно оставить один лог с данными пользователя
          console.log('[FarcasterContext] User authenticated:', userData.fid, userData.username);
          setSdkUser(userData);
          setSdkStatus('ready');
          logAuthInfo(AuthStep.FARCASTER_INIT, 'Mini App context received successfully.', { fid: context.user.fid });
        } else {
          console.warn('[FarcasterContext] Missing user data or FID in context');
          setSdkUser(null);
          setSdkStatus('error');
          setSdkError('Mini App context resolved, but missing user data or FID.');
          logAuthError(AuthStep.FARCASTER_INIT, 'Mini App context resolved, but missing user data or FID.', { context });
        }
      } catch (error: any) {
        console.error('[FarcasterContext] Error with Mini App context:', error.message);
        if (isMounted) {
          setSdkUser(null);
          setSdkStatus('error');
          setSdkError(error.message || 'Failed to resolve or process Mini App context');
          logAuthError(AuthStep.FARCASTER_INIT, 'Error resolving or processing Mini App context', { error: error.message });
        }
      }
    };

    getMiniAppContext();

    return () => {
      // Убираем лишний лог о размонтировании
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