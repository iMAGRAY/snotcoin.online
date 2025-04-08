"use client"

import dynamic from "next/dynamic"
import LoadingScreen from "./components/LoadingScreen"
import { useEffect } from "react"
import { useGameDispatch, useGameState } from "./contexts"

// Динамический импорт HomeContent без SSR
const HomeContent = dynamic(() => import("./components/HomeContent"), {
  ssr: false,
  loading: () => null,
})

// Динамический импорт FarcasterFrameHandler с дополнительными проверками
const FarcasterFrameHandler = dynamic(
  () => import('./components/FarcasterFrameHandler'),
  { 
    ssr: false,
    loading: () => null 
  }
);

export default function Home() {
  const dispatch = useGameDispatch();
  const gameState = useGameState();
  
  // Проверка активной вкладки при загрузке страницы
  useEffect(() => {
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
  
  return (
    <main>
      {/* Обработчик Farcaster фрейма */}
      <FarcasterFrameHandler />
      
      {/* Основной контент страницы */}
      <HomeContent />
    </main>
  )
}

