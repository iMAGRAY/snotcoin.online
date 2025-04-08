'use client';

import React, { useEffect, useState } from 'react';
import { GameProvider } from './contexts';
import { FarcasterProvider, useFarcaster } from './contexts/FarcasterContext';
import LoadingScreen from './components/LoadingScreen';
import { ErrorDisplay } from './components/ErrorBoundary';
import { initFarcasterPatches } from './utils/farcasterPatches';
import { initWagmiPatches } from './utils/wagmiPatches';
import AudioController from './components/AudioController';

// Ключ для localStorage
const USER_ID_STORAGE_KEY = 'snotcoin_persistent_user_id';

// Обертка для управления состоянием загрузки SDK и отображения заглушки
const GameProviderWrapper = ({ children }: { children: React.ReactNode }) => {
  const { sdkStatus, sdkUser, sdkError } = useFarcaster();
  const [loggedStatus, setLoggedStatus] = useState<string | null>(null);
  const [persistentUserId, setPersistentUserId] = useState<string | null>(null);

  // При монтировании компонента проверяем localStorage на наличие сохраненного userId
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUserId = localStorage.getItem(USER_ID_STORAGE_KEY);
      if (savedUserId) {
        console.log(`[GameProviderWrapper] Найден сохраненный userId: ${savedUserId}`);
        setPersistentUserId(savedUserId);
      }
    }
  }, []);

  // Сохраняем userId если получен новый и нет сохраненного
  useEffect(() => {
    if (sdkStatus === 'ready' && sdkUser?.fid && !persistentUserId) {
      const newUserId = String(sdkUser.fid);
      console.log(`[GameProviderWrapper] Сохраняем новый userId: ${newUserId}`);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem(USER_ID_STORAGE_KEY, newUserId);
      }
      
      setPersistentUserId(newUserId);
    }
  }, [sdkStatus, sdkUser, persistentUserId]);

  // Логирование изменений статуса
  useEffect(() => {
    const currentStatusSignature = `${sdkStatus}-${sdkUser?.fid}-${sdkError}`;
    if (currentStatusSignature !== loggedStatus) {
      console.log(`[GameProviderWrapper] Status Update: sdkStatus=${sdkStatus}, sdkUserFid=${sdkUser?.fid}, persistentUserId=${persistentUserId}, sdkError=${sdkError}`);
      setLoggedStatus(currentStatusSignature);
    }
  }, [sdkStatus, sdkUser, sdkError, loggedStatus, persistentUserId]);

  // Пока SDK не готов или не произошла ошибка, показываем заглушку
  if (sdkStatus === 'idle' || sdkStatus === 'loading') {
    console.log(`[GameProviderWrapper] Showing loading placeholder: SDK Status=${sdkStatus}`);
    return <LoadingScreen progress={50} statusMessage="Connecting to Farcaster..." />;
  }

  // Если у нас есть сохраненный userId, используем его даже если SDK не готов
  if (persistentUserId) {
    console.log(`[GameProviderWrapper] Rendering GameProvider with persistentUserId: ${persistentUserId}`);
    return (
      <GameProvider userId={persistentUserId}>
        {children}
      </GameProvider>
    );
  }

  // Если произошла ошибка SDK и нет persistentUserId
  if (sdkStatus === 'error') {
    console.error(`[GameProviderWrapper] SDK Error: ${sdkError}. Rendering error display.`);
    return <ErrorDisplay message={sdkError instanceof Error ? sdkError.message : String(sdkError) || 'Failed to initialize Farcaster connection.'} />;
  }

  // Если SDK готов, но нет пользователя (маловероятно в Mini App, но для полноты)
  if (sdkStatus === 'ready' && !sdkUser?.fid) {
     console.warn('[GameProviderWrapper] SDK ready but no user FID found. Rendering error display.');
     return <ErrorDisplay message={'Farcaster user data not available.'} />;
  }

  // SDK готов и есть пользователь, но persistentUserId еще не установлен
  // Это должно выполниться только один раз при первом входе пользователя
  if (sdkStatus === 'ready' && sdkUser?.fid) {
    const newUserId = String(sdkUser.fid);
    console.log(`[GameProviderWrapper] First time setup - Using SDK FID as userId: ${newUserId}`);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_ID_STORAGE_KEY, newUserId);
    }
    
    return (
      <GameProvider userId={newUserId}>
        {children}
      </GameProvider>
    );
  }

  // Непредвиденное состояние
  console.error(`[GameProviderWrapper] Unexpected state: sdkStatus=${sdkStatus}, sdkUser=${sdkUser}, persistentUserId=${persistentUserId}, sdkError=${sdkError}`);
  return <ErrorDisplay message='An unexpected error occurred during initialization.' />;
};

// Инициализируем патчи для Farcaster и Wagmi
if (typeof window !== 'undefined') {
  initFarcasterPatches();
  initWagmiPatches();
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FarcasterProvider>
      <GameProviderWrapper>
        <AudioController />
        {children}
      </GameProviderWrapper>
    </FarcasterProvider>
  );
} 