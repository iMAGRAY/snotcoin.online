'use client'

import React, { useState, useEffect, useRef } from 'react';
import * as planck from 'planck';
import { Ball, MergeGameProps, PhaserType, TrajectoryRef } from './types';
import { usePhysicsWorld } from './hooks/usePhysicsWorld';
import { useGameState } from './hooks/useGameState';
import { createPhysicsWorld } from './physics/createPhysicsWorld';
import { createBall } from './physics/createBall';
import { createNextBall } from './physics/createNextBall'; 
import { throwBall } from './physics/throwBall';
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
  FALL_TIMEOUT_MS
} from './constants/gameConstants';
import GameHeader from './components/GameHeader';
import PauseMenu from './components/PauseMenu';
import LoadingScreen from './components/LoadingScreen';

// Константа для частоты проверки "зависших" шаров
const STUCK_CHECK_INTERVAL = 30;

const MergeGameClient: React.FC<MergeGameProps> = ({ onClose }) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<any>(null);
  const ballsRef = useRef<Ball[]>([]);
  const nextBallLevelRef = useRef<number>(1);
  const currentBallRef = useRef<{sprite: any, level: number} | null>(null);
  const trajectoryLineRef = useRef<TrajectoryRef | null>(null);
  const frameCounterRef = useRef<number>(0);
  
  // Добавляем счетчик кадров для проверки зависших шаров
  const stuckCheckCounterRef = useRef<number>(0);
  
  // Добавляем Map для отслеживания потенциально зависших шаров и их времени
  const potentiallyStuckBallsRef = useRef<Map<Ball, number>>(new Map());
  
  // Используем хуки для состояний
  const {
    isLoading, setIsLoading,
    hasError, setHasError,
    debugMessage, setDebugMessage,
    futureNextBallLevel, setFutureNextBallLevel,
    isPaused, setIsPaused,
    isTabActive,
    togglePause, resumeGame
  } = useGameState();
  
  // Используем хук для физического мира
  const physicsRefs = usePhysicsWorld();
  const { worldRef, playerBodyRef, leftWallRef, rightWallRef, topWallRef, floorRef } = physicsRefs;
  
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
        
        // Создаем графический объект для отрисовки границ игрового поля
        const graphics = scene.add.graphics();
        
        // Добавляем деревья поверх стен
        scene.add.image(gameWidth / 2, 0, 'trees')
          .setOrigin(0.5, 0)
          .setDisplaySize(gameWidth, gameHeight)
          .setDepth(100); // Высокое значение глубины для отображения поверх стен
        
        // Создаем игрока (круг) в центре по горизонтали
        playerSprite = scene.add.circle(gameWidth / 2, FIXED_PLAYER_Y, 25, 0xbbeb25);
        
        // Создаем физические объекты с учетом размеров игрового поля
        createPhysicsWorld(gameWidth, gameHeight, physicsRefs);
        
        // Сначала генерируем текущий шар
        const currentLevel = Math.floor(Math.random() * 3) + 1;
        currentBallRef.current = createNextBall(scene, playerBodyRef, currentLevel);
        
        // Затем генерируем будущий шар и обновляем интерфейс
        nextBallLevelRef.current = Math.floor(Math.random() * 3) + 1;
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
        
        // Создаем графику для отладки физики
        const debugGraphics = scene.add.graphics();
        debugGraphics.setDepth(1000); // Высокое значение глубины для отображения поверх других объектов
        
        // Добавляем preload только для существующего изображения
        scene.load.image('trees', '/images/merge/Game/ui/trees.webp');
        
        // Ждем завершения загрузки ресурсов
        scene.load.once('complete', () => {
          try {
            console.log('Загрузка ресурсов завершена, настраиваем сцену');
            
            // Создаем графический объект для отрисовки границ игрового поля
            const graphics = scene.add.graphics();
            
            // Добавляем деревья поверх стен
            scene.add.image(gameWidth / 2, 0, 'trees')
              .setOrigin(0.5, 0)
              .setDisplaySize(gameWidth, gameHeight)
              .setDepth(100); // Высокое значение глубины для отображения поверх стен
            
            // Создаем игрока (круг) в центре по горизонтали
            playerSprite = scene.add.circle(gameWidth / 2, FIXED_PLAYER_Y, 25, 0xbbeb25);
            
            // Создаем физические объекты с учетом размеров игрового поля
            createPhysicsWorld(gameWidth, gameHeight, physicsRefs);
            
            // Сначала генерируем текущий шар
            const currentLevel = Math.floor(Math.random() * 3) + 1;
            currentBallRef.current = createNextBall(scene, playerBodyRef, currentLevel);
            
            // Затем генерируем будущий шар и обновляем интерфейс
            nextBallLevelRef.current = Math.floor(Math.random() * 3) + 1;
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
      };
      
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
          
          try {
            // Проверяем существование шара для броска
            if (!currentBallRef.current) {
              console.log('Шар для броска отсутствует, создаем новый');
              nextBallLevelRef.current = Math.floor(Math.random() * 3) + 1;
              currentBallRef.current = createNextBall(scene, playerBodyRef, nextBallLevelRef.current);
            }
            
            console.log('Вызываем throwBall', { 
              currentBall: !!currentBallRef.current,
              сцена: !!scene 
            });
            
            if (currentBallRef.current) {
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
      
      // Уменьшаем отступы безопасности для увеличения игровой зоны
      const safetyMargin = 10; // уменьшаем отступ от краев контейнера в пикселях
      const availableWidth = containerWidth - safetyMargin * 2;
      const availableHeight = containerHeight - safetyMargin * 2;
      
      // Устанавливаем игру на полную ширину доступного пространства
      let gameWidth = availableWidth;
      let gameHeight = availableHeight;
      
      // Округляем размеры до целых чисел
      gameWidth = Math.floor(gameWidth);
      gameHeight = Math.floor(gameHeight);
      
      setDebugMessage(`Размеры игрового контейнера: ${containerWidth}x${containerHeight}, 
                       размеры игры: ${gameWidth}x${gameHeight}`);
      
      // Создаем конфигурацию игры
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: gameWidth,
        height: gameHeight,
        parent: gameContainerRef.current,
        backgroundColor: 0x000000,
        transparent: true,
        canvasStyle: 'display: block; width: 100%; height: 100%;',
        scale: {
          mode: Phaser.Scale.NONE,
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
            createScene(this, Phaser, gameWidth, gameHeight);
          },
          update: function() {
            updateScene();
          }
        }
      };
      
      // Создаем экземпляр игры
      const game = new Phaser.Game(config);
      gameInstanceRef.current = game;
      
      // Добавляем обработчик изменения размера окна
      const handleResize = () => {
        if (!gameContainerRef.current || !game) return;
        
        const newContainerRect = gameContainerRef.current.getBoundingClientRect();
        const newContainerWidth = newContainerRect.width;
        const newContainerHeight = newContainerRect.height;
        
        // Используем те же уменьшенные отступы для пересчета
        const safetyMargin = 10;
        const newAvailableWidth = newContainerWidth - safetyMargin * 2;
        
        // Определяем высоту футера для текущего размера экрана
        const footerHeightPx = window.innerWidth < 640 ? 16 : 28;
        
        // Вычисляем размер игровой области с учетом футера
        const newAvailableHeight = newContainerHeight - safetyMargin * 2 - footerHeightPx;
        
        // Устанавливаем новую игру на доступное пространство
        let newGameWidth = newAvailableWidth;
        let newGameHeight = newAvailableHeight;
        
        // Округляем размеры
        newGameWidth = Math.floor(newGameWidth);
        newGameHeight = Math.floor(newGameHeight);
        
        // Обновляем размер игры
        game.scale.resize(newGameWidth, newGameHeight);
        game.scale.refresh();
        
        // Пересоздаем физический мир с новыми размерами
          if (worldRef.current) {
          // Очищаем существующие тела (кроме шаров)
          if (floorRef.current) worldRef.current.destroyBody(floorRef.current);
          if (leftWallRef.current) worldRef.current.destroyBody(leftWallRef.current);
          if (rightWallRef.current) worldRef.current.destroyBody(rightWallRef.current);
          if (topWallRef.current) worldRef.current.destroyBody(topWallRef.current);
          
          // Пересоздаем физический мир
          createPhysicsWorld(newGameWidth, newGameHeight, physicsRefs);
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
      // Найдем canvas элемент и удалим его, чтобы избежать проблемы с оставшимся canvas
      const canvasElement = document.querySelector("body > main > div > div.relative.w-full.h-full.flex.flex-col.items-center.justify-center > div.fixed.inset-0.z-\\[9999\\].flex.items-center.justify-center.bg-black.bg-opacity-90 > div > div.relative.flex-grow.overflow-hidden.flex.items-center.justify-center > canvas");
      if (canvasElement) {
        canvasElement.remove();
      }
    } catch (error) {
      console.error('Ошибка при удалении canvas элемента:', error);
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

return (
  <div className="fixed inset-0 z-[9999] flex items-stretch justify-center bg-black bg-opacity-90" 
       style={{ 
         backgroundImage: 'url(/images/merge/Game/BackGround.webp)',
         backgroundSize: 'cover',
         backgroundPosition: 'center'
       }}>
    <div className="w-full max-w-6xl mx-auto flex flex-col h-full">
      {/* Верхняя панель (шапка) */}
      <div className="flex-shrink-0">
        <GameHeader 
          togglePause={togglePause} 
          futureNextBallLevel={futureNextBallLevel}
          onClose={onClose}
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
            zIndex: 1
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
          className="w-full h-16 sm:h-28"
          style={{
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.03), rgba(0,0,0,0.2))',
            borderTop: '1px solid rgba(255,255,255,0.15)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.15)',
            backdropFilter: 'blur(3px)'
          }}
        >
          {/* Декоративные элементы футера */}
          <div className="w-full h-full flex justify-between items-center">
            <div className="w-1/3 h-[1px] ml-10 bg-gradient-to-r from-transparent to-white opacity-20"></div>
            <div className="h-[60%] flex items-center">
              <div className="w-12 h-[2px] bg-gradient-to-r from-transparent to-white opacity-10"></div>
              <div className="w-20 h-[3px] mx-2 bg-white opacity-5 rounded-full"></div>
              <div className="w-12 h-[2px] bg-gradient-to-l from-transparent to-white opacity-10"></div>
           </div>
            <div className="w-1/3 h-[1px] mr-10 bg-gradient-to-l from-transparent to-white opacity-20"></div>
        </div>
      </div>
    </div>
  </div>
  
  {/* Меню паузы */}
  {isPaused && (
    <PauseMenu 
      resumeGame={resumeGame}
      onClose={onClose}
    />
  )}
</div>