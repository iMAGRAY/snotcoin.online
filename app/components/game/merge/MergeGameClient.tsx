'use client'

import React, { useState, useEffect, useRef } from 'react';
import * as planck from 'planck';
import { isBodyDestroyed, setupNormalBallsCollisions } from './utils/bodyUtils';
import { usePhysicsWorld } from './hooks/usePhysicsWorld';
import { useGameState } from './hooks/useGameState';
import { throwBall, generateBallLevel } from './physics/throwBall';
import { updateTrajectoryLine } from './physics/trajectoryLine';
import { formatSnotValue } from '../../../utils/formatters';
import { FIXED_PLAYER_Y } from './constants/gameConstants';
import { createNextBall } from './physics/createNextBall';
import Image from 'next/image';

// Импортируем компоненты
import GameHeader from './components/GameHeader';
import PauseMenu from './components/PauseMenu';
import LoadingScreen from './components/LoadingScreen';
import FooterButtons from './components/FooterButtons';
import GamePhysics from './components/GamePhysics';
import GameInitializer from './components/GameInitializer';
import { handleResize } from './utils/sceneUtils';

import { useGameContext } from '../../../contexts/game/hooks/useGameContext';
import { MergeGameProps, ExtendedBall, Ball } from './types/index';
import { createTogglePauseHandler, createResumeGameHandler, createGameCloseHandler } from './handlers/gameHandlers';
import { 
  createBullBallHandler, 
  createBombBallHandler, 
  createImpulseJoyEffectHandler 
} from './handlers/specialBallsHandlers';
import { removeBall as removeBallUtil, findBottomBalls as findBottomBallsUtil, removeMultipleBalls } from './utils/ballUtils';

// Минимальный интервал между бросками шаров (в миллисекундах)
const MIN_THROW_INTERVAL = 1000; // 1 секунда

