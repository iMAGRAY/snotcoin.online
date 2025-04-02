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
import DevTools from './DevTools'

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

const HomeContent: React.FC = () => {
  const dispatch = useGameDispatch();
  const gameState = useGameState();
  const [viewportHeight, setViewportHeight] = React.useState("100vh");
  
  const readyCalledRef = useRef(false);
  
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

  const renderActiveTab = useCallback(() => {
    switch (gameState.activeTab) {
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
    return null;
  }

  return (
    <ErrorBoundary fallback={<ErrorDisplay message="Ошибка при отображении основного контента." />}>
      <MotionDiv className='main-game-container' style={{ height: viewportHeight }}>
        <Resources 
          isVisible={!gameState.hideInterface}
          activeTab={gameState.activeTab || "laboratory"}
          snot={gameState.inventory?.snot || 0}
          snotCoins={gameState.inventory?.snotCoins || 0}
          containerCapacity={gameState.inventory?.containerCapacity}
          containerLevel={gameState.inventory?.containerCapacityLevel}
          containerSnot={gameState.inventory?.containerSnot}
          containerFillingSpeed={gameState.inventory?.fillingSpeed}
          fillingSpeedLevel={gameState.inventory?.fillingSpeedLevel}          
        />
        {renderActiveTab()} 
        {!gameState.hideInterface && <TabBar />}
        {process.env.NODE_ENV === 'development' && <DevTools />}
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

