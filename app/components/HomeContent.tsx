"use client"

import React, { useRef, useEffect, useCallback, useMemo, Suspense, useState } from "react"
import { AnimatePresence } from "framer-motion"
import dynamic from "next/dynamic"
import { useGameState, useGameDispatch } from "../contexts"
import { useFarcaster } from "../contexts/FarcasterContext"
import { MotionDiv } from "./motion/MotionWrapper"
const LoadingScreen = dynamic(() => import("./LoadingScreen"), {
  ssr: false,
})
import { ErrorBoundary, ErrorDisplay } from "./ErrorBoundary"

// Импортируем SDK для Mini Apps
import { sdk } from '@farcaster/frame-sdk'

// Dynamically import components that use browser APIs
const Laboratory = dynamic(() => import("./game/laboratory/laboratory"), {
  ssr: false,
  loading: () => <LoadingScreen progress={25} statusMessage="Loading Laboratory..." />,
})

const Storage = dynamic(() => import("./game/storage/Storage"), {
  ssr: false,
  loading: () => <LoadingScreen progress={25} statusMessage="Loading Storage..." />,
})

const TabBar = dynamic(() => import("./TabBar/TabBar"), {
  ssr: false,
  loading: () => <LoadingScreen progress={25} statusMessage="Loading Navigation..." />,
})

const ProfilePage = dynamic(() => import("./game/profile/ProfilePage"), {
  ssr: false,
  loading: () => <LoadingScreen progress={25} statusMessage="Loading Profile..." />,
})

const Resources = dynamic(() => import("./common/Resources"), {
  ssr: false,
  loading: () => <LoadingScreen progress={25} statusMessage="Loading Resources..." />,
})

const Quests = dynamic(() => import("./game/quests/Quests"), {
  ssr: false,
  loading: () => <LoadingScreen progress={25} statusMessage="Loading Quests..." />,
})

const Merge = dynamic(() => import("./game/merge/Merge"), {
  ssr: false,
  loading: () => <LoadingScreen progress={25} statusMessage="Loading Merge..." />,
})

const SaveIndicator = dynamic(() => import("./game/SaveIndicator"), {
  ssr: false,
})

// Маппинг активных вкладок на соответствующие компоненты
const TABS: Record<string, JSX.Element> = {
  laboratory: <Laboratory />,
  merge: <Merge />,
  storage: <Storage />,
  profile: <ProfilePage />,
  quests: <Quests />
};

const HomeContent: React.FC = () => {
  const gameState = useGameState();
  const dispatch = useGameDispatch();
  const { sdkUser, sdkStatus } = useFarcaster();
  const [isClient, setIsClient] = useState(false);
  const [viewportHeight, setViewportHeight] = React.useState("100vh");
  const [forceLoaded, setForceLoaded] = useState(false);
  
  const readyCalledRef = useRef(false);
  
  // Проверка и установка активной вкладки при монтировании
  useEffect(() => {
    const validTabs = ["merge", "laboratory", "storage", "quests", "profile"];
    const isValidTab = gameState.activeTab && validTabs.includes(gameState.activeTab);
    
    if (!isValidTab) {
      console.log(`[HomeContent] Некорректное значение activeTab: "${gameState.activeTab}". Устанавливаем "laboratory"`);
      // Устанавливаем лабораторию как активную вкладку по умолчанию
      dispatch(prevState => ({
        ...prevState,
        activeTab: "laboratory"
      }));
    }
  }, [gameState.activeTab, dispatch]);
  
  // Принудительно устанавливаем флаг загрузки при монтировании компонента
  useEffect(() => {
    console.log("[HomeContent] Компонент смонтирован, проверка состояния загрузки:", gameState.isLoading);
    
    // Принудительно завершаем загрузку после монтирования компонента
    const initialLoadTimeout = setTimeout(() => {
      console.log("[HomeContent] Принудительная загрузка сразу после монтирования");
      setForceLoaded(true);
      dispatch(prevState => ({
        ...prevState,
        isLoading: false
      }));
    }, 1000);
    
    return () => clearTimeout(initialLoadTimeout);
  }, [dispatch]);
  
  // Добавляем таймер для принудительной загрузки, если gameState.isLoading остается true слишком долго
  useEffect(() => {
    if (gameState.isLoading) {
      console.log("[HomeContent] Обнаружено состояние gameState.isLoading=true, запускаем таймаут");
      const forceLoadTimeout = setTimeout(() => {
        console.log("[HomeContent] Принудительная загрузка после таймаута");
        setForceLoaded(true);
        // Дополнительно пытаемся обновить состояние загрузки в gameState
        dispatch(prevState => ({
          ...prevState,
          isLoading: false
        }));
      }, 3000); // Уменьшаем до 3 секунд ожидания
      
      return () => clearTimeout(forceLoadTimeout);
    }
    
    // Явно возвращаем undefined для путей, где нет функции очистки
    return undefined;
  }, [gameState.isLoading, dispatch]);
  
  useEffect(() => {
    if (!gameState.isLoading && !readyCalledRef.current) {
      // Только один вызов для SDK Ready
      const callReady = async () => {
        try {
          await sdk.actions.ready();
          readyCalledRef.current = true;
        } catch (error) {
          console.error('[HomeContent] Error calling sdk.actions.ready():', error);
        }
      };
      callReady();
    }
    
    // Явно возвращаем undefined для путей, где нет функции очистки
    return undefined;
  }, [gameState.isLoading]);

  useEffect(() => {
    const fixViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
      setViewportHeight(`${window.innerHeight}px`);
    };

    fixViewportHeight();
    window.addEventListener("resize", fixViewportHeight);
    return () => window.removeEventListener("resize", fixViewportHeight);
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Отображаем экран загрузки вместо возврата null
  if (gameState.isLoading && !forceLoaded) {
    console.log("[HomeContent] Показываем экран загрузки с прогрессом 90%");
    return <LoadingScreen progress={90} statusMessage="Preparing game..." />;
  }
  
  // Если мы на сервере или до гидратации, показываем общий экран загрузки
  if (!isClient) {
    return <LoadingScreen progress={80} statusMessage="Preparing UI..." />;
  }

  console.log("[HomeContent] Рендерим основной контент, activeTab:", gameState.activeTab);
  const Component = TABS[gameState.activeTab] || TABS.merge;
  
  return (
    <ErrorBoundary fallback={<ErrorDisplay message="Ошибка при отображении основного контента." />}>
      <MotionDiv className='main-game-container' style={{ height: viewportHeight }}>
        <Resources 
          isVisible={!gameState.hideInterface}
          activeTab={gameState.activeTab || "laboratory"}
          snot={gameState.inventory?.snot || 0}
          snotCoins={gameState.inventory?.snotCoins || 0}
          containerCapacity={gameState.inventory?.containerCapacity}
          containerLevel={gameState.container?.level ?? 0}
          containerSnot={gameState.inventory?.containerSnot}
          containerFillingSpeed={gameState.inventory?.fillingSpeed}
          fillingSpeedLevel={gameState.inventory?.fillingSpeedLevel}          
        />
        {Component} 
        {!gameState.hideInterface && <TabBar />}
        {!gameState.hideInterface && <SaveIndicator />}
      </MotionDiv>
    </ErrorBoundary>
  );
};

const HomeContentWrapper: React.FC = () => (
  <ErrorBoundary fallback={<ErrorDisplay message="Произошла критическая ошибка загрузки HomeContent." />}>
    <Suspense fallback={<LoadingScreen progress={100} statusMessage="Finalizing..." />}>
      <HomeContent />
    </Suspense>
  </ErrorBoundary>
);

export default HomeContentWrapper;

