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
// Импортируем компонент с кнопками Farcaster
import FarcasterButtons from './FarcasterButtons'

// Переменная для включения детальных логов (можно переключить в консоли браузера)
const ENABLE_DETAILED_LOGS = false;

/**
 * Логгер с возможностью отключения логов
 */
const logger = {
  log: (message: string, data?: any) => {
    // Выводим логи только если включены детальные логи или это важное сообщение
    if (ENABLE_DETAILED_LOGS || 
        message.includes('Ошибка') || 
        message.includes('Error') || 
        message.includes('Первая инициализация') || 
        (message.includes('ready()') && !message.includes('интерфейс'))) {
      console.log(message, data || '');
    }
  },
  error: (message: string, error?: any) => {
    // Ошибки всегда выводим
    console.error(message, error || '');
  }
};

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
  const [interfaceReady, setInterfaceReady] = useState(false);
  
  // Флаг для отслеживания, было ли уже показано системное окно
  const addAppModalShownRef = useRef(false);
  const readyCalledRef = useRef(false);
  const allComponentsLoadedRef = useRef(false);
  
  // Добавляем состояние для принудительного отображения интерфейса
  const [forceShowInterface, setForceShowInterface] = useState(false);
  
  // Флаг для отслеживания активной игры в Merge - по умолчанию false
  const [isMergeGameActive, setIsMergeGameActive] = useState(false);

  // При первом монтировании компонента гарантируем, что hideInterface=false
  useEffect(() => {
    logger.log("[HomeContent] Первая инициализация, проверка интерфейса:", 
      {hideInterface: gameState.hideInterface, activeTab: gameState.activeTab});
      
    // Сбрасываем hideInterface при старте приложения
    if (gameState.hideInterface) {
      logger.log("[HomeContent] Обнаружено hideInterface=true при старте, устанавливаем false");
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
    
    if (!isValidTab) {
      logger.log(`[HomeContent] Некорректное значение activeTab: "${gameState.activeTab}". Устанавливаем "laboratory"`);
      // Устанавливаем лабораторию как активную вкладку по умолчанию
      dispatch(prevState => ({
        ...prevState,
        activeTab: "laboratory"
      }));
    }
  }, [gameState.activeTab, dispatch]);
  
  // Принудительно устанавливаем флаг загрузки при монтировании компонента
  useEffect(() => {
    logger.log("[HomeContent] Компонент смонтирован, проверка состояния загрузки:", gameState.isLoading);
    
    // Принудительно завершаем загрузку после монтирования компонента
    const initialLoadTimeout = setTimeout(() => {
      logger.log("[HomeContent] Принудительная загрузка сразу после монтирования");
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
      logger.log("[HomeContent] Обнаружено состояние gameState.isLoading=true, запускаем таймаут");
      const forceLoadTimeout = setTimeout(() => {
        logger.log("[HomeContent] Принудительная загрузка после таймаута");
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
  
  // Оптимизированный вызов sdk.actions.ready()
  useEffect(() => {
    // Вызываем ready() только когда все условия загрузки выполнены
    const callReady = async () => {
      // Проверяем, что ready() еще не был вызван
      if (readyCalledRef.current) return;
      
      // Проверяем, что все условия для отображения интерфейса выполнены
      if (!gameState.isLoading && isClient && interfaceReady) {
        try {
          logger.log('[HomeContent] Calling sdk.actions.ready() - interface is ready');
          
          // Вызываем ready() с настройками для лучшего UX
          await sdk.actions.ready({
            // Если в игре есть жесты, конфликтующие с нативными,
            // можно включить эту опцию
            // disableNativeGestures: true
          });
          
          // Отмечаем, что ready() был вызван
          readyCalledRef.current = true;
          
          // Проверяем, добавлено ли приложение в избранное
          try {
            const context = await sdk.context;
            const isAppAdded = context?.client?.added || false;
            
            logger.log('[HomeContent] App already added to favorites:', isAppAdded);
            
            // Если приложение еще не добавлено, вызываем системное окно добавления
            if (!isAppAdded && !addAppModalShownRef.current) {
              // Отмечаем, что запрос был показан
              addAppModalShownRef.current = true;
              
              // Небольшая задержка перед показом системного диалога
              setTimeout(async () => {
                try {
                  logger.log('[HomeContent] Showing system add app dialog');
                  // Вызываем системное окно добавления приложения
                  const result = await sdk.actions.addFrame();
                  logger.log('[HomeContent] System add app result:', result);
                } catch (error) {
                  logger.error('[HomeContent] Error showing system add app dialog:', error);
                }
              }, 1000);
            }
          } catch (error) {
            logger.error('[HomeContent] Error checking if app is added:', error);
          }
        } catch (error) {
          logger.error('[HomeContent] Error calling sdk.actions.ready():', error);
        }
      }
    };
    
    callReady();
  }, [gameState.isLoading, isClient, interfaceReady]);

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
  
  // Отметка о готовности интерфейса, когда все условия выполнены
  useEffect(() => {
    if (!gameState.isLoading && isClient && !interfaceReady) {
      // Устанавливаем небольшую задержку для уверенности,
      // что все компоненты отрендерились
      const readyTimeout = setTimeout(() => {
        logger.log('[HomeContent] Interface is ready for display');
        setInterfaceReady(true);
      }, 100);
      
      return () => clearTimeout(readyTimeout);
    }
    // Явно возвращаем undefined для путей, где нет функции очистки
    return undefined;
  }, [gameState.isLoading, isClient, interfaceReady]);

  // Модифицируем useEffect для корректной обработки скрытия интерфейса при игре в Merge
  useEffect(() => {
    // Проверяем, активна ли сейчас игра Merge
    const isMergeTabActive = gameState.activeTab === "merge";
    
    // Для отладки выводим текущее состояние при его изменении
    if (ENABLE_DETAILED_LOGS) {
      logger.log("[HomeContent] Рендерим основной контент:", {
        activeTab: gameState.activeTab,
        hideInterface: gameState.hideInterface,
        isMergeGameActive,
        shouldShowInterface: !gameState.hideInterface || forceShowInterface
      });
    }

    // Устанавливаем флаг активности игры в Merge
    setIsMergeGameActive(isMergeTabActive && gameState.hideInterface);
    
    // Если интерфейс скрыт и это НЕ режим игры Merge, восстанавливаем видимость интерфейса
    if (gameState.hideInterface && !isMergeTabActive) {
      logger.log("[HomeContent] Обнаружено скрытие интерфейса (не Merge), планируем восстановление");
      const showInterfaceTimeout = setTimeout(() => {
        logger.log("[HomeContent] Принудительно показываем интерфейс");
        setForceShowInterface(true);
        // Также обновляем состояние для гарантии
        dispatch(prevState => ({
          ...prevState,
          hideInterface: false
        }));
      }, 200);
      
      return () => clearTimeout(showInterfaceTimeout);
    } else {
      // Сбрасываем форсированный показ, если интерфейс и так видим
      // или мы в режиме игры Merge (где интерфейс должен быть скрыт)
      setForceShowInterface(false);
    }
    
    return undefined;
  }, [gameState.hideInterface, gameState.activeTab, dispatch]);

  // Отображаем экран загрузки вместо возврата null
  if (gameState.isLoading && !forceLoaded) {
    logger.log("[HomeContent] Показываем экран загрузки с прогрессом 90%");
    return <LoadingScreen progress={90} statusMessage="Preparing game..." />;
  }
  
  // Если мы на сервере или до гидратации, показываем общий экран загрузки
  if (!isClient) {
    return <LoadingScreen progress={80} statusMessage="Preparing UI..." />;
  }

  logger.log("[HomeContent] Рендерим основной контент:", 
    {activeTab: gameState.activeTab, 
     hideInterface: gameState.hideInterface, 
     isMergeGameActive, 
     shouldShowInterface: isMergeGameActive ? false : (forceShowInterface || !gameState.hideInterface)
    });
  
  const Component = TABS[gameState.activeTab] || TABS.merge;
  
  // Модифицируем проверку видимости интерфейса
  // Вычисляем, должен ли интерфейс быть видимым
  // Для игры Merge мы всегда скрываем интерфейс, если hideInterface=true и активен таб Merge
  const shouldShowInterface = isMergeGameActive ? false : (forceShowInterface || !gameState.hideInterface);
  
  return (
    <ErrorBoundary fallback={<ErrorDisplay message="Ошибка при отображении основного контента." />}>
      <MotionDiv 
        className='main-game-container' 
        style={{ height: viewportHeight }}
        onLoad={() => {
          // Помечаем, что все компоненты загружены
          if (!allComponentsLoadedRef.current) {
            allComponentsLoadedRef.current = true;
            // Эта установка приведет к вызову ready() через useEffect
            setInterfaceReady(true);
          }
        }}
      >
        <Resources 
          isVisible={shouldShowInterface}
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
        
        <div className={shouldShowInterface ? '' : 'opacity-0 pointer-events-none'}>
          <TabBar />
        </div>
        
        {shouldShowInterface && <SaveIndicator />}
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

