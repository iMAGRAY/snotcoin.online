'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { FarcasterUser, FarcasterContext as SDKContext } from '@/app/types/farcaster';
import { logAuth, AuthStep, AuthLogType, logAuthInfo, logAuthError } from '@/app/utils/auth-logger';
import { api, FarcasterLoginParams } from '@/app/lib/api';

// Импортируем SDK для Mini Apps
import { sdk as miniAppSdk } from '@farcaster/frame-sdk';

// Типы для статуса SDK
type SdkStatus = 'idle' | 'loading' | 'ready' | 'error';

interface FarcasterContextProps {
  sdkUser: FarcasterUser | null;
  sdkStatus: SdkStatus;
  sdkError: string | null;
  validateAndLogin: (message?: string, signature?: string) => Promise<boolean>;
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
  
  try {
    // Извлекаем основную информацию из контекста
    const { user } = context;
    
    if (!user) {
      console.warn('[FarcasterContext] extractUserData: user object not found in context');
      return null;
    }
    
    // Проверяем обязательные поля
    if (!user.fid || typeof user.fid !== 'number') {
      console.warn('[FarcasterContext] extractUserData: fid is missing or not a number');
      return null;
    }
    
    // Создаем базовый объект пользователя
    const userData: FarcasterUser = {
      fid: user.fid,
      username: typeof user.username === 'string' ? user.username : `user_${user.fid}`,
      displayName: typeof user.displayName === 'string' ? user.displayName : user.username || `User ${user.fid}`,
    };
    
    // Добавляем URL аватара, если доступен
    if (user.pfp && typeof user.pfp.url === 'string') {
      userData.pfpUrl = user.pfp.url;
    } else if (typeof user.pfpUrl === 'string') {
      userData.pfpUrl = user.pfpUrl;
    } else {
      // Используем стандартный URL для аватара по умолчанию
      userData.pfpUrl = 'https://warpcast.com/~/default-avatar.png';
    }
    
    // Добавляем дополнительные поля, если они доступны
    if (user.profile && typeof user.profile.bio === 'string') {
      userData.bio = user.profile.bio;
    } else if (typeof user.bio === 'string') {
      userData.bio = user.bio;
    }
    
    // Проверяем наличие валидных полей перед возвратом
    if (userData.fid && userData.username) {
      return userData;
    } else {
      console.warn('[FarcasterContext] extractUserData: created user data but missing crucial fields');
      return null;
    }
  } catch (error) {
    console.error('[FarcasterContext] extractUserData: error extracting user data', error);
    return null;
  }
};

// Основной провайдер
export const FarcasterProvider: React.FC<FarcasterProviderProps> = ({ children }) => {
  const [sdkUser, setSdkUser] = useState<FarcasterUser | null>(null);
  const [sdkStatus, setSdkStatus] = useState<SdkStatus>('idle');
  const [sdkError, setSdkError] = useState<string | null>(null);

  // Функция для валидации пользователя через Neynar API и авторизации
  const validateAndLogin = async (message?: string, signature?: string): Promise<boolean> => {
    if (!sdkUser || !sdkUser.fid) {
      console.error('[FarcasterContext] validateAndLogin: No user data available');
      return false;
    }
    
    try {
      // Формируем параметры для аутентификации с правильными типами
      const loginParams: FarcasterLoginParams = {
        fid: sdkUser.fid,
        username: sdkUser.username || undefined,
        displayName: sdkUser.displayName || undefined,
        pfp: sdkUser.pfpUrl
      };
      
      // Добавляем параметры проверки подписи, если они предоставлены
      if (message && signature) {
        loginParams.message = message;
        loginParams.signature = signature;
      }
      
      // Отправляем запрос на валидацию и авторизацию
      const loginResult = await api.loginWithFarcaster(loginParams);
      
      if (!loginResult.success) {
        console.error('[FarcasterContext] Ошибка валидации через Neynar:', loginResult.error);
        return false;
      }
      
      console.log('[FarcasterContext] Пользователь успешно валидирован через Neynar');
      return true;
    } catch (error) {
      console.error('[FarcasterContext] Ошибка при валидации пользователя:', error);
      return false;
    }
  };
  
  useEffect(() => {
    let isMounted = true;
    console.log('[FarcasterContext] useEffect for SDK context RUNNING.');
    setSdkStatus('loading');
    setSdkError(null);

    const getFarcasterContext = async () => {
      try {
        let contextData: any = null;
        let source = 'unknown';
        
        // Используем стандартный Mini App SDK
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
          throw miniAppError; // Проброс ошибки для обработки ниже
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
          setSdkUser(null);
          setSdkStatus('error');
          setSdkError(`Context resolved, but missing user data or FID (source: ${source})`);
          logAuthError(AuthStep.FARCASTER_INIT, 'Context missing user data or FID', { context: contextData });
        }
      } catch (error: any) {
        console.error('[FarcasterContext] Error resolving or processing context:', error);
        
        if (isMounted) {
          setSdkUser(null);
          setSdkStatus('error');
          setSdkError(error.message || 'Failed to resolve or process context');
          logAuthError(AuthStep.FARCASTER_INIT, 'Error resolving or processing context', { error: error.message });
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
    validateAndLogin
  };

  return (
    <FarcasterContext.Provider value={value}>
      {children}
    </FarcasterContext.Provider>
  );
}; 