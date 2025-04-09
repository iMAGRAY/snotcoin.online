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

const HomeContent: React.FC = () => {
  const dispatch = useGameDispatch();
  const gameState = useGameState();
  const [viewportHeight, setViewportHeight] = React.useState("100vh");
  
  const readyCalledRef = useRef(false);
  
  // Добавляем логирование при монтировании компонента
  useEffect(() => {
    console.log('[HomeContent] Компонент смонтирован', {
      isLoading: gameState.isLoading,
      hideInterface: gameState.hideInterface,
      activeTab: gameState.activeTab,
      dataSource: gameState._dataSource,
      lastAction: gameState._lastAction
    });

    // Если интерфейс скрыт, показываем его
    if (gameState.hideInterface) {
      console.log('[HomeContent] Принудительно показываем интерфейс');
      dispatch(prevState => ({
        ...prevState,
        hideInterface: false
      }));
    }
  }, []);
  
  // Проверка и установка активной вкладки при монтировании
  useEffect(() => {
    const validTabs = ["merge", "laboratory", "storage", "quests", "profile"];
    const isValidTab = gameState.activeTab && validTabs.includes(gameState.activeTab);
    
    // Проверяем, является ли это первым входом (нет сохраненного состояния)
    const isFirstEntry = gameState._dataSource === 'new' || !gameState._lastAction;
    
    console.log('[HomeContent] Проверка активной вкладки:', {
      currentTab: gameState.activeTab,
      isValidTab,
      isFirstEntry,
      dataSource: gameState._dataSource,
      hideInterface: gameState.hideInterface
    });
    
    // Устанавливаем лабораторию как активную вкладку только при первом входе
    // или если текущая вкладка некорректна
    if (!isValidTab || isFirstEntry) {
      console.log(`[HomeContent] ${isFirstEntry ? 'Первый вход' : 'Некорректное значение activeTab'}. Устанавливаем "laboratory"`);
      // Устанавливаем лабораторию как активную вкладку по умолчанию
      dispatch(prevState => ({
        ...prevState,
        activeTab: "laboratory"
      }));
    }
  }, [gameState.activeTab, gameState._dataSource, gameState._lastAction, dispatch]);
  
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

  // Добавляем эффект для отслеживания изменений hideInterface
  useEffect(() => {
    console.log('[HomeContent] Изменение состояния интерфейса:', {
      hideInterface: gameState.hideInterface,
      activeTab: gameState.activeTab,
      isLoading: gameState.isLoading,
      dataSource: gameState._dataSource,
      lastAction: gameState._lastAction,
      gameStarted: gameState.gameStarted,
      isGameInstanceRunning: gameState.isGameInstanceRunning
    });
  }, [gameState.hideInterface, gameState.activeTab, gameState.isLoading, gameState._dataSource, gameState._lastAction, gameState.gameStarted, gameState.isGameInstanceRunning]);

  const renderActiveTab = useCallback(() => {
    // Используем явную проверку на наличие activeTab с установкой дефолтного значения
    const currentTab = gameState.activeTab || "laboratory";
    
    console.log('[HomeContent] Рендеринг активной вкладки:', {
      currentTab,
      hideInterface: gameState.hideInterface,
      isLoading: gameState.isLoading,
      dataSource: gameState._dataSource,
      lastAction: gameState._lastAction
    });
    
    switch (currentTab) {
      case "merge":
        return <Merge />;
      case "storage":
        return <Storage />;
      case "profile":
        return <ProfilePage />;
      case "quests":
        return <Quests />;
      case "laboratory":
      default:
        return <Laboratory />;
    }
  }, [gameState.activeTab]);

  if (gameState.isLoading) {
    console.log('[HomeContent] Игровое состояние загружается, возвращаем null');
    return null;
  }

  console.log('[HomeContent] Рендеринг компонента:', {
    hideInterface: gameState.hideInterface,
    activeTab: gameState.activeTab,
    shouldShowTabBar: !gameState.hideInterface,
    shouldShowResources: !gameState.hideInterface
  });

  return (
    <ErrorBoundary fallback={<ErrorDisplay message="Ошибка при отображении основного контента." />}>
      <MotionDiv className='main-game-container' style={{ height: viewportHeight }}>
        {!gameState.hideInterface ? (
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
        ) : (
          <div style={{ display: 'none' }}>Resources hidden</div>
        )}
        {renderActiveTab()} 
        {!gameState.hideInterface ? (
          <TabBar />
        ) : (
          <div style={{ display: 'none' }}>TabBar hidden</div>
        )}
        {!gameState.hideInterface ? (
          <SaveIndicator />
        ) : (
          <div style={{ display: 'none' }}>SaveIndicator hidden</div>
        )}
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

