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
    
    // Использована способность, списано SC. Осталось: SC
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
    // changeSpecialBall вызван с типом
    
    // Проверяем, достаточно ли ресурсов для использования специальной возможности
    if (!canUseSpecialFeature(type)) {
      const cost = specialCosts[type as keyof typeof specialCosts] || 0;
      const actualCost = (cost / 100) * containerCapacity;
      // Недостаточно SnotCoin для использования. Требуется
      return; // Выходим, если ресурсов недостаточно
    }
    
    // Для шара Bull проверяем, не был ли он уже использован
    if (type === 'Bull' && bullUsed) {
      // Шар Bull уже был использован. Перезарядите способность
      
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
        
        // Создан специальный шар
          } catch (error) {
        // Ошибка при создании специального шара
      }
    } else {
      // Невозможно создать специальный шар: currentBallRef.current или gameInstanceRef.current не существует
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
  
  const handleBullBall = () => {
    const type = 'Bull';
    
    // Диагностическая информация
    // Bull button clicked
    
    // Проверяем, достаточно ли ресурсов
    if (!canUseSpecialFeature(type)) {
      // Недостаточно ресурсов для использования
      dispatch({
        type: 'SHOW_NOTIFICATION' as any,
        payload: {
          message: 'Недостаточно SnotCoin для использования Bull',
          type: 'error',
          duration: 2000
        }
      });
      return;
    }
    
    // Проверяем, был ли уже использован Bull в этой игре
    if (bullUsed) {
      // Bull уже был использован в этой игре
      dispatch({
        type: 'SHOW_NOTIFICATION' as any,
        payload: {
          message: 'Bull уже был использован в этой игре',
          type: 'warning',
          duration: 2000
        }
      });
          return;
        }
        
    // Списываем стоимость
    deductResourceCost(type);
    
    // Устанавливаем флаг использования Bull
    setBullUsed(true);
    
    // Устанавливаем тип специального шара
    setSpecialBallType(type);
    
    // Получаем сцену из gameInstanceRef
    if (gameInstanceRef.current && gameInstanceRef.current.scene && gameInstanceRef.current.scene.scenes && gameInstanceRef.current.scene.scenes[0]) {
      try {
        const scene = gameInstanceRef.current.scene.scenes[0];
        // Got scene from gameInstanceRef
        
        // Сохраняем текущую позицию игрока, если она есть
        let playerX = scene.cameras.main.width / 2; // Позиция по умолчанию (центр)
        let playerY = FIXED_PLAYER_Y; // Позиция Y игрока
        
                if (playerBodyRef.current) {
          const pos = playerBodyRef.current.getPosition();
          playerX = pos.x * 30; // Преобразуем физические координаты в пиксели
        }
        
        // Создаём ссылку на физическое тело игрока
        const playerRef = { current: scene.playerBodyRef?.current || null };
        
        // Уничтожаем текущий шар, если он есть
                    if (currentBallRef.current && currentBallRef.current.sprite && 
                        currentBallRef.current.sprite.container && !currentBallRef.current.sprite.container.destroyed) {
          currentBallRef.current.sprite.container.destroy();
        }
        
        // Создаем шар Bull напрямую (без использования createNextBall)
        // Начинаем создание шара Bull напрямую
        
        // Получаем размер шара
        const ballSize = 15;
        
        // Создаем контейнер для шара
        const container = scene.add.container(playerX, playerY + 24);
        container.setDepth(30); // Высокий z-index для отображения поверх других элементов
        
        let bullImage;
        let outline;
        
        // Проверяем существование текстуры
        if (scene.textures.exists('bull-ball')) {
          // Используем текстуру bull-ball для создания шара Bull
          bullImage = scene.add.image(0, 0, 'bull-ball');
          bullImage.setDisplaySize(ballSize * 2.5, ballSize * 2.5);
          
          // Добавляем красное свечение
          outline = scene.add.circle(0, 0, ballSize * 1.3, 0xff0000, 0.3);
          
          // Добавляем в контейнер
          container.add([outline, bullImage]);
          
          // Анимация пульсации
          scene.tweens.add({
            targets: outline,
            alpha: { from: 0.3, to: 0.7 },
            scale: { from: 1, to: 1.2 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
          
          // Анимация вращения
          scene.tweens.add({
            targets: bullImage,
            angle: '+=5',
            duration: 3000,
            repeat: -1,
            ease: 'Linear'
          });
        } else {
          // Текстура bull-ball не найдена, используется fallback вариант
          // Загружаем текстуру
          scene.load.image('bull-ball', '/images/merge/Game/ui/Bull.webp');
          scene.load.start();
          
          // Если изображение не найдено, создаем красный круг
          bullImage = scene.add.circle(0, 0, ballSize, 0xff0000);
          outline = scene.add.circle(0, 0, ballSize * 1.2, 0xff0000, 0.3);
          
          // Добавляем текст "BULL"
          const text = scene.add.text(0, 0, 'BULL', {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#ffffff'
          }).setOrigin(0.5);
          
          // Добавляем в контейнер
          container.add([outline, bullImage, text]);
        }
        
        // Сохраняем созданный шар в currentBallRef
        currentBallRef.current = {
          sprite: {
            container,
            circle: bullImage
          },
          level: 1,
          specialType: 'Bull'
        };
        
        // Шар Bull успешно создан: currentBallRef.current
        
        // Обновляем пунктирную линию для нового шара
        if (trajectoryLineRef.current && trajectoryLineRef.current.destroy) {
          trajectoryLineRef.current.destroy();
        }
        
        // Импортируем функцию создания траектории
        const { createTrajectoryLine } = require('./physics/trajectoryLine');
        createTrajectoryLine(scene, trajectoryLineRef, playerX, playerY + 24);
        
        dispatch({
          type: 'SHOW_NOTIFICATION' as any,
          payload: {
            message: 'Bull активирован! Бросьте чтобы использовать',
            type: 'success',
            duration: 2000
          }
        });
                  } catch (error) {
        // Ошибка при создании Bull шара
        dispatch({
          type: 'SHOW_NOTIFICATION' as any,
          payload: {
            message: 'Ошибка при активации Bull',
            type: 'error',
            duration: 2000
          }
        });
      }
    } else {
      // Невозможно создать Bull: не найдена сцена в gameInstanceRef
      dispatch({
        type: 'SHOW_NOTIFICATION' as any,
        payload: {
          message: 'Ошибка при активации Bull: сцена не найдена',
          type: 'error',
          duration: 2000
        }
      });
    }
  };
  
  const handleBombBall = () => {
    const type = 'Bomb';
    
    // Диагностическая информация
    // Bomb button clicked
    
    // Проверяем, достаточно ли ресурсов
    if (!canUseSpecialFeature(type)) {
      // Недостаточно ресурсов для использования
      dispatch({
        type: 'SHOW_NOTIFICATION' as any,
        payload: {
          message: 'Недостаточно SnotCoin для использования Bomb',
          type: 'error',
          duration: 2000
        }
      });
      return;
    }
    
    // Проверяем, был ли уже использован Bomb в этой игре
    if (bombUsed) {
      // Bomb уже был использован в этой игре
      dispatch({
        type: 'SHOW_NOTIFICATION' as any,
        payload: {
          message: 'Bomb уже был использован в этой игре',
          type: 'warning',
          duration: 2000
        }
      });
      return;
    }
    
    // Списываем стоимость
    deductResourceCost(type);
    
    // Устанавливаем флаг использования Bomb
    setBombUsed(true);
    
    // Устанавливаем тип специального шара
    setSpecialBallType(type);
    
    // Получаем сцену из gameInstanceRef
    if (gameInstanceRef.current && gameInstanceRef.current.scene && gameInstanceRef.current.scene.scenes && gameInstanceRef.current.scene.scenes[0]) {
      try {
              const scene = gameInstanceRef.current.scene.scenes[0];
        // Got scene from gameInstanceRef
        
        // Сохраняем текущую позицию игрока, если она есть
        let playerX = scene.cameras.main.width / 2; // Позиция по умолчанию (центр)
        let playerY = FIXED_PLAYER_Y; // Позиция Y игрока
        
                  if (playerBodyRef.current) {
          const pos = playerBodyRef.current.getPosition();
          playerX = pos.x * 30; // Преобразуем физические координаты в пиксели
                  }
              
        // Создаём ссылку на физическое тело игрока
        const playerRef = { current: scene.playerBodyRef?.current || null };
        
        // Уничтожаем текущий шар, если он есть
              if (currentBallRef.current && currentBallRef.current.sprite && 
                  currentBallRef.current.sprite.container && !currentBallRef.current.sprite.container.destroyed) {
          currentBallRef.current.sprite.container.destroy();
        }
        
        // Создаем шар Bomb напрямую (без использования createNextBall)
        // Начинаем создание шара Bomb напрямую
        
        // Получаем размер шара
        const ballSize = 15;
        
        // Создаем контейнер для шара
        const container = scene.add.container(playerX, playerY + 24);
        container.setDepth(30); // Высокий z-index для отображения поверх других элементов
        
        let bombImage;
        let outline;
        
        // Проверяем существование текстуры
        if (scene.textures.exists('bomb')) {
          // Используем текстуру bomb для создания шара Bomb
          bombImage = scene.add.image(0, 0, 'bomb');
          bombImage.setDisplaySize(ballSize * 2.2, ballSize * 2.2);
          
          // Добавляем свечение
          outline = scene.add.circle(0, 0, ballSize * 1.3, 0xff0000, 0.3);
          
          // Добавляем в контейнер
          container.add([outline, bombImage]);
          
          // Анимация пульсации
          scene.tweens.add({
            targets: outline,
            alpha: { from: 0.3, to: 0.7 },
            scale: { from: 1, to: 1.2 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
          
          // Анимация вращения
        scene.tweens.add({
            targets: bombImage,
            angle: '+=10',
            duration: 2000,
            repeat: -1,
            ease: 'Linear'
          });
        } else {
          console.warn('Текстура bomb не найдена, используется fallback вариант');
          // Загружаем текстуру
          scene.load.image('bomb', '/images/merge/Game/ui/Bomb.webp');
          scene.load.start();
          
          // Если изображение не найдено, создаем чёрный круг
          bombImage = scene.add.circle(0, 0, ballSize, 0x000000);
          outline = scene.add.circle(0, 0, ballSize * 1.2, 0xff0000, 0.3);
          
          // Добавляем текст "BOMB"
          const text = scene.add.text(0, 0, 'BOMB', {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#ffffff'
          }).setOrigin(0.5);
          
          // Добавляем в контейнер
          container.add([outline, bombImage, text]);
        }
        
        // Сохраняем созданный шар в currentBallRef
        currentBallRef.current = {
          sprite: {
            container,
            circle: bombImage
          },
          level: 1,
          specialType: 'Bomb'
        };
        
        console.log('Шар Bomb успешно создан:', currentBallRef.current);
        
        // Обновляем пунктирную линию для нового шара
    if (trajectoryLineRef.current && trajectoryLineRef.current.destroy) {
      trajectoryLineRef.current.destroy();
        }
        
        // Импортируем функцию создания траектории
        const { createTrajectoryLine } = require('./physics/trajectoryLine');
        createTrajectoryLine(scene, trajectoryLineRef, playerX, playerY + 24);
        
        dispatch({
          type: 'SHOW_NOTIFICATION' as any,
          payload: {
            message: 'Bomb активирована! Бросьте чтобы использовать',
            type: 'success',
            duration: 2000
          }
        });
          } catch (error) {
        console.error('Ошибка при создании Bomb шара:', error);
        dispatch({
          type: 'SHOW_NOTIFICATION' as any,
          payload: {
            message: 'Ошибка при активации Bomb',
            type: 'error',
            duration: 2000
          }
        });
      }
    } else {
      console.error('Невозможно создать Bomb: не найдена сцена в gameInstanceRef');
      dispatch({
        type: 'SHOW_NOTIFICATION' as any,
        payload: {
          message: 'Ошибка при активации Bomb: сцена не найдена',
          type: 'error',
          duration: 2000
        }
      });
    }
  };
  
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
        
        {/* Игровой контейнер */}
        <div 
          ref={gameContainerRef} 
          className="flex-grow overflow-hidden relative"
          style={{ 
            touchAction: 'none', 
            backgroundColor: 'transparent',
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%'
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
            setSpecialBallType={setSpecialBallType}
          />
          
          <GamePhysics
            isPaused={isPaused}
            worldRef={worldRef}
            ballsRef={ballsRef}
            gameInstanceRef={gameInstanceRef}
            potentiallyStuckBallsRef={potentiallyStuckBallsRef}
          />
        </div>
        
        {/* Нижняя панель */}
        <div 
          className="flex-shrink-0 w-full h-[64px] sm:h-[96px] relative z-10"
          style={{
            backgroundImage: 'url("/images/merge/Game/ui/Footer.webp")',
            backgroundSize: '100% 100%', 
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'bottom center',
            boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.2)'
          }}
        >
          {/* Кнопки способностей (внутри нижней панели) */}
          <div className="w-full h-full flex items-center justify-center">
            <FooterButtons
              onBullClick={handleBullBall}
              onBombClick={handleBombBall}
              onJoyClick={applyJoyEffect}
              specialCosts={specialCosts}
              containerCapacity={containerCapacity}
              snotCoins={snotCoins}
              bullUsed={bullUsed}
              bombUsed={bombUsed}
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