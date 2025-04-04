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

// Импортируем компоненты
import GameHeader from './components/GameHeader';
import PauseMenu from './components/PauseMenu';
import LoadingScreen from './components/LoadingScreen';
import FooterButtons from './components/FooterButtons';
import GamePhysics from './components/GamePhysics';
import GameInitializer from './components/GameInitializer';

import { useGameContext } from '../../../contexts/game/hooks/useGameContext';
import { MergeGameProps, ExtendedBall, Ball } from './types/index';
import { createTogglePauseHandler, createResumeGameHandler, createGameCloseHandler } from './handlers/gameHandlers';
import { 
  createBullBallHandler, 
  createBombBallHandler, 
  createImpulseJoyEffectHandler 
} from './handlers/specialBallsHandlers';
import { removeBall as removeBallUtil, findBottomBalls as findBottomBallsUtil, removeMultipleBalls } from './utils/ballsUtils';

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
    
    console.log(`Использована способность ${type}, списано ${cost.toFixed(4)} SC. Осталось: ${(snotCoins - cost).toFixed(4)} SC`);
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
  
  // Функция для очистки ресурсов
  const cleanupResources = () => {
    potentiallyStuckBallsRef.current.clear();
  };
  
  // Функция для изменения типа шара для броска
  const changeSpecialBall = (type: string) => {
    console.log(`changeSpecialBall вызван с типом: ${type}`);
    
    // Проверяем, достаточно ли ресурсов для использования специальной возможности
    if (!canUseSpecialFeature(type)) {
      const cost = specialCosts[type as keyof typeof specialCosts] || 0;
      const actualCost = (cost / 100) * containerCapacity;
      console.log(`Недостаточно SnotCoin для использования ${type}. Требуется ${actualCost.toFixed(4)}`);
      return; // Выходим, если ресурсов недостаточно
    }
    
    // Для шара Bull проверяем, не был ли он уже использован
    if (type === 'Bull' && bullUsed) {
      console.log('Шар Bull уже был использован. Перезарядите способность.');
      
      // Добавляем визуальное уведомление о необходимости перезарядки
      if (gameInstanceRef.current && gameInstanceRef.current.scene && gameInstanceRef.current.scene.scenes[0]) {
        const scene = gameInstanceRef.current.scene.scenes[0];
        
        // Добавляем текст с предупреждением
        const rechargeText = scene.add.text(
          scene.cameras.main.width / 2,
          scene.cameras.main.height / 2,
          'Перезарядите bull',
          { 
            fontFamily: 'Arial', 
            fontSize: '24px', 
            color: '#ff0000',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
          }
        ).setOrigin(0.5);
        
        // Анимируем исчезновение текста
        scene.tweens.add({
          targets: rechargeText,
          alpha: 0,
          y: scene.cameras.main.height / 2 - 50,
          duration: 1000,
          ease: 'Power2',
          onComplete: () => {
            rechargeText.destroy();
          }
        });
      }
      
      return; // Выходим, если Bull уже был использован
    }
    
    // Списываем стоимость использования
    deductResourceCost(type);
    
    setSpecialBallType(type);
    
    // Если выбран шар Bull, устанавливаем флаг, что он еще не использован
    if (type === 'Bull') {
      setBullUsed(false);
    }
    
    // Меняем текущий шар для броска, если он существует
    if (currentBallRef.current && gameInstanceRef.current && gameInstanceRef.current.scene.scenes[0]) {
      try {
        const scene = gameInstanceRef.current.scene.scenes[0];
        
        // Удаляем текущий шар
        if (currentBallRef.current.sprite && 
            currentBallRef.current.sprite.container && 
            !currentBallRef.current.sprite.container.destroyed) {
          currentBallRef.current.sprite.container.destroy();
        }
        
        // Безопасное уничтожение пунктирной линии
        if (trajectoryLineRef.current && trajectoryLineRef.current.destroy) {
          trajectoryLineRef.current.destroy();
          trajectoryLineRef.current = null;
        }
        
        // Создаем новый шар выбранного типа через функции из основного компонента
        // Обработчик будет использовать объект сцены для создания нового шара через currentBallRef
        
        console.log(`Создан специальный шар ${type}:`, currentBallRef.current);
      } catch (error) {
        console.error('Ошибка при создании специального шара:', error);
      }
    } else {
      console.log('Невозможно создать специальный шар: currentBallRef.current или gameInstanceRef.current не существует');
    }
  };
  
  // Создаем обработчики для специальных шаров
  const applyJoyEffect = createImpulseJoyEffectHandler(
    canUseSpecialFeature,
    deductResourceCost,
    ballsRef,
    worldRef,
    containerCapacity,
    specialCosts
  );
  
  const handleBullBall = createBullBallHandler(
    canUseSpecialFeature,
    deductResourceCost,
    setBullUsed,
    setSpecialBallType,
    currentBallRef,
    dispatch
  );
  
  const handleBombBall = createBombBallHandler(
    canUseSpecialFeature,
    deductResourceCost,
    setSpecialBallType,
    currentBallRef,
    dispatch
  );
  
  // Обработчики для управления игрой
  const handleTogglePause = createTogglePauseHandler(isPaused, setUserPausedGame, togglePause);
  const handleResumeGame = createResumeGameHandler(setUserPausedGame, resumeGame);
  const handleGameClose = createGameCloseHandler(
    cleanupResources, 
    setIsPaused, 
    gameInstanceRef, 
    dispatch, 
    onClose
  );
  
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-90" 
         style={{ 
           backgroundImage: 'url(/images/merge/Game/BackGround.webp)',
           backgroundSize: 'cover',
           backgroundPosition: 'center'
         }}>
      <div className="w-full max-w-6xl mx-auto flex flex-col h-full" style={{ position: 'relative' }}>
        {/* Верхняя панель (шапка) */}
        <div className="flex-shrink-0">
          <GameHeader 
            togglePause={handleTogglePause} 
            futureNextBallLevel={futureNextBallLevel}
            snotCoinValue={snotCoins}
            snotValue={snot}
          />
        </div>
        
        {/* Игровой контейнер с прозрачным фоном */}
        <div 
          ref={gameContainerRef} 
            className="flex-grow overflow-hidden flex items-end justify-center"
            style={{ 
              touchAction: 'none', 
              backgroundColor: 'transparent',
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              padding: 0,
              margin: 0
            }}
        >
          {/* Экран загрузки или ошибки */}
          <LoadingScreen 
            isLoading={isLoading} 
            hasError={hasError} 
            debugMessage={debugMessage} 
          />
          
          {/* Компоненты для инициализации и управления физикой игры */}
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
          />
          
          <GamePhysics
            isPaused={isPaused}
            worldRef={worldRef}
            ballsRef={ballsRef}
            gameInstanceRef={gameInstanceRef}
            potentiallyStuckBallsRef={potentiallyStuckBallsRef}
          />
        </div>
        
        {/* Прозрачный футер (пол игровой зоны) */}
        <div className="flex-shrink-0 w-full relative z-10">
          <div 
            className="w-full h-[64px] sm:h-[96px]"
            style={{
              backgroundImage: 'url("/images/merge/Game/ui/Footer.webp")',
              backgroundSize: '100% 100%', 
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'bottom center',
              boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.2)'
            }}
          >
            <FooterButtons
              onBullClick={handleBullBall}
              onBombClick={handleBombBall}
              onJoyClick={applyJoyEffect}
              specialCosts={specialCosts}
              containerCapacity={containerCapacity}
              snotCoins={snotCoins}
              bullUsed={bullUsed}
            />
          </div>
        </div>
      </div>
      
      {/* Меню паузы - показываем либо при явном нажатии на паузу пользователем,
          либо при соблюдении всех других условий для автоматической паузы */}
      {((!isLoading && isPaused && userPausedGame) || 
        (!isLoading && isPaused && (Date.now() - mountTime > 1000) && 
         !(gameOptions.initialPause === false && (Date.now() - mountTime < 5000)))) && (
        <PauseMenu 
          resumeGame={handleResumeGame}
          onClose={handleGameClose}
        />
      )}
    </div>
  );
};

export default MergeGameClient;