'use client'

import React, { useState, useEffect, useRef } from 'react';
import * as planck from 'planck';
import { Ball, MergeGameProps, PhaserType, TrajectoryRef, NextBall } from './types';
import { usePhysicsWorld } from './hooks/usePhysicsWorld';
import { useGameState } from './hooks/useGameState';
import { createPhysicsWorld } from './physics/createPhysicsWorld';
import { createBall } from './physics/createBall';
import { getBallSize, getBallPhysicsSize } from './physics/createBall';
import { createNextBall } from './physics/createNextBall'; 
import { throwBall, generateBallLevel } from './physics/throwBall';
import { checkAndMergeBalls, hasBallsMarkedForMerge } from './physics/checkAndMergeBalls';
import { createTrajectoryLine, updateTrajectoryLine } from './physics/trajectoryLine';
import { toPixels } from './utils/coordinates';
import { 
  TIME_STEP, 
  VELOCITY_ITERATIONS, 
  POSITION_ITERATIONS, 
  CHECK_MERGE_FREQUENCY, 
  FIXED_PLAYER_Y, 
  MAX_BALLS_COUNT,
  GRAVITY_Y,
  STUCK_THRESHOLD_VELOCITY,
  STUCK_TIME_MS,
  FALL_TIMEOUT_MS,
  GAME_ASPECT_RATIO,
  PHYSICAL_FLOOR_HEIGHT,
  FOOTER_HEIGHT,
  FOOTER_HEIGHT_MOBILE,
  HEADER_HEIGHT,
  HEADER_HEIGHT_MOBILE,
  SCALE,
  BASE_GAME_WIDTH,
  PLAYER_SIZE,
  BALL_DENSITY,
  BALL_FRICTION,
  BALL_RESTITUTION
} from './constants/gameConstants';
import GameHeader from './components/GameHeader';
import PauseMenu from './components/PauseMenu';
import LoadingScreen from './components/LoadingScreen';
import { useGameContext } from '../../../contexts/game/hooks/useGameContext';

// Обновляем интерфейс MergeGameProps для поддержки gameOptions
interface MergeGameProps {
  onClose: () => void;
  gameOptions?: {
    initialPause?: boolean;
  };
}

// Константа для частоты проверки "зависших" шаров
const STUCK_CHECK_INTERVAL = 30;

// Уменьшаем отступы безопасности до нуля
const safetyMargin = 0;