const MergeGameClient: React.FC<MergeGameProps> = ({ onClose, gameOptions = {} }) => {
  // Получаем состояние игры из контекста
  const { state: gameState, dispatch } = useGameContext();
  const snotCoins = gameState.inventory?.snotCoins || 0;
  const snot = gameState.inventory?.snot || 0;
  const containerCapacity = gameState.inventory?.containerCapacity || 1;

  // Рефы для игровых объектов
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<any>(null);
  const ballsRef = useRef<ExtendedBall[]>([]);
  const nextBallLevelRef = useRef<number>(1);
  const currentBallRef = useRef<any>(null);
  const trajectoryLineRef = useRef<any>(null);
  const frameCounterRef = useRef<number>(0);
  const potentiallyStuckBallsRef = useRef<Map<ExtendedBall, number>>(new Map());
  
  // Состояния игры
  const {
    isLoading, setIsLoading,
    hasError, setHasError,
    debugMessage, setDebugMessage,
    futureNextBallLevel, setFutureNextBallLevel,
    isPaused, setIsPaused,
    togglePause, resumeGame,
    initializeGameState
  } = useGameState();
  
  // Инициализируем состояние паузы из gameOptions
  useEffect(() => {
    if (gameOptions?.initialPause !== undefined) {
      initializeGameState({ isPaused: gameOptions.initialPause });
    }
  }, []);
  
  // Используем хук для физического мира
  const physicsRefs = usePhysicsWorld();
  const { worldRef, playerBodyRef, leftWallRef, rightWallRef, topWallRef, floorRef } = physicsRefs;
  
  // Состояния для специальных шаров и управления
  const [specialBallType, setSpecialBallType] = useState<string | null>(null);
  const [mountTime] = useState<number>(Date.now());
  const [userPausedGame, setUserPausedGame] = useState<boolean>(false);
  const [lastThrowTime, setLastThrowTime] = useState<number>(0);
  const [bullUsed, setBullUsed] = useState<boolean>(false);
  const [bombUsed, setBombUsed] = useState<boolean>(false);
  const isFreezeModeActive = useRef<boolean>(false);
  
  // Стоимость использования специальных возможностей в % от вместимости
  const specialCosts = {
    Bull: 20, // 20% от вместимости
    Bomb: 5,  // 5% от вместимости
    Joy: 10   // 10% от вместимости
  };
  
  // Функция для проверки, можно ли использовать специальную возможность
  const canUseSpecialFeature = (type: string): boolean => {
    const costPercent = specialCosts[type as keyof typeof specialCosts] || 0;
    const cost = (costPercent / 100) * containerCapacity;
    return snotCoins >= cost;
  };
  
  // Функция для списания стоимости использования специальной возможности
  const deductResourceCost = (type: string): void => {
    const costPercent = specialCosts[type as keyof typeof specialCosts] || 0;
    const cost = (costPercent / 100) * containerCapacity;
    
    dispatch({
      type: 'UPDATE_INVENTORY',
      payload: {
        snotCoins: Math.max(0, snotCoins - cost)
      }
    });
  };
  
  // Вспомогательные функции для работы с шарами
    const removeBall = (ball: ExtendedBall) => {
      removeBallUtil(ball, ballsRef, worldRef);
    };
    
    const findBottomBalls = (count: number): ExtendedBall[] => {
      return findBottomBallsUtil(ballsRef, count);
    };
    
    const removeBottomBalls = (balls: Ball[]) => {
      removeMultipleBalls(balls, ballsRef, worldRef, potentiallyStuckBallsRef);
    };
  
  // Получаем ссылку на функцию cleanupResources из GameInitializer
  const cleanupResourcesRef = useRef<() => void>(() => {});
  
  // Создаем обработчики для специальных шаров
  const applyJoyEffect = createImpulseJoyEffectHandler(
    canUseSpecialFeature,
    deductResourceCost,
    ballsRef,
    worldRef,
    containerCapacity,
    specialCosts
  );
  
  // Используем импортированные обработчики вместо дублирования кода
  const handleBullBall = createBullBallHandler(
    canUseSpecialFeature,
    deductResourceCost,
    setBullUsed,
    setSpecialBallType,
    currentBallRef,
    dispatch,
    bullUsed
  );
  
  const handleBombBall = createBombBallHandler(
    currentBallRef,
    canUseSpecialFeature,
    deductResourceCost,
    setSpecialBallType,
    dispatch
  );
  
  // Обработчики для управления игрой
  const handleTogglePause = createTogglePauseHandler(isPaused, setUserPausedGame, togglePause);
  const handleResumeGame = createResumeGameHandler(setUserPausedGame, resumeGame);
  const handleGameClose = createGameCloseHandler(
    () => cleanupResourcesRef.current(), // используем ссылку на функцию из GameInitializer
    setIsPaused,
    gameInstanceRef,
    dispatch,
    onClose
  );
  
  return (
    <div className="fixed inset-0 z-[9999] p-0 m-0 h-full w-full flex items-center justify-center">
      {/* Фоновое изображение */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <Image 
          src="/images/merge/game/BackGround.webp" 
          alt="Game Background" 
          fill 
          priority
          style={{ objectFit: 'cover' }} 
        />
      </div>

      <div className="relative w-full h-full max-w-6xl mx-auto overflow-hidden flex flex-col">
        {/* Заголовок игры */}
        <GameHeader 
          onClose={handleGameClose} 
          snotCoins={snotCoins} 
          snot={snot} 
          containerCapacity={containerCapacity}
          onTogglePause={handleTogglePause}
        />
        
        {/* Основной контейнер игры */}
        <div 
          className="relative flex-grow bg-transparent touch-none flex items-center justify-center"
          ref={gameContainerRef}
        >
          {/* Инициализатор игры */}
          <GameInitializer 
            gameContainerRef={gameContainerRef}
            setIsLoading={setIsLoading}
            setDebugMessage={setDebugMessage}
            setHasError={setHasError}
            isPaused={isPaused}
            setIsPaused={setIsPaused}
            worldRef={worldRef}
            playerBodyRef={playerBodyRef}
            leftWallRef={leftWallRef}
            rightWallRef={rightWallRef}
            topWallRef={topWallRef}
            floorRef={floorRef}
            ballsRef={ballsRef}
            currentBallRef={currentBallRef}
            trajectoryLineRef={trajectoryLineRef}
            nextBallLevelRef={nextBallLevelRef}
            gameInstanceRef={gameInstanceRef}
            setFutureNextBallLevel={setFutureNextBallLevel}
            potentiallyStuckBallsRef={potentiallyStuckBallsRef}
            dispatch={dispatch}
            snotCoins={snotCoins}
            setSpecialBallType={setSpecialBallType}
            cleanupResourcesRef={cleanupResourcesRef}
          />
          
          {/* Отображение физики (для отладки) */}
          <GamePhysics
            worldRef={worldRef}
            playerBodyRef={playerBodyRef}
            leftWallRef={leftWallRef}
            rightWallRef={rightWallRef}
            topWallRef={topWallRef}
            floorRef={floorRef}
            ballsRef={ballsRef}
            pixelsPerMeter={30}
          />
          
          {/* Меню паузы */}
          {isPaused && userPausedGame && (
            <PauseMenu 
              onResume={handleResumeGame}
              onClose={handleGameClose}
            />
          )}
          
          {/* Экран загрузки */}
          {isLoading && <LoadingScreen message={debugMessage} />}
        </div>
        
        {/* Кнопки подвала */}
        <FooterButtons 
          onJoyEffect={applyJoyEffect}
          onBullBall={handleBullBall}
          onBombBall={handleBombBall}
          canUseJoy={canUseSpecialFeature('Joy')}
          canUseBull={canUseSpecialFeature('Bull') && !bullUsed}
          canUseBomb={canUseSpecialFeature('Bomb') && !bombUsed}
          joyPercent={specialCosts.Joy}
          bullPercent={specialCosts.Bull}
          bombPercent={specialCosts.Bomb}
        />
      </div>
    </div>
  );
};

export default MergeGameClient;