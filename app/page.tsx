"use client"

import dynamic from "next/dynamic"
import LoadingScreen from "./components/LoadingScreen"
import { useEffect, useState } from "react"
import { useGameDispatch, useGameState } from "./contexts"

// Динамический импорт HomeContent без SSR
const HomeContent = dynamic(() => import("./components/HomeContent"), {
  ssr: false,
  loading: () => <LoadingScreen progress={70} statusMessage="Loading Game Content..." />,
})

// Динамический импорт FarcasterFrameHandler с дополнительными проверками
const FarcasterFrameHandler = dynamic(
  () => import('./components/FarcasterFrameHandler'),
  { 
    ssr: false,
    loading: () => <LoadingScreen progress={40} statusMessage="Initializing Farcaster..." />,
  }
);

export default function Home() {
  const dispatch = useGameDispatch();
  const gameState = useGameState();
  const [isClient, setIsClient] = useState(false);
  const [isFarcasterInitializing, setIsFarcasterInitializing] = useState(false);
  
  // Проверка активной вкладки при загрузке страницы
  useEffect(() => {
    // Устанавливаем флаг, что мы на клиенте
    setIsClient(true);
    
    // Устанавливаем заголовок страницы для всех устройств
    document.title = "KingCoin - Merge Game";
    
    // Проверяем, открыты ли мы из Farcaster фрейма
    const isFromFrame = typeof window !== 'undefined' && (
      window.location.search.includes('embed=') || 
      window.location.search.includes('frame=') ||
      window.location.search.includes('fc=')
    );
    
    if (isFromFrame) {
      console.log('[Home] Opened from Farcaster frame');
      
      // Отмечаем, что мы находимся в процессе инициализации Farcaster
      setIsFarcasterInitializing(true);
      
      // Устанавливаем приоритет для загрузки Farcaster-компонентов
      // Это может помочь быстрее отобразить контент в Farcaster клиенте
      if (typeof window !== 'undefined') {
        try {
          // Предзагрузка критических ресурсов для Farcaster
          const link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'script';
          link.href = 'https://esm.sh/@farcaster/frame-sdk';
          document.head.appendChild(link);
        } catch (e) {
          console.error('[Home] Error preloading Farcaster SDK:', e);
        }
      }
    }
    
    const validTabs = ["merge", "laboratory", "storage", "quests", "profile"];
    const isValidTab = gameState.activeTab && validTabs.includes(gameState.activeTab);
    
    if (!isValidTab) {
      console.log(`[HomeContent] Некорректное значение activeTab: "${gameState.activeTab}". Устанавливаем "laboratory"`);
      dispatch(prevState => ({
        ...prevState,
        activeTab: "laboratory"
      }));
    }
  }, [dispatch, gameState.activeTab]);

  // На сервере и до гидратации показываем заглушку
  if (!isClient) {
    return <LoadingScreen progress={20} statusMessage="Initializing Game..." />;
  }

  return (
    <main>
      {/* Обработчик Farcaster фрейма */}
      <FarcasterFrameHandler />
      
      {/* Основной контент страницы */}
      <HomeContent />
    </main>
  )
}

