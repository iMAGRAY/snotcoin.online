'use client';

import React, { useEffect, useState } from 'react';
// import { AuthProvider } from "./hooks/useAuth"; // Убираем импорт AuthProvider
import { GameProvider } from './contexts';
import { FarcasterProvider, useFarcaster } from './contexts/FarcasterContext';
import { FarcasterUser } from './types/farcaster';
import LoadingScreen from './components/LoadingScreen';
import { ErrorDisplay } from './components/ErrorBoundary';
import { GameSaverService } from './services/game'; // Импортируем через индексный файл
import { ToastProvider } from './components/ui/use-toast'; // Исправляем путь импорта

// Обертка для управления состоянием загрузки SDK и отображения заглушки
const GameProviderWrapper = ({ children }: { children: React.ReactNode }) => {
  const { sdkStatus, sdkUser, sdkError } = useFarcaster();
  const [loggedStatus, setLoggedStatus] = useState<string | null>(null);

  // Логирование изменений статуса - только при изменении статуса
  useEffect(() => {
    const currentStatusSignature = `${sdkStatus}-${sdkUser?.fid}-${sdkError}`;
    if (currentStatusSignature !== loggedStatus) {
      // Логируем только значимые изменения, не захламляя консоль
      if (sdkError) {
        console.log(`[GameProviderWrapper] Status Update: sdkStatus=${sdkStatus}, sdkUserFid=${sdkUser?.fid}, sdkError=${sdkError}`);
      } else if (sdkStatus === 'ready' && sdkUser?.fid) {
        console.log(`[GameProviderWrapper] Authenticated! User FID: ${sdkUser.fid}`);
      }
      setLoggedStatus(currentStatusSignature);
    }
  }, [sdkStatus, sdkUser, sdkError, loggedStatus]);

  // Пока SDK не готов, показываем заглушку без лишних логов
  if (sdkStatus === 'idle' || sdkStatus === 'loading') {
    return <LoadingScreen progress={50} statusMessage="Connecting to Farcaster..." />;
  }

  // Если произошла ошибка SDK
  if (sdkStatus === 'error') {
    console.error(`[GameProviderWrapper] SDK Error: ${sdkError}`);
    return <ErrorDisplay message={sdkError || 'Failed to initialize Farcaster connection.'} />;
  }

  // Если SDK готов, но нет пользователя (маловероятно в Mini App, но для полноты)
  if (sdkStatus === 'ready' && !sdkUser?.fid) {
     console.warn('[GameProviderWrapper] SDK ready but no user FID found');
     return <ErrorDisplay message={'Farcaster user data not available.'} />;
  }

  // SDK готов и есть пользователь - оборачиваем GameProvider в GameSaver
  if (sdkStatus === 'ready' && sdkUser?.fid) {
    return (
      <GameProvider userId={String(sdkUser.fid)}>
        <ToastProvider>
          <GameSaverService debugMode={true}> {/* Обновляем имя компонента */}
            {children}
          </GameSaverService>
        </ToastProvider>
      </GameProvider>
    );
  }

  // Непредвиденное состояние
  console.error(`[GameProviderWrapper] Unexpected state`);
  return <ErrorDisplay message='An unexpected error occurred during initialization.' />;
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FarcasterProvider>
      {/* Убираем AuthProvider */}
      <GameProviderWrapper>
        {children}
      </GameProviderWrapper>
    </FarcasterProvider>
  );
} 