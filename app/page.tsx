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
  
  // Проверка активной вкладки при загрузке страницы
  useEffect(() => {
    // Устанавливаем флаг, что мы на клиенте
    setIsClient(true);
    
    // Устанавливаем заголовок страницы для всех устройств
    document.title = "SnotCoin - Merge Game";
    
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