const MergeGameClient: React.FC<MergeGameProps> = ({ onClose, gameOptions = {} }) => {
  // Получаем состояние игры из контекста
  const { state: gameState, dispatch } = useGameContext();
  const snotCoins = gameState.inventory?.snotCoins || 0;
  const snot = gameState.inventory?.snot || 0;
  const containerCapacity = gameState.inventory?.containerCapacity || 1;

  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<any>(null);
  const ballsRef = useRef<Ball[]>([]);
  const nextBallLevelRef = useRef<number>(1);
  const currentBallRef = useRef<NextBall | null>(null);
  const trajectoryLineRef = useRef<TrajectoryRef | null>(null);
  const frameCounterRef = useRef<number>(0);
  
  // Добавляем счетчик кадров для проверки зависших шаров
  const stuckCheckCounterRef = useRef<number>(0);
  
  // Добавляем Map для отслеживания потенциально зависших шаров и их времени
  const potentiallyStuckBallsRef = useRef<Map<Ball, number>>(new Map());
  
  // Используем хуки для состояний с инициализацией паузы из gameOptions
  const {
    isLoading, setIsLoading,
    hasError, setHasError,
    debugMessage, setDebugMessage,
    futureNextBallLevel, setFutureNextBallLevel,
    isPaused, setIsPaused,
    isTabActive,
    togglePause, resumeGame,
    isFirstLoad,
    initializeGameState
  } = useGameState();
  
  // Инициализируем состояние паузы из gameOptions при монтировании компонента
  React.useEffect(() => {
    if (gameOptions?.initialPause !== undefined) {
      initializeGameState({ isPaused: gameOptions.initialPause });
    }
  }, []);
  
  // Используем хук для физического мира
  const physicsRefs = usePhysicsWorld();
  const { worldRef, playerBodyRef, leftWallRef, rightWallRef, topWallRef, floorRef } = physicsRefs;
  
  const [specialBallType, setSpecialBallType] = useState<string | null>(null);
  
  // Добавляем состояние для отслеживания времени монтирования компонента
  const [mountTime] = useState<number>(Date.now());
  
  // Добавим состояние для отслеживания явного нажатия на кнопку паузы
  const [userPausedGame, setUserPausedGame] = useState<boolean>(false);
  
  // Добавляем состояние для отслеживания времени последнего броска шара
  const [lastThrowTime, setLastThrowTime] = useState<number>(0);
  
  // Стоимость использования специальных возможностей в % от вместимости
  const specialCosts = {
    Bull: 20, // 20% от вместимости
    Bomb: 5,  // 5% от вместимости
    Joy: 10   // 10% от вместимости
  };
  
  // Минимальный интервал между бросками шаров (в миллисекундах)
  const MIN_THROW_INTERVAL = 1000; // 1 секунда
  
  // Функция для проверки и списания стоимости специальной возможности
  const canUseSpecialFeature = (type: string): boolean => {
    const cost = specialCosts[type as keyof typeof specialCosts] || 0;
    // Рассчитываем стоимость как процент от вместимости контейнера (без округления)
    const actualCost = (cost / 100) * containerCapacity;
    // Проверяем достаточно ли у игрока SnotCoins
    return snotCoins >= actualCost;
  };
  
  // Функция для списания стоимости
  const deductResourceCost = (type: string): void => {
    const cost = specialCosts[type as keyof typeof specialCosts] || 0;
    // Рассчитываем стоимость как процент от вместимости контейнера (без округления)
    const actualCost = (cost / 100) * containerCapacity;
    
    // Обновляем глобальное состояние через dispatch
    dispatch({
      type: 'UPDATE_INVENTORY',
      payload: {
        snotCoins: Math.max(0, snotCoins - actualCost)
      }
    });
  };
  
  useEffect(() => {
    // Проверяем, что мы на клиенте и есть доступ к window
    if (typeof window === 'undefined' || !gameContainerRef.current) {
      setDebugMessage("Отсутствует window или контейнер");
        return;
      }
      
    setDebugMessage("Начало инициализации игры");
    
    let isMounted = true;
    let playerSprite: any = null;
    let resizeHandler: (() => void) | null = null;
    
    // Создаем сцену Phaser
    const createScene = (scene: any, Phaser: PhaserType, gameWidth: number, gameHeight: number) => {
      if (!scene) {
          console.error('Невалидная сцена в createScene:', scene);
          return;
        }
        
        setDebugMessage("Создание визуальных объектов...");
        
        // Создаем графику для отладки физики
        const debugGraphics = scene.add.graphics();
        debugGraphics.setDepth(1000); // Высокое значение глубины для отображения поверх других объектов
        
        // Добавляем preload для загрузки изображений стен
        scene.load.image('left-wall', '/images/merge/Game/ui/left-wall.webp');
        scene.load.image('right-wall', '/images/merge/Game/ui/right-wall.webp');
        scene.load.image('trees', '/images/merge/Game/ui/trees.webp');
        scene.load.image('floor', '/images/merge/Game/ui/floor.webp');
        
        // Ждем завершения загрузки ресурсов
        scene.load.once('complete', () => {
          try {
            console.log('Загрузка ресурсов завершена, настраиваем сцену');
            
            // Создаем графический объект для отрисовки границ игрового поля
            const graphics = scene.add.graphics();
            
            // Добавляем левую стену с использованием загруженного изображения
            const wallWidth = 32; // Точно такая же ширина как у физической стены
            scene.add.image(wallWidth / 2, gameHeight / 2, 'left-wall')
              .setOrigin(0.5, 0.5)
              .setDisplaySize(wallWidth, gameHeight)
              .setAlpha(0); // Делаем стену полностью прозрачной
            
            // Добавляем правую стену с использованием загруженного изображения
            scene.add.image(gameWidth - wallWidth / 2, gameHeight / 2, 'right-wall')
              .setOrigin(0.5, 0.5)
              .setDisplaySize(wallWidth, gameHeight)
              .setAlpha(0); // Делаем стену полностью прозрачной
            
            // Добавляем деревья поверх стен
            scene.add.image(gameWidth / 2, 0, 'trees')
              .setOrigin(0.5, 0)
              .setDisplaySize(gameWidth, gameHeight)
              .setDepth(100); // Высокое значение глубины для отображения поверх стен
            
            // Добавляем физический пол с изображением floor.webp
            const floorHeight = PHYSICAL_FLOOR_HEIGHT;
            // Размещаем пол точно в соответствии с его физическим положением
            scene.add.image(gameWidth / 2, gameHeight - floorHeight / 2, 'floor')
              .setOrigin(0.5, 0.5)
              .setDisplaySize(gameWidth, floorHeight)
              .setDepth(90); // Уровень глубины ниже деревьев, но выше других элементов
            
            // Масштабируем размер игрока в зависимости от размера игры
            const scaleFactor = gameWidth / BASE_GAME_WIDTH;
            const playerSizeScaled = PLAYER_SIZE * scaleFactor;
            
            // Создаем игрока (круг) в центре по горизонтали с учетом масштабирования
            playerSprite = scene.add.circle(gameWidth / 2, FIXED_PLAYER_Y, playerSizeScaled, 0xbbeb25);
            
            // Создаем физические объекты с учетом размеров игрового поля
            createPhysicsWorld(gameWidth, gameHeight, physicsRefs);
            
            // Сначала генерируем текущий шар (с вероятностями: 50% для уровня 1, 25% для 2, 13% для 3, 7% для 4, 5% для 5)
            const currentLevel = generateBallLevel();
            currentBallRef.current = createNextBall(scene, playerBodyRef, currentLevel);
            
            // Затем генерируем будущий шар (с теми же вероятностями) и обновляем интерфейс
            nextBallLevelRef.current = generateBallLevel();
            setFutureNextBallLevel(nextBallLevelRef.current);
            
            // Создаем пунктирную линию для визуализации траектории
            if (currentBallRef.current && currentBallRef.current.sprite) {
              createTrajectoryLine(
                scene, 
                trajectoryLineRef,
                currentBallRef.current.sprite.container.x, 
                currentBallRef.current.sprite.container.y
              );
            }
            
            // Проверяем и логируем создание шара
            if (currentBallRef.current) {
              console.log('Шар для броска создан', currentBallRef.current);
            } else {
              console.error('Ошибка создания шара для броска');
              // Пробуем еще раз с другим уровнем
              nextBallLevelRef.current = 1;
              currentBallRef.current = createNextBall(scene, playerBodyRef, nextBallLevelRef.current);
              console.log('Повторная попытка создания шара', { шарСоздан: !!currentBallRef.current });
            }
            
            // Принудительное обновление позиции игрока
            if (playerBodyRef.current) {
              playerBodyRef.current.setAwake(true);
            }
            
            // Добавляем инструкцию
            scene.add.text(
              gameWidth / 2, 
              64, 
              'Перемещайте и нажимайте для броска', 
              { 
                fontFamily: 'Arial', 
                fontSize: '14px', 
                color: '#ffffff' 
              }
            ).setOrigin(0.5, 0.5);
            
            // Устанавливаем границы мира Phaser, чтобы они совпадали с физическим миром
            scene.physics.world.setBounds(0, 0, gameWidth, gameHeight);
            
            setDebugMessage("Инициализация завершена успешно");
            setIsLoading(false);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Ошибка при настройке сцены после загрузки ресурсов:', error);
            setDebugMessage("Ошибка при настройке сцены: " + errorMessage);
          }
        });
        
        // Регистрируем обработчики событий
        try {
          // Обработчик движения мыши
          scene.input.on('pointermove', (pointer: any) => {
            if (!playerBodyRef.current) return;
          
          // Если игра на паузе, не обрабатываем движение
          if (isPaused) return;
            
            // Проверяем, что указатель находится в пределах игрового поля
            if (pointer.x < 0 || pointer.x > scene.sys.game.config.width || 
                pointer.y < 0 || pointer.y > scene.sys.game.config.height) {
              return; // Выходим, если указатель вышел за пределы игрового поля
            }
            
          try {
            const mouseX = pointer.x / 30;
            
            // Устанавливаем позицию игрока, поддерживая фиксированную высоту
            playerBodyRef.current.setPosition(planck.Vec2(mouseX, FIXED_PLAYER_Y / 30));
            
            // Сбрасываем скорость для предотвращения падения
            playerBodyRef.current.setLinearVelocity(planck.Vec2(0, 0));
            
            // Пробуждаем тело, если оно уснуло
            playerBodyRef.current.setAwake(true);
            
            // Перемещаем шар для броска вместе с игроком
            if (currentBallRef.current && currentBallRef.current.sprite && 
                currentBallRef.current.sprite.container && !currentBallRef.current.sprite.container.destroyed) {
              // Используем позицию игрока вместо позиции указателя мыши
              const playerPos = playerBodyRef.current.getPosition();
              currentBallRef.current.sprite.container.x = toPixels(playerPos.x);
              currentBallRef.current.sprite.container.y = FIXED_PLAYER_Y + 24; // Располагаем НИЖЕ игрока
              
              // Обновляем положение пунктирной линии
              updateTrajectoryLine(
                scene, 
                trajectoryLineRef,
                toPixels(playerPos.x), 
                FIXED_PLAYER_Y + 24,
                isPaused
              );
            }
          } catch (err) {
            console.error('Ошибка при обработке движения мыши:', err);
            }
          });
          
          // Обработчик клика мыши и тача для броска шара
          scene.input.on('pointerdown', (pointer: any) => {
            // Если игра на паузе, не обрабатываем клик
            if (isPaused) return;
            
            // Проверяем, что указатель находится в пределах игрового поля
            if (pointer.x < 0 || pointer.x > scene.sys.game.config.width || 
                pointer.y < 0 || pointer.y > scene.sys.game.config.height) {
              return; // Выходим, если указатель вышел за пределы игрового поля
            }
            
            // Проверяем, прошло ли достаточно времени с последнего броска
            const currentTime = Date.now();
            if (currentTime - lastThrowTime < MIN_THROW_INTERVAL) {
              console.log(`Слишком частые броски. Подождите ${((MIN_THROW_INTERVAL - (currentTime - lastThrowTime)) / 1000).toFixed(1)} сек.`);
              
              // Создаем визуальный индикатор охлаждения (cooldown)
              if (gameInstanceRef.current && gameInstanceRef.current.scene && gameInstanceRef.current.scene.scenes[0]) {
                const scene = gameInstanceRef.current.scene.scenes[0];
                // Добавляем текст с предупреждением
                const cooldownText = scene.add.text(
                  scene.cameras.main.width / 2,
                  scene.cameras.main.height / 2,
                  `Подождите ${((MIN_THROW_INTERVAL - (currentTime - lastThrowTime)) / 1000).toFixed(1)} сек.`,
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
                  targets: cooldownText,
                  alpha: 0,
                  y: scene.cameras.main.height / 2 - 50,
                  duration: 1000,
                  ease: 'Power2',
                  onComplete: () => {
                    cooldownText.destroy();
                  }
                });
              }
              
              return; // Выходим, если интервал между бросками слишком маленький
            }
            
            try {
              // Проверяем существование шара для броска
              if (!currentBallRef.current) {
                console.log('Шар для броска отсутствует, создаем новый');
                // Генерируем шар с вероятностями: 50% - уровень 1, 25% - уровень 2, 13% - уровень 3, 7% - уровень 4, 5% - уровень 5
                const newLevel = generateBallLevel();
                currentBallRef.current = createNextBall(scene, playerBodyRef, newLevel);
              }
              
              console.log('Вызываем throwBall', { 
                currentBall: !!currentBallRef.current,
                сцена: !!scene 
              });
              
              if (currentBallRef.current) {
                // Обновляем время последнего броска
                setLastThrowTime(currentTime);
                
                throwBall(
                  scene,
                  currentBallRef,
                  playerBodyRef,
                  worldRef,
                  ballsRef,
                  nextBallLevelRef,
                  trajectoryLineRef,
                  isPaused,
                  setFutureNextBallLevel
                );
              } else {
                console.error('Не удалось создать шар для броска');
              }
            } catch (error) {
              console.error('Ошибка при обработке клика для броска шара:', error);
            }
          });
        } catch (error: any) {
          console.error('Ошибка при регистрации обработчиков событий:', error);
        }
        
        // Добавляем обработку тачскрина
        try {
          scene.input.addPointer(3); // Поддержка до 5 касаний (2 по умолчанию + 3 дополнительных)
          
          // Предотвращаем дефолтные действия тачскрина
          scene.game.canvas.addEventListener('touchstart', function(e: TouchEvent) {
            e.preventDefault();
          }, { passive: false });
          
          scene.game.canvas.addEventListener('touchmove', function(e: TouchEvent) {
            e.preventDefault();
          }, { passive: false });
          
          scene.game.canvas.addEventListener('touchend', function(e: TouchEvent) {
            e.preventDefault();
          }, { passive: false });
        } catch (error: any) {
          console.error('Ошибка при настройке обработки тачскрина:', error);
        }
        
        // Запускаем загрузку ресурсов
        scene.load.start();
    };
    
    // Функция обновления сцены
    const updateScene = () => {
      // Если игра на паузе или вкладка не активна, пропускаем обновление физики и спрайтов
      if (isPaused || !isTabActive) return;
      
      // Ограничиваем частоту обновления для стабильности
      try {
      // Обновление физики
      if (worldRef.current) {
          worldRef.current.step(TIME_STEP, VELOCITY_ITERATIONS, POSITION_ITERATIONS);
      }
      
      // Обновление положения игрока в соответствии с физикой
      if (playerBodyRef.current && playerSprite) {
          const position = playerBodyRef.current.getPosition();
          playerSprite.x = toPixels(position.x);
          playerSprite.y = toPixels(position.y);
        
        // Делаем принудительный сброс скорости игрока, чтобы он не падал
          playerBodyRef.current.setLinearVelocity(planck.Vec2(0, 0));
        
        // Обновляем положение шара для броска, чтобы он всегда был точно над игроком
          if (currentBallRef.current && currentBallRef.current.sprite && 
              currentBallRef.current.sprite.container && !currentBallRef.current.sprite.container.destroyed) {
          // Позиционируем контейнер целиком
            currentBallRef.current.sprite.container.x = toPixels(position.x);
            currentBallRef.current.sprite.container.y = FIXED_PLAYER_Y + 24; // 24 пикселя НИЖЕ игрока
        }
      }
      
      // Обновление положения всех шаров
      for (const ball of ballsRef.current) {
          if (ball && ball.body && ball.sprite && ball.sprite.container) {
            const position = ball.body.getPosition();
          // Обновляем позицию контейнера шара
            ball.sprite.container.x = toPixels(position.x);
            ball.sprite.container.y = toPixels(position.y);
            
            // Обновляем также позицию контейнера эффектов для шаров максимального уровня
            if (ball.level === 12 && ball.sprite.effectsContainer) {
              ball.sprite.effectsContainer.x = toPixels(position.x);
              ball.sprite.effectsContainer.y = toPixels(position.y);
            }
          
          // Сбрасываем позиции спрайта и текста внутри контейнера, чтобы они остались центрированы
          if (ball.sprite.circle) {
              ball.sprite.circle.x = 0;
              ball.sprite.circle.y = 0;
          }
          
          if (ball.sprite.text) {
              ball.sprite.text.x = 0;
              ball.sprite.text.y = 0;
            }
          }
        }
        
        // Увеличиваем счетчик кадров
        frameCounterRef.current += 1;
        
        // Увеличиваем счетчик проверки зависших шаров
        stuckCheckCounterRef.current += 1;
        
        // Проверка зависших шаров
        if (stuckCheckCounterRef.current >= STUCK_CHECK_INTERVAL) {
          stuckCheckCounterRef.current = 0;
          checkStuckBalls();
        }
        
        // Проверка объединения шаров только каждые CHECK_MERGE_FREQUENCY кадров
        // Исключение: всегда проверяем помеченные шары для мгновенного слияния
        if (frameCounterRef.current >= CHECK_MERGE_FREQUENCY || 
            hasBallsMarkedForMerge(worldRef)) {
          
          // Сбрасываем счетчик кадров
          frameCounterRef.current = 0;
      
      // Проверка объединения шаров
          if (gameInstanceRef.current && gameInstanceRef.current.scene && gameInstanceRef.current.scene.scenes) {
            const scene = gameInstanceRef.current.scene.scenes[0];
            if (scene) {
              checkAndMergeBalls(scene, worldRef, ballsRef, frameCounterRef.current);
            }
          }
        }
      } catch (error) {
        console.error('Ошибка в updateScene:', error);
      }
    };
    
    // Функция для проверки и обработки зависших шаров
    const checkStuckBalls = () => {
      if (!worldRef.current || !gameInstanceRef.current) return;
      
      // Текущее время
      const now = Date.now();
      
      // Фильтруем массив шаров, оставляя только валидные
      // Используем более эффективный способ с обходом массива с конца
      for (let i = ballsRef.current.length - 1; i >= 0; i--) {
        const ball = ballsRef.current[i];
        if (!ball || !ball.body || !ball.sprite || !ball.sprite.container || ball.sprite.container.destroyed) {
          // Удаляем некорректные элементы
          ballsRef.current.splice(i, 1);
          continue;
        }
        
        // Чистим физические ресурсы мертвых шаров, которые не были правильно удалены
        if (ball.body && !ball.body.isActive()) {
          if (worldRef.current) {
            ball.body.setUserData(null);
            try {
              worldRef.current.destroyBody(ball.body);
            } catch (e) {
              console.warn("Ошибка при удалении неактивного тела:", e);
            }
          }
          ballsRef.current.splice(i, 1);
          continue;
        }
        
        // Больше не проверяем и не удаляем "застрявшие" шары
      }
      
      // Проверяем, не слишком ли много шаров на игровом поле
      if (ballsRef.current.length > MAX_BALLS_COUNT * 0.9) {
        // Но не удаляем шары совсем, просто предупреждаем в консоли
        console.log(`Много шаров на поле: ${ballsRef.current.length}/${MAX_BALLS_COUNT}`);
      }
    };
    
    // Функция для удаления одного шара
    const removeBall = (ball: Ball) => {
      if (!ball) return;
      
      // Добавляем эффект исчезновения, если есть доступ к сцене
      if (gameInstanceRef.current && gameInstanceRef.current.scene && ball.body) {
        const scene = gameInstanceRef.current.scene.scenes[0];
        if (scene) {
          const position = ball.body.getPosition();
          const fadeEffect = scene.add.circle(
            position.x * 30, 
            position.y * 30, 
            30, 
            0xffffff, 
            0.7
          );
          
          // Анимируем исчезновение
          scene.tweens.add({
            targets: fadeEffect,
            alpha: 0,
            scale: 0.5,
            duration: 200,
            onComplete: () => {
              if (fadeEffect && !fadeEffect.destroyed) {
                fadeEffect.destroy();
              }
            }
          });
        }
      }
      
      // Удаляем шар из физического мира
      if (ball.body && worldRef.current) {
        try {
          ball.body.setUserData(null);
          worldRef.current.destroyBody(ball.body);
        } catch (e) {
          console.warn("Ошибка при удалении физического тела шара:", e);
        }
      }
      
      // Удаляем визуальное представление шара
      if (ball.sprite && ball.sprite.container && !ball.sprite.container.destroyed) {
        try {
          ball.sprite.container.destroy();
        } catch (e) {
          console.warn("Ошибка при удалении спрайта шара:", e);
        }
      }
      
      // Удаляем эффекты для шаров максимального уровня
      if (ball.sprite.effectsContainer && !ball.sprite.effectsContainer.destroyed) {
        try {
          ball.sprite.effectsContainer.destroy();
        } catch (e) {
          console.warn("Ошибка при удалении эффектов шара:", e);
        }
      }
    };
    
    // Функция для поиска нижних шаров
    const findBottomBalls = (count: number): Ball[] => {
      if (!ballsRef.current.length) return [];
      
      // Создаем копию массива шаров и сортируем по Y-координате (самые нижние вначале)
      return [...ballsRef.current]
        .filter(ball => ball && ball.body)
        .sort((a, b) => {
          if (!a.body || !b.body) return 0;
          return b.body.getPosition().y - a.body.getPosition().y;
        })
        .slice(0, count);
    };
    
    // Функция для удаления нижних шаров
    const removeBottomBalls = (balls: Ball[]) => {
      if (!balls.length) return;
      
      for (const ball of balls) {
        if (!ball) continue;
        
        // Используем функцию removeBall для единообразного удаления
        removeBall(ball);
        
        // Удаляем шар из списка потенциально зависших
        potentiallyStuckBallsRef.current.delete(ball);
      }
      
      // Обновляем массив шаров - удаляем все удаленные шары
      ballsRef.current = ballsRef.current.filter(ball => 
        ball && balls.indexOf(ball) === -1
      );
      
      // Запускаем явную очистку мусора
      if (typeof global !== 'undefined' && global.gc) {
        try {
          global.gc();
        } catch (e) {
          console.warn("Не удалось запустить сборщик мусора:", e);
        }
      }
    };
    
    // Динамически импортируем Phaser только на клиенте
    const initGame = async () => {
      try {
        setIsLoading(true);
        setDebugMessage("Загрузка Phaser...");
        
        // Логируем размеры шаров для разных уровней
        console.log('Размеры шаров:');
        for (let i = 1; i <= 12; i++) {
          console.log(`Уровень ${i}: ${getBallSize(i)} пикселей`);
        }
        
        // Динамически импортируем Phaser
        const Phaser = await import('phaser');
        
        if (!isMounted || !gameContainerRef.current) {
          setDebugMessage("Компонент размонтирован или контейнер исчез");
          return;
        }
        
        setDebugMessage("Phaser загружен, инициализируем игру...");
        
        // Получаем размеры контейнера
        const containerRect = gameContainerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        
        // Расчет доступного пространства с учетом отступов
        const headerHeightPx = window.innerWidth < 640 ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT;
        const newAvailableWidth = containerWidth - safetyMargin * 2;
        const newAvailableHeight = containerHeight - headerHeightPx - safetyMargin * 2;
        
        // Сохраняем соотношение сторон (ширина к высоте 2:3)
        const aspectRatio = GAME_ASPECT_RATIO;
        
        // Определяем новые размеры с сохранением пропорций
        let newGameWidth, newGameHeight;
        
        // Если ограничивает ширина
        if (newAvailableHeight / aspectRatio > newAvailableWidth) {
          newGameWidth = newAvailableWidth;
          newGameHeight = newAvailableWidth / aspectRatio;
        } 
        // Если ограничивает высота
        else {
          newGameHeight = newAvailableHeight;
          newGameWidth = newAvailableHeight * aspectRatio;
        }
        
        // Округляем размеры до целых чисел для предотвращения рывков при масштабировании
        newGameWidth = Math.floor(newGameWidth);
        newGameHeight = Math.floor(newGameHeight);
        
        setDebugMessage(`Размеры игрового контейнера: ${containerWidth}x${containerHeight}, 
                         размеры игры: ${newGameWidth}x${newGameHeight}`);
        
        // Создаем конфигурацию игры
        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO,
          width: newGameWidth,
          height: newGameHeight,
          parent: gameContainerRef.current,
          backgroundColor: 0x000000,
          transparent: true,
          canvasStyle: 'display: block; width: 100%; height: 100%; margin: 0; padding: 0; object-fit: contain; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);',
          scale: {
            mode: Phaser.Scale.NONE, // Отключаем автоматическое масштабирование Phaser
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
          physics: {
            default: 'arcade',
            arcade: {
              gravity: { x: 0, y: 0 },
              debug: false
            }
          },
          scene: {
            create: function(this: any) {
              createScene(this, Phaser, newGameWidth, newGameHeight);
            },
            update: function() {
              updateScene();
            }
          }
        };
        
        // Создаем экземпляр игры
        const game = new Phaser.Game(config);
        gameInstanceRef.current = game;
        
        // Устанавливаем стиль для canvas, чтобы масштабирование работало корректно
        if (game.canvas) {
          game.canvas.style.width = '100%';
          game.canvas.style.height = '100%';
          game.canvas.style.objectFit = 'contain'; // Сохраняем пропорции
          game.canvas.style.maxWidth = `${newGameWidth}px`;
          game.canvas.style.maxHeight = `${newGameHeight}px`;
          game.canvas.style.margin = '0';
          game.canvas.style.padding = '0';
          game.canvas.style.position = 'absolute';
          game.canvas.style.bottom = '0';
          game.canvas.style.left = '50%';
          game.canvas.style.transform = 'translateX(-50%)';
        }
        
        // Добавляем обработчик изменения размера окна
        const handleResize = () => {
          if (!gameContainerRef.current || !game) return;
          
          const newContainerRect = gameContainerRef.current.getBoundingClientRect();
          const newContainerWidth = newContainerRect.width;
          const newContainerHeight = newContainerRect.height;
          
          // Определяем высоту хедера и футера
          const headerHeightPx = window.innerWidth < 640 ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT;
          
          const newAvailableWidth = newContainerWidth - safetyMargin * 2;
          const newAvailableHeight = newContainerHeight - headerHeightPx - safetyMargin * 2;
          
          // Сохраняем соотношение сторон (ширина к высоте 2:3)
          const aspectRatio = GAME_ASPECT_RATIO;
          
          // Определяем новые размеры с сохранением пропорций
          let newGameWidth, newGameHeight;
          
          // Если ограничивает ширина
          if (newAvailableHeight / aspectRatio > newAvailableWidth) {
            newGameWidth = newAvailableWidth;
            newGameHeight = newAvailableWidth / aspectRatio;
          } 
          // Если ограничивает высота
          else {
            newGameHeight = newAvailableHeight;
            newGameWidth = newAvailableHeight * aspectRatio;
          }
          
          // Округляем размеры до целых чисел для предотвращения рывков при масштабировании
          newGameWidth = Math.floor(newGameWidth);
          newGameHeight = Math.floor(newGameHeight);
          
          // Сохраняем предыдущие размеры для плавного перехода
          const prevWidth = game.scale.width;
          const prevHeight = game.scale.height;
          
          // Проверяем, достаточно ли изменился размер для перерисовки (минимум 5 пикселей)
          const minResizeThreshold = 5;
          if (Math.abs(newGameWidth - prevWidth) < minResizeThreshold && 
              Math.abs(newGameHeight - prevHeight) < minResizeThreshold) {
            return; // Не обновляем, если изменение слишком маленькое
          }
          
          // Обновляем размер игры
          game.scale.resize(newGameWidth, newGameHeight);
          game.scale.refresh();
          
          // Обновляем стили canvas для корректного масштабирования
          if (game.canvas) {
            game.canvas.style.width = '100%';
            game.canvas.style.height = '100%';
            game.canvas.style.objectFit = 'contain';
            game.canvas.style.maxWidth = `${newGameWidth}px`;
            game.canvas.style.maxHeight = `${newGameHeight}px`;
            game.canvas.style.margin = '0';
            game.canvas.style.padding = '0';
            game.canvas.style.position = 'absolute';
            game.canvas.style.bottom = '0';
            game.canvas.style.left = '50%';
            game.canvas.style.transform = 'translateX(-50%)';
          }
          
          // Пересоздаем физический мир с новыми размерами
          if (worldRef.current) {
            // Сохраняем текущие шары
            const currentBalls = [...ballsRef.current];
            
            // Очищаем существующие тела (кроме шаров)
            if (floorRef.current) worldRef.current.destroyBody(floorRef.current);
            if (leftWallRef.current) worldRef.current.destroyBody(leftWallRef.current);
            if (rightWallRef.current) worldRef.current.destroyBody(rightWallRef.current);
            if (topWallRef.current) worldRef.current.destroyBody(topWallRef.current);
            
            // Пересоздаем физический мир
            createPhysicsWorld(newGameWidth, newGameHeight, physicsRefs);
            
            // Обновляем положение деревьев и других элементов сцены
            if (gameInstanceRef.current && gameInstanceRef.current.scene.scenes[0]) {
              const scene = gameInstanceRef.current.scene.scenes[0];
              
              // Обновляем позиции и размеры всех объектов сцены
              scene.children.list.forEach((child: any) => {
                if (child.type === 'Image') {
                  if (child.texture && child.texture.key === 'trees') {
                    child.setDisplaySize(newGameWidth, newGameHeight);
                    child.setPosition(newGameWidth / 2, 0);
                  } else if (child.texture && child.texture.key === 'floor') {
                    const floorHeight = PHYSICAL_FLOOR_HEIGHT;
                    // Размещаем пол точно в соответствии с его физическим положением
                    child.setDisplaySize(newGameWidth, floorHeight);
                    child.setPosition(newGameWidth / 2, newGameHeight - floorHeight / 2);
                  }
                } else if (child.type === 'Text') {
                  // Обновляем положение текстовых инструкций
                  if (child.y < 100) { // Предполагаем, что инструкции находятся в верхней части экрана
                    child.setPosition(newGameWidth / 2, 64);
                  }
                } else if (child.type === 'Graphics') {
                  // Проверяем, относится ли этот графический элемент к пунктирной линии
                  // Учитывая что trajectoryLineRef.current не содержит прямой ссылки на graphics,
                  // проверяем совпадение по положению, если линия существует
                  if (trajectoryLineRef.current) {
                    // Пересоздаем линию траектории при изменении размера окна
                    trajectoryLineRef.current.destroy();
                    
                    // Пересоздаем траекторию, если есть текущий шар
                    if (currentBallRef.current && currentBallRef.current.sprite) {
                      createTrajectoryLine(
                        scene,
                        trajectoryLineRef,
                        currentBallRef.current.sprite.container.x,
                        currentBallRef.current.sprite.container.y
                      );
                    }
                  }
                } else if (child.type === 'Arc' && playerSprite === child) {
                  // Обновляем положение игрока
                  playerSprite.setPosition(newGameWidth / 2, FIXED_PLAYER_Y);
                  // Масштабируем размер игрока в зависимости от нового размера игры
                  const newScaleFactor = newGameWidth / BASE_GAME_WIDTH;
                  const newPlayerSize = PLAYER_SIZE * newScaleFactor;
                  playerSprite.setRadius(newPlayerSize);
                  
                  // Также обновляем физическую позицию игрока
                  if (playerBodyRef.current) {
                    const physicsX = newGameWidth / 2 / SCALE; // Используем SCALE из импортов
                    const physicsY = FIXED_PLAYER_Y / SCALE;
                    playerBodyRef.current.setPosition(planck.Vec2(physicsX, physicsY));
                  }
                }
              });
              
              // Обновляем размеры и положение контейнера для шара
              if (currentBallRef.current && currentBallRef.current.sprite && 
                  currentBallRef.current.sprite.container && !currentBallRef.current.sprite.container.destroyed) {
                // Устанавливаем шар над игроком по центру
                const centerX = newGameWidth / 2;
                currentBallRef.current.sprite.container.x = centerX;
                currentBallRef.current.sprite.container.y = FIXED_PLAYER_Y + 24;
                
                // Масштабируем размер шара в зависимости от нового размера игры
                const newBallSize = getBallSize(currentBallRef.current.level, newGameWidth);
                if (currentBallRef.current.sprite.circle) {
                  currentBallRef.current.sprite.circle.setRadius(newBallSize);
                }
                
                // Обновляем размер текста
                if (currentBallRef.current.sprite.text) {
                  const newScaleFactor = newGameWidth / BASE_GAME_WIDTH;
                  const fontSize = Math.max(Math.min(14, 10 + currentBallRef.current.level) * newScaleFactor, 8);
                  currentBallRef.current.sprite.text.setFontSize(`${fontSize}px`);
                }
                
                // Обновляем или пересоздаем пунктирную линию с новыми координатами
                if (trajectoryLineRef.current) {
                  updateTrajectoryLine(
                    scene,
                    trajectoryLineRef, 
                    centerX,
                    FIXED_PLAYER_Y + 24,
                    isPaused
                  );
                }
              }
              
              // Обновляем все существующие шары на сцене
              ballsRef.current.forEach(ball => {
                if (ball && ball.sprite && ball.sprite.container && !ball.sprite.container.destroyed) {
                  // Получаем физическую позицию шара (до обновления размера)
                  const oldPos = ball.body.getPosition();
                  
                  // Вычисляем соотношение нового размера игры к исходному размеру
                  const oldGameWidth = ball.originalGameWidth || BASE_GAME_WIDTH;
                  const scaleFactor = newGameWidth / oldGameWidth;
                  
                  // Масштабируем позицию шара относительно размера игры
                  // Конвертируем в пиксели, масштабируем и обратно в физические единицы
                  const oldPixelX = oldPos.x * SCALE;
                  const oldPixelY = oldPos.y * SCALE;
                  
                  const newPixelX = oldPixelX * scaleFactor;
                  const newPixelY = oldPixelY * scaleFactor;
                  
                  // Устанавливаем новую позицию для физического тела
                  ball.body.setPosition(planck.Vec2(newPixelX / SCALE, newPixelY / SCALE));
                  
                  // Обновляем размер шара в зависимости от нового размера игры
                  const newBallSize = getBallSize(ball.level, newGameWidth);
                  if (ball.sprite.circle) {
                    ball.sprite.circle.setRadius(newBallSize);
                  }
                  
                  // Также обновляем и физический размер шара
                  const fixtures = ball.body.getFixtureList();
                  if (fixtures) {
                    // Получаем новый радиус шара для физики
                    const newPhysicalRadius = getBallPhysicsSize(ball.level, newGameWidth);
                    
                    // Удаляем старую фикстуру
                    ball.body.destroyFixture(fixtures);
                    
                    // Создаем новую фикстуру с обновленным размером
                    const newCircleShape = planck.Circle(newPhysicalRadius);
                    ball.body.createFixture({
                      shape: newCircleShape,
                      density: BALL_DENSITY,
                      friction: BALL_FRICTION,
                      restitution: BALL_RESTITUTION,
                      filterGroupIndex: 0,
                    });
                  }
                  
                  // Обновляем размер текста
                  if (ball.sprite.text) {
                    const newScaleFactor = newGameWidth / BASE_GAME_WIDTH;
                    const fontSize = Math.max(Math.min(18, 12 + ball.level) * newScaleFactor, 8);
                    ball.sprite.text.setFontSize(`${fontSize}px`);
                  }
                  
                  // Обновляем эффекты для шаров максимального уровня
                  if (ball.level === 12 && ball.sprite.effectsContainer) {
                    ball.sprite.effectsContainer.list.forEach((effect: any) => {
                      if (effect.type === 'Arc') {
                        effect.setRadius(newBallSize * 1.2);
                      }
                    });
                  }
                  
                  // Обновляем сохраненный размер игры для шара
                  ball.originalGameWidth = newGameWidth;
                }
              });
            }
          }
        };
        
        // Добавляем слушатель события изменения размера окна
        window.addEventListener('resize', handleResize);
        
        // Сохраняем функцию обработчика для последующего удаления
        resizeHandler = handleResize;
        
      } catch (error) {
        console.error('Ошибка при инициализации Phaser:', error);
        setDebugMessage("Критическая ошибка: " + (error instanceof Error ? error.message : String(error)));
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    };
    
    initGame();
    
    // Очистка при размонтировании
    return () => {
      isMounted = false;
      setDebugMessage("Размонтирование компонента...");
      
      // Приостанавливаем все процессы перед удалением
      setIsPaused(true);
      
      // Удаляем canvas элемент, если он существует
      try {
        // Найдем canvas элемент с указанным селектором и удалим его
        const canvasElement = document.querySelector("body > main > div > div.relative.w-full.h-full.flex.flex-col.items-center.justify-center > div.fixed.inset-0.z-\\[9999\\].flex.items-center.justify-center.bg-black.bg-opacity-90 > div > div.flex-grow.overflow-hidden.flex.items-center.justify-center > canvas");
        if (canvasElement) {
          canvasElement.remove();
        }
        
        // Удаляем элемент с дополнительным селектором
        const additionalElement = document.querySelector("body > main > div > div.relative.w-full.h-full.flex.flex-col.items-center.justify-center > div.relative.z-10.p-6.bg-gray-800.rounded-xl.shadow-xl.border.border-gray-700.max-w-md.w-full.text-center");
        if (additionalElement) {
          additionalElement.remove();
        }
      } catch (error) {
        console.error('Ошибка при удалении элементов:', error);
      }
      
      // Удаляем обработчик изменения размера, если он был установлен
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
      
      // Очищаем ресурсы
      cleanupResources();
      
      // Уничтожаем экземпляр игры Phaser
      if (gameInstanceRef.current) {
        try {
          gameInstanceRef.current.destroy(true);
          gameInstanceRef.current = null;
        } catch (error) {
          console.error('Ошибка при уничтожении Phaser игры:', error);
        }
      }
      
      // Очищаем Map потенциально зависших шаров
      potentiallyStuckBallsRef.current.clear();
    };
  }, []);
  
  // Функция для очистки ресурсов
  const cleanupResources = () => {
    // Останавливаем все активные анимации и твины
    if (gameInstanceRef.current && gameInstanceRef.current.scene) {
      try {
        const scene = gameInstanceRef.current.scene.scenes[0];
        if (scene && scene.tweens) {
          scene.tweens.pauseAll();
        }
      } catch (error) {
        console.error('Ошибка при остановке анимаций:', error);
      }
    }
    
    // Очищаем все шары
    try {
      for (const ball of ballsRef.current) {
        if (ball && ball.body && worldRef.current) {
          ball.body.setUserData(null);
          worldRef.current.destroyBody(ball.body);
        }
        if (ball && ball.sprite && ball.sprite.container && !ball.sprite.container.destroyed) {
          ball.sprite.container.destroy();
        }
        if (ball && ball.level === 12 && ball.sprite.effectsContainer && !ball.sprite.effectsContainer.destroyed) {
          ball.sprite.effectsContainer.destroy();
        }
      }
      ballsRef.current = [];
    } catch (error) {
      console.error('Ошибка при очистке шаров:', error);
    }
    
    // Уничтожаем пунктирную линию
    if (trajectoryLineRef.current) {
      trajectoryLineRef.current.destroy();
      trajectoryLineRef.current = null;
    }
  };
  
  // Функция для изменения типа шара для броска
  const changeSpecialBall = (type: string) => {
    // Проверяем, достаточно ли ресурсов для использования специальной возможности
    if (!canUseSpecialFeature(type)) {
      const cost = specialCosts[type as keyof typeof specialCosts] || 0;
      const actualCost = (cost / 100) * containerCapacity;
      console.log(`Недостаточно SnotCoin для использования ${type}. Требуется ${actualCost.toFixed(4)}`);
      return; // Выходим, если ресурсов недостаточно
    }
    
    // Списываем стоимость использования
    deductResourceCost(type);
    
    setSpecialBallType(type);
    
    // Меняем текущий шар для броска, если он существует
    if (currentBallRef.current && gameInstanceRef.current && gameInstanceRef.current.scene.scenes[0]) {
      const scene = gameInstanceRef.current.scene.scenes[0];
      
      // Удаляем текущий шар
      if (currentBallRef.current.sprite && 
          currentBallRef.current.sprite.container && 
          !currentBallRef.current.sprite.container.destroyed) {
        currentBallRef.current.sprite.container.destroy();
      }
      
      // Безопасное уничтожение пунктирной линии
      if (trajectoryLineRef.current) {
        trajectoryLineRef.current.destroy();
        trajectoryLineRef.current = null;
      }
      
      // Создаем новый шар выбранного типа
      const level = type === 'Bull' ? 10 : (type === 'Bomb' ? 12 : generateBallLevel());
      currentBallRef.current = createNextBall(scene, playerBodyRef, level, type);
      
      // Создаем новую пунктирную линию
      if (currentBallRef.current && currentBallRef.current.sprite) {
        createTrajectoryLine(
          scene, 
          trajectoryLineRef,
          currentBallRef.current.sprite.container.x, 
          currentBallRef.current.sprite.container.y
        );
      }
    }
  };
  
  // Функция для применения эффекта Joy ко всем шарам
  const applyJoyEffect = () => {
    // Проверяем, достаточно ли ресурсов для использования Joy
    if (!canUseSpecialFeature('Joy')) {
      const actualCost = (specialCosts.Joy / 100) * containerCapacity;
      console.log(`Недостаточно SnotCoin для использования Joy. Требуется ${actualCost.toFixed(4)}`);
      return; // Выходим, если ресурсов недостаточно
    }
    
    // Списываем стоимость использования Joy
    deductResourceCost('Joy');
    
    if (!worldRef.current) return;
    
    // Применяем случайный импульс к каждому шару
    ballsRef.current.forEach(ball => {
      if (ball && ball.body) {
        // Генерируем случайный вектор силы
        const forceX = (Math.random() * 2 - 1) * 0.5; // от -0.5 до 0.5
        const forceY = (Math.random() * 2 - 1) * 0.5; // от -0.5 до 0.5
        
        // Применяем импульс к шару
        ball.body.applyLinearImpulse(planck.Vec2(forceX, forceY), ball.body.getPosition());
        ball.body.setAwake(true); // Убеждаемся, что шар активен
      }
    });
  };
  
  // Компонент кнопок для футера
  const FooterButtons = ({
    onBullClick,
    onBombClick,
    onJoyClick
  }: {
    onBullClick: () => void;
    onBombClick: () => void;
    onJoyClick: () => void;
  }) => {
    return (
      <div className="absolute bottom-0 left-0 right-0 flex justify-center items-center pb-2 z-20">
        <div className="flex space-x-4">
          <button
            onClick={onBullClick}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-lg shadow-lg transition-transform transform hover:scale-105"
          >
            Bull
          </button>
          <button
            onClick={onBombClick}
            className="bg-black hover:bg-gray-900 text-white font-bold py-1 px-3 rounded-lg shadow-lg transition-transform transform hover:scale-105"
          >
            Bomb
          </button>
          <button
            onClick={onJoyClick}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-3 rounded-lg shadow-lg transition-transform transform hover:scale-105"
          >
            Joy
          </button>
        </div>
      </div>
    );
  };
  
  // Заменим использование togglePause новой функцией, которая также устанавливает флаг userPausedGame
  const handleTogglePause = () => {
    const newPauseState = !isPaused;
    if (newPauseState) {
      // Устанавливаем флаг пользовательской паузы только при включении паузы
      setUserPausedGame(true);
    }
    // Вызываем оригинальную функцию
    togglePause();
  };
  
  // Также модифицируем resumeGame, чтобы сбрасывать флаг пользовательской паузы
  const handleResumeGame = () => {
    setUserPausedGame(false);
    resumeGame();
  };
  
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
              onBullClick={() => changeSpecialBall('Bull')}
              onBombClick={() => changeSpecialBall('Bomb')}
              onJoyClick={applyJoyEffect}
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
          onClose={onClose}
        />
      )}
    </div>
  );
};

export default MergeGameClient;