"use client"

import dynamic from "next/dynamic"
import LoadingScreen from "./components/LoadingScreen"

// Динамический импорт HomeContent без SSR
const HomeContent = dynamic(() => import("./components/HomeContent"), {
  ssr: false,
  loading: () => <LoadingScreen progress={0} statusMessage="Loading game..." />,
})

// Динамический импорт FarcasterFrameHandler с дополнительными проверками
const FarcasterFrameHandler = dynamic(
  () => import('./components/FarcasterFrameHandler'),
  { 
    ssr: false,
    loading: () => null 
  }
);

// Компонент-обертка для безопасного рендеринга клиентских компонентов
function ClientOnly({ children }: { children: React.ReactNode }) {
  return (
    <>{children}</>
  );
}

export default function Home() {
  return (
    <main>
      {/* 
        Безопасный рендеринг FarcasterFrameHandler только на клиенте
        Используем ClientOnly для дополнительной защиты от проблем с SSR
      */}
      <ClientOnly>
        <FarcasterFrameHandler />
      </ClientOnly>
      
      {/* Остальной контент страницы */}
      <HomeContent />
    </main>
  )
}

