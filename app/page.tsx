"use client"

import dynamic from "next/dynamic"
import LoadingScreen from "./components/LoadingScreen"

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
  return (
    <main>
      {/* Обработчик Farcaster фрейма */}
      <FarcasterFrameHandler />
      
      {/* Основной контент страницы */}
      <HomeContent />
    </main>
  )
}

