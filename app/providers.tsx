'use client';

import React, { useEffect, useState } from 'react';
import { GameProvider } from './contexts';
import { FarcasterProvider, useFarcaster } from './contexts/FarcasterContext';
import LoadingScreen from './components/LoadingScreen';
import { ErrorDisplay } from './components/ErrorBoundary';
import { initFarcasterPatches } from './utils/farcasterPatches';
import { initWagmiPatches } from './utils/wagmiPatches';
import AudioController from './components/AudioController';

// Constant for the user ID storage key
const USER_ID_STORAGE_KEY = 'kingcoin_persistent_user_id';

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
    
    // Добавляем страховку от ошибок инициализации Farcaster SDK
    const farcasterTimeout = setTimeout(() => {
      // Если статус все еще idle или loading после таймаута, продолжаем без него
      if (sdkStatus === 'idle' || sdkStatus === 'loading') {
        console.warn('[GameProviderWrapper] Farcaster SDK не инициализировался вовремя, продолжаем без него');
        setForceContinue(true);
      }
    }, 3000); // 3 секунды ожидания SDK
    
    // На десктопе сразу активируем принудительное продолжение для ускорения загрузки
    if (desktop) {
      setForceContinue(true);
    }
    
    // Проверяем наличие сохраненного userId в localStorage
    try {
      const storedUserId = localStorage.getItem(USER_ID_STORAGE_KEY);
      if (storedUserId) {
        setPersistentUserId(storedUserId);
        console.log(`[GameProviderWrapper] Loaded persistent userId: ${storedUserId}`);
      } else if (desktop) {
        // На десктопе сразу создаем анонимный ID, если нет сохраненного
        const anonymousId = `anonymous_${Date.now()}`;
        localStorage.setItem(USER_ID_STORAGE_KEY, anonymousId);
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
      
      return () => {
        clearTimeout(forceTimeout);
        clearTimeout(farcasterTimeout);
      }
    }
    
    return () => {
      clearTimeout(farcasterTimeout);
    };
  }, [sdkStatus]);

  // Обработка обновления persistentUserId при получении данных пользователя
  useEffect(() => {
    if (sdkUser?.fid && isClient) {
      const newUserId = String(sdkUser.fid);
      setPersistentUserId(newUserId);
      
      try {
        localStorage.setItem(USER_ID_STORAGE_KEY, newUserId);
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

  // Показываем экран загрузки для мобильных устройств
  if ((sdkStatus === 'idle' || sdkStatus === 'loading')) {
    console.log(`[GameProviderWrapper] Showing loading placeholder: SDK Status=${sdkStatus}`);
    return (
      <ClientOnly>
        <LoadingScreen progress={30} statusMessage="Connecting to Farcaster..." />
      </ClientOnly>
    );
  }

  // Дополнительно проверяем на ошибки SDK и используем базовый ID
  if (sdkStatus === 'error') {
    console.warn(`[GameProviderWrapper] SDK error detected, using fallback userId`);
    
    // Создаем запасной ID с пометкой об ошибке SDK
    const errorFallbackId = `sdk_error_${Date.now()}`;
    
    // Сохраняем в localStorage для консистентности
    if (isClient) {
      try {
        localStorage.setItem(USER_ID_STORAGE_KEY, errorFallbackId);
      } catch (e) {
        console.warn('[GameProviderWrapper] Error saving errorFallbackId to localStorage', e);
      }
    }
    
    return (
      <GameProvider userId={errorFallbackId}>
        {children}
      </GameProvider>
    );
  }

  // Для всех остальных случаев создаем запасной анонимный ID
  const fallbackId = `fallback_${Date.now()}`;
  console.warn(`[GameProviderWrapper] Using fallback userId in unexpected state: ${fallbackId}`);
  
  // Добавляем сохранение fallbackId в localStorage, чтобы id сохранился при перезагрузке
  if (isClient) {
    try {
      localStorage.setItem(USER_ID_STORAGE_KEY, fallbackId);
      console.log(`[GameProviderWrapper] Сохранили fallback userId: ${fallbackId}`);
    } catch (e) {
      console.warn('[GameProviderWrapper] Ошибка при сохранении fallback userId:', e);
    }
  }
  
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