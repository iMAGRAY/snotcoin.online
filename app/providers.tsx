'use client';

import React, { useEffect, useState } from 'react';
// import { AuthProvider } from "./hooks/useAuth"; // Убираем импорт AuthProvider
import { GameProvider } from './contexts';
import { FarcasterProvider, useFarcaster } from './contexts/FarcasterContext';
import { FarcasterUser } from './types/farcaster';
import LoadingScreen from './components/LoadingScreen';
import { ErrorDisplay } from './components/ErrorBoundary';
import WarpcastDevMode from './components/DevTools/WarpcastDevMode';
import { activateFarcasterDevMock, isFarcasterDevMockActive } from './utils/devTools/farcasterDevMock';

// Модифицированная версия WarpcastDevMode без кнопки активации
const WarpcastDevModeWithoutButton = ({ children }: { children: React.ReactNode }) => {
  // Просто рендерим детей без кнопки активации
  return <>{children}</>;
};

// Обертка для активации режима разработки для обхода проблем с инициализацией
const DevModeActivator = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && !isFarcasterDevMockActive()) {
      // Принудительно активируем режим разработки
      console.log('[DevModeActivator] Принудительная активация режима разработки');
      
      const mockUser = {
        fid: 123456789,
        username: 'dev_user',
        displayName: 'Dev User',
        pfpUrl: 'https://cdn.warpcast.com/profile-pictures/default-profile.png'
      };
      
      activateFarcasterDevMock(mockUser);
    }
  }, []);
  
  return <>{children}</>;
};

// Обертка для управления состоянием загрузки SDK и отображения заглушки
const GameProviderWrapper = ({ children }: { children: React.ReactNode }) => {
  const { sdkStatus, sdkUser, sdkError } = useFarcaster();
  const [loggedStatus, setLoggedStatus] = useState<string | null>(null);

  // Логирование изменений статуса
  useEffect(() => {
    const currentStatusSignature = `${sdkStatus}-${sdkUser?.fid}-${sdkError}`;
    if (currentStatusSignature !== loggedStatus) {
      console.log(`[GameProviderWrapper] Status Update: sdkStatus=${sdkStatus}, sdkUserFid=${sdkUser?.fid}, sdkError=${sdkError}`);
      setLoggedStatus(currentStatusSignature);
    }
  }, [sdkStatus, sdkUser, sdkError, loggedStatus]);

  // Пока SDK не готов или не произошла ошибка, показываем заглушку
  if (sdkStatus === 'idle' || sdkStatus === 'loading') {
    console.log(`[GameProviderWrapper] Showing loading placeholder: SDK Status=${sdkStatus}`);
    return <LoadingScreen progress={50} statusMessage="Connecting to Farcaster..." />;
  }

  // Если произошла ошибка SDK
  if (sdkStatus === 'error') {
    console.error(`[GameProviderWrapper] SDK Error: ${sdkError}. Rendering error display.`);
    return <ErrorDisplay message={sdkError || 'Failed to initialize Farcaster connection.'} />;
  }

  // Если SDK готов, но нет пользователя (маловероятно в Mini App, но для полноты)
  if (sdkStatus === 'ready' && !sdkUser?.fid) {
     console.warn('[GameProviderWrapper] SDK ready but no user FID found. Rendering error display.');
     return <ErrorDisplay message={'Farcaster user data not available.'} />;
  }

  // SDK готов и есть пользователь
  if (sdkStatus === 'ready' && sdkUser?.fid) {
    // Передаем fid как userId в GameProvider
    console.log(`[GameProviderWrapper] Rendering GameProvider with userId (from SDK FID): ${sdkUser.fid} (SDK OK)`);
    return (
      <GameProvider userId={String(sdkUser.fid)} >
        {children}
      </GameProvider>
    );
  }

  // Непредвиденное состояние
  console.error(`[GameProviderWrapper] Unexpected state: sdkStatus=${sdkStatus}, sdkUser=${sdkUser}, sdkError=${sdkError}`);
  return <ErrorDisplay message='An unexpected error occurred during initialization.' />;
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DevModeActivator>
      <FarcasterProvider>
        {/* Убираем AuthProvider */}
        <GameProviderWrapper>
          <WarpcastDevModeWithoutButton>
            {children}
          </WarpcastDevModeWithoutButton>
        </GameProviderWrapper>
      </FarcasterProvider>
    </DevModeActivator>
  );
} 