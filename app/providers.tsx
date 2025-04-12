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

// Компонент для предотвращения ошибок гидратации
const ClientOnly = ({ children }: { children: React.ReactNode }) => {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) {
    return null;
  }
  
  return <>{children}</>;
};

// Обертка для управления состоянием загрузки SDK и отображения заглушки
const GameProviderWrapper = ({ children }: { children: React.ReactNode }) => {
  const { sdkUser, sdkStatus, sdkError } = useFarcaster();
  const [isClient, setIsClient] = useState(false);
  const [forceContinue, setForceContinue] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  
  // Сохраняем userId в localStorage для последующих сессий
  const [persistentUserId, setPersistentUserId] = useState<string | null>(null);
  
  // При первом рендере на клиенте
  useEffect(() => {
    setIsClient(true);
    
    // Определяем, запущено ли на десктопе
    const desktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    setIsDesktop(desktop);
    
    console.log(`[GameProviderWrapper] Platform: ${desktop ? 'desktop' : 'mobile'}`);
    
    // На десктопе сразу активируем принудительное продолжение для ускорения загрузки
    if (desktop) {
      setForceContinue(true);
    }
    
    // Проверяем наличие сохраненного userId в localStorage
    try {
      const storedUserId = localStorage.getItem('snot_user_id');
      if (storedUserId) {
        setPersistentUserId(storedUserId);
        console.log(`[GameProviderWrapper] Loaded persistent userId: ${storedUserId}`);
      } else if (desktop) {
        // На десктопе сразу создаем анонимный ID, если нет сохраненного
        const anonymousId = `anonymous_${Date.now()}`;
        localStorage.setItem('snot_user_id', anonymousId);
        setPersistentUserId(anonymousId);
        console.log(`[GameProviderWrapper] Created desktop anonymous userId: ${anonymousId}`);
      }
    } catch (e) {
      console.warn('[GameProviderWrapper] Error accessing localStorage:', e);
      
      // В случае ошибки localStorage на десктопе всё равно создаем ID в памяти
      if (desktop) {
        const fallbackId = `fallback_${Date.now()}`;
        setPersistentUserId(fallbackId);
        console.log(`[GameProviderWrapper] Created fallback userId due to localStorage error: ${fallbackId}`);
      }
    }
    
    // Устанавливаем таймаут только для мобильных устройств
    if (!desktop) {
      const forceTimeout = setTimeout(() => {
        console.log('[GameProviderWrapper] Принудительное продолжение после таймаута');
        setForceContinue(true);
      }, 5000);
      
      return () => clearTimeout(forceTimeout);
    }
    
    // Явно возвращаем undefined для путей выполнения без функции очистки
    return undefined;
  }, []);

  // Обработка обновления persistentUserId при получении данных пользователя
  useEffect(() => {
    if (sdkUser?.fid && isClient) {
      const newUserId = String(sdkUser.fid);
      setPersistentUserId(newUserId);
      
      try {
        localStorage.setItem('snot_user_id', newUserId);
        console.log(`[GameProviderWrapper] Saved userId to localStorage: ${newUserId}`);
      } catch (e) {
        console.warn('[GameProviderWrapper] Error saving userId to localStorage:', e);
      }
    }
    
    // Явно возвращаем undefined, так как нет функции очистки
    return undefined;
  }, [sdkUser?.fid, isClient]);

  // Для SSR или до гидратации - показываем базовый экран загрузки только на мобильных
  if (!isClient) {
    return (
      <ClientOnly>
        <LoadingScreen progress={30} statusMessage="Connecting to Farcaster..." />
      </ClientOnly>
    );
  }

  // Если у нас есть сохраненный userId или включен forceContinue,
  // пропускаем экран загрузки и сразу переходим к игре
  if (persistentUserId || forceContinue) {
    // Используем persistentUserId если есть, иначе создаем временный анонимный ID
    const userId = persistentUserId || `tmp_anonymous_${Date.now()}`;
    
    if (!persistentUserId) {
      console.log(`[GameProviderWrapper] Using temporary anonymous userId: ${userId}`);
    } else {
      console.log(`[GameProviderWrapper] Rendering GameProvider with userId: ${userId}`);
    }
    
    return (
      <GameProvider userId={userId}>
        {children}
      </GameProvider>
    );
  }

  // Последний шанс - показываем экран загрузки для мобильных устройств
  if ((sdkStatus === 'idle' || sdkStatus === 'loading')) {
    console.log(`[GameProviderWrapper] Showing loading placeholder: SDK Status=${sdkStatus}`);
    return (
      <ClientOnly>
        <LoadingScreen progress={30} statusMessage="Connecting to Farcaster..." />
      </ClientOnly>
    );
  }

  // Для всех остальных случаев создаем запасной анонимный ID
  const fallbackId = `fallback_${Date.now()}`;
  console.warn(`[GameProviderWrapper] Using fallback userId in unexpected state: ${fallbackId}`);
  
  return (
    <GameProvider userId={fallbackId}>
      {children}
    </GameProvider>
  );
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