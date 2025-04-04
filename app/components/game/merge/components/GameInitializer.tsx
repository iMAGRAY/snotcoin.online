'use client'

import React, { useEffect, useRef, useState, useContext } from 'react';
import * as planck from 'planck';
import Phaser from 'phaser';
import { createPhysicsWorld } from '../physics/createPhysicsWorld';
import { createNextBall } from '../physics/createNextBall';
import { createTrajectoryLine, updateTrajectoryLine } from '../physics/trajectoryLine';
import { generateBallLevel } from '../physics/throwBall';
import { setupNormalBallsCollisions, isBodyDestroyed } from '../utils/bodyUtils';
import { setupSpecialBallsCollisions } from '../physics/collisionHandlers';
import { throwBall } from '../physics/throwBall';
import { checkAndMergeBalls } from '../physics/checkAndMergeBalls';
import { BASE_GAME_WIDTH, FIXED_PLAYER_Y, GAME_ASPECT_RATIO, PLAYER_SIZE, WALL_COLOR, GRAVITY_Y, SCALE, PHYSICS_PLAYER_Y } from '../constants/gameConstants';
import { ExtendedBall, ExtendedNextBall, TrajectoryRef } from '../types';
import { updateBallsOnResize } from '../utils/ballUtils';
import { updateSceneElements } from '../utils/sceneUtils';
import { ScaleType, MergeGameProps } from '../types/gameTypes';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { initWorld } from '../physics/world';
import { createSpecialBall } from '../utils/specialBalls';

// Время последнего броска для ограничения частоты бросков
let lastThrowTime = 0;

// Система перегрева для бросков
let overheatingLevel = 0; // 0-100
const OVERHEAT_THRESHOLD = 100; // Максимальный уровень перегрева
const OVERHEAT_INCREASE_PER_THROW = 25; // Насколько увеличивается уровень перегрева за один бросок
const OVERHEAT_DECREASE_PER_SEC = 25; // Насколько уменьшается уровень перегрева за секунду
const OVERHEAT_COOLDOWN_TIME = 3000; // 3 секунды охлаждения при полном перегреве
let isOverheated = false; // Флаг состояния перегрева
let overheatBarGraphics: any = null; // Графический элемент для отображения бара перегрева
let nextBallIndicator: any = null; // Графический элемент для отображения следующего шара

// Константы для размеров игры по умолчанию
const DEFAULT_WIDTH = 390;
const DEFAULT_HEIGHT = 800;

interface GameInitializerProps {
  gameContainerRef: React.RefObject<HTMLDivElement>;
  setIsLoading: (isLoading: boolean) => void;
  setDebugMessage: (message: string) => void;
  setHasError: (hasError: boolean) => void;
  isPaused: boolean;
  setIsPaused: (isPaused: boolean) => void;
  worldRef: React.MutableRefObject<planck.World | null>;
  playerBodyRef: React.MutableRefObject<planck.Body | null>;
  leftWallRef: React.MutableRefObject<planck.Body | null>;
  rightWallRef: React.MutableRefObject<planck.Body | null>;
  topWallRef: React.MutableRefObject<planck.Body | null>;
  floorRef: React.MutableRefObject<planck.Body | null>;
  ballsRef: React.MutableRefObject<ExtendedBall[]>;
  currentBallRef: React.MutableRefObject<ExtendedNextBall | null>;
  trajectoryLineRef: React.MutableRefObject<TrajectoryRef | null>;
  nextBallLevelRef: React.MutableRefObject<number>;
  gameInstanceRef: React.MutableRefObject<any>;
  setFutureNextBallLevel: (level: number) => void;
  potentiallyStuckBallsRef: React.MutableRefObject<Map<ExtendedBall, number>>;
  dispatch: any;
  snotCoins: number;
  setSpecialBallType?: React.Dispatch<React.SetStateAction<string | null>>;
}

// Временная функция для обхода проблем с типами
function isValidNextBall(ball: any): ball is ExtendedNextBall {
  return ball && 
         ball.level !== undefined && 
         ball.sprite && 
         ball.sprite.container && 
         typeof ball.sprite.container.x === 'number';
}

const GameInitializer: React.FC<GameInitializerProps> = ({
  gameContainerRef,
  setIsLoading,
  setDebugMessage,
  setHasError,
  isPaused,
  setIsPaused,
  worldRef,
  playerBodyRef,
  leftWallRef,
  rightWallRef,
  topWallRef,
  floorRef,
  ballsRef,
  currentBallRef,
  trajectoryLineRef,
  nextBallLevelRef,
  gameInstanceRef,
  setFutureNextBallLevel,
  potentiallyStuckBallsRef,
  dispatch,
  snotCoins,
  setSpecialBallType
}) => {
  // Добавляем состояние для отслеживания, была ли игра инициализирована
  const isInitializedRef = useRef<boolean>(false);
  
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
        // Ошибка при остановке анимаций
      }
    }
    
    // Очищаем все шары
    try {
      for (const ball of ballsRef.current) {
        if (ball && ball.body && worldRef.current) {
          try {
            if (!isBodyDestroyed(ball.body)) {
              ball.body.setUserData(null);
              worldRef.current.destroyBody(ball.body);
            }
          } catch (e) {
            // Ошибка при удалении тела шара в cleanupResources
          }
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
      // Ошибка при очистке шаров
    }
    
    // Уничтожаем пунктирную линию
    if (trajectoryLineRef.current && trajectoryLineRef.current.destroy) {
      trajectoryLineRef.current.destroy();
      trajectoryLineRef.current = null;
    }
    
    // Очищаем Map потенциально зависших шаров
    potentiallyStuckBallsRef.current.clear();
  };

  // Основной эффект для инициализации игры
  useEffect(() => {
    // Проверяем, что мы на клиенте и есть доступ к window и контейнеру
    if (typeof window === 'undefined' || !gameContainerRef.current || isInitializedRef.current) {
      return;
    }
    
    setDebugMessage("Начало инициализации игры");
    setIsLoading(true);
    
    let isMounted = true;
    let playerSprite: any = null;
    let resizeHandler: (() => void) | null = null;
    
    // Динамически импортируем Phaser только на клиенте
    const initGame = async () => {
      try {
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
        
        // Сохраняем соотношение сторон (ширина к высоте)
        const aspectRatio = GAME_ASPECT_RATIO;
        
        // Определяем новые размеры с сохранением пропорций
        let newGameWidth, newGameHeight;
        
        // Если ограничивает ширина
        if (containerHeight / aspectRatio > containerWidth) {
          newGameWidth = containerWidth;
          newGameHeight = containerWidth / aspectRatio;
        } 
        // Если ограничивает высота
        else {
          newGameHeight = containerHeight;
          newGameWidth = containerHeight * aspectRatio;
        }
        
        // Округляем размеры до целых чисел
        newGameWidth = Math.floor(newGameWidth);
        newGameHeight = Math.floor(newGameHeight);
        
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
            preload: function(this: any) {
              try {
                // Загружаем текстуры и изображения
                this.load.image('coin-king', '/images/merge/Game/ui/CoinKing.webp');
                this.load.image('coin-king-throw', '/images/merge/Game/ui/CoinKingThrow.webp');
                this.load.image('trees', '/images/merge/Game/ui/trees.webp');
                this.load.image('floor', '/images/merge/Game/ui/floor.webp');
                
                // Загружаем изображения шаров (монеты разных уровней)
                for (let i = 1; i <= 12; i++) {
                  this.load.image(`${i}`, `/images/merge/Balls/${i}.webp`);
                }
                
                // Загружаем изображения для специальных шаров
                this.load.image('bull-ball', '/images/merge/Balls/Bull.webp');
                this.load.image('bomb', '/images/merge/Balls/Bomb.webp');
                
                // Загружаем изображение для частиц
                this.load.image('particle', '/images/merge/Balls/particle.webp');
                // Загружаем текстуру particle для эффектов взрыва
                
                // Загружаем изображения для эффектов
                this.load.image('flare', '/images/merge/Game/effects/flare.webp');
              } catch (error) {
                // Ошибка при загрузке ресурсов
                setDebugMessage(`Ошибка при загрузке ресурсов: ${error}`);
              }
            },
            create: function(this: any) {
              try {
                // Добавляем фон с деревьями
                const treesImage = this.add.image(newGameWidth / 2, 0, 'trees');
                treesImage.setOrigin(0.5, 0);
                treesImage.setDisplaySize(newGameWidth, newGameHeight);
                treesImage.setDepth(100);
                
                // Добавляем пол
                const floorHeight = 30;
                const floorImage = this.add.image(newGameWidth / 2, newGameHeight - floorHeight / 2, 'floor');
                floorImage.setDisplaySize(newGameWidth, floorHeight);
                floorImage.setDepth(90);
                
                // Добавляем стены
                const wallWidth = 32;
                
                // Создаем левую стену как полностью прозрачный прямоугольник
                const leftWallGraphics = this.add.graphics();
                leftWallGraphics.fillStyle(WALL_COLOR, 0); // Полная прозрачность (0 вместо 0.8)
                leftWallGraphics.fillRect(0, 0, wallWidth, newGameHeight);
                leftWallGraphics.setPosition(0, 0);
                leftWallGraphics.setDepth(80);
                
                // Создаем правую стену как полностью прозрачный прямоугольник
                const rightWallGraphics = this.add.graphics();
                rightWallGraphics.fillStyle(WALL_COLOR, 0); // Полная прозрачность (0 вместо 0.8)
                rightWallGraphics.fillRect(0, 0, wallWidth, newGameHeight);
                rightWallGraphics.setPosition(newGameWidth - wallWidth, 0);
                rightWallGraphics.setDepth(80);
                
                // Создаем вертикальный бар перегрева с закругленными углами
                const barWidth = 20;
                const barHeight = 120;
                const barX = 10;
                const barY = 50;
                const cornerRadius = 6; // Радиус скругления углов
                
                // Создаем графический элемент для бара перегрева
                overheatBarGraphics = this.add.graphics();
                overheatBarGraphics.setDepth(150); // Высокий z-index для отображения поверх других элементов
                
                // Функция для рисования закругленного прямоугольника
                const drawRoundedRect = (graphics: any, x: number, y: number, width: number, height: number, radius: number) => {
                  graphics.beginPath();
                  graphics.moveTo(x + radius, y);
                  graphics.lineTo(x + width - radius, y);
                  graphics.arc(x + width - radius, y + radius, radius, -Math.PI / 2, 0);
                  graphics.lineTo(x + width, y + height - radius);
                  graphics.arc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2);
                  graphics.lineTo(x + radius, y + height);
                  graphics.arc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI);
                  graphics.lineTo(x, y + radius);
                  graphics.arc(x + radius, y + radius, radius, Math.PI, -Math.PI / 2);
                  graphics.closePath();
                };
                
                // Функция для обновления бара перегрева
                const updateOverheatBar = () => {
                  if (!overheatBarGraphics) return;
                  
                  // Очищаем предыдущий рендер
                  overheatBarGraphics.clear();
                  
                  // Рисуем фон бара (серый)
                  overheatBarGraphics.fillStyle(0x333333, 0.8);
                  drawRoundedRect(overheatBarGraphics, barX, barY, barWidth, barHeight, cornerRadius);
                  overheatBarGraphics.fill();
                  
                  // Определяем цвет заполнения в зависимости от уровня перегрева
                  let fillColor = 0x00ff00; // Зеленый при низком перегреве
                  
                  if (overheatingLevel > OVERHEAT_THRESHOLD * 0.7) {
                    fillColor = 0xff0000; // Красный при высоком перегреве
                  } else if (overheatingLevel > OVERHEAT_THRESHOLD * 0.4) {
                    fillColor = 0xffaa00; // Оранжевый при среднем перегреве
                  }
                  
                  // Вычисляем текущую высоту заполнения в зависимости от уровня перегрева
                  const fillHeight = (overheatingLevel / OVERHEAT_THRESHOLD) * barHeight;
                  const fillY = barY + barHeight - fillHeight; // Начинаем снизу
                  
                  // Рисуем заполнение бара
                  if (fillHeight > 0) {
                    overheatBarGraphics.fillStyle(fillColor, 1);
                    
                    // Для очень маленького заполнения просто рисуем закругленный прямоугольник снизу
                    if (fillHeight <= cornerRadius * 2) {
                      // Простой прямоугольник для небольшого заполнения
                      overheatBarGraphics.fillRect(barX, fillY, barWidth, fillHeight);
                    } else {
                      // Закругленный прямоугольник с обрезанными верхними углами для большего заполнения
                      drawRoundedRect(
                        overheatBarGraphics, 
                        barX, 
                        fillY, 
                        barWidth, 
                        fillHeight,
                        // Закругляем только углы, которые видны (внизу)
                        fillY <= barY + cornerRadius ? cornerRadius : 0
                      );
                      overheatBarGraphics.fill();
                    }
                  }
                  
                  // Рисуем контур бара
                  overheatBarGraphics.lineStyle(2, 0xffffff, 0.8);
                  drawRoundedRect(overheatBarGraphics, barX, barY, barWidth, barHeight, cornerRadius);
                  overheatBarGraphics.stroke();
                  
                  // Мигание при перегреве
                  if (isOverheated) {
                    // Добавляем визуальный эффект перегрева (красное свечение)
                    overheatBarGraphics.fillStyle(0xff0000, 0.3);
                    drawRoundedRect(
                      overheatBarGraphics, 
                      barX - 4, 
                      barY - 4, 
                      barWidth + 8, 
                      barHeight + 8, 
                      cornerRadius + 2
                    );
                    overheatBarGraphics.fill();
                  }
                };
                
                // Создаем индикатор следующего шара
                const createNextBallIndicator = () => {
                  // Не создаем индикатор, так как он теперь отображается в хедере
                  // Создаем пустой контейнер только для совместимости с существующим кодом
                  nextBallIndicator = this.add.container(0, 0);
                  nextBallIndicator.setDepth(0);
                  nextBallIndicator.setVisible(false); // Скрываем индикатор
                  
                  // Устанавливаем необходимые свойства для совместимости
                  nextBallIndicator.centerX = 0;
                  nextBallIndicator.centerY = 0;
                  nextBallIndicator.size = 0;
                  
                  return nextBallIndicator;
                };
                
                // Функция для обновления индикатора следующего шара
                const updateNextBallIndicator = (level: number) => {
                  // Ничего не делаем, так как индикатор теперь отображается в хедере
                  // Но сохраняем эту функцию для совместимости с существующим кодом
                  return;
                };
                
                // Запускаем таймер для уменьшения перегрева со временем и его отображения
                this.time.addEvent({
                  delay: 100, // Каждые 100 мс
                  callback: () => {
                    // Уменьшаем уровень перегрева со временем, если не в состоянии полного перегрева
                    if (!isOverheated) {
                      overheatingLevel = Math.max(0, overheatingLevel - (OVERHEAT_DECREASE_PER_SEC / 10));
                    }
                    // Обновляем отображение бара
                    updateOverheatBar();
                  },
                  loop: true
                });
                
                // Масштабируем размер игрока
                const scaleFactor = newGameWidth / BASE_GAME_WIDTH;
                const playerSizeScaled = PLAYER_SIZE * 3.5 * scaleFactor;
                
                // Создаем игрока
                playerSprite = this.add.image(newGameWidth / 2, FIXED_PLAYER_Y, 'coin-king')
                  .setOrigin(0.5, 0.5)
                  .setDisplaySize(playerSizeScaled, playerSizeScaled)
                  .setDepth(5);
                
                // Создаем физические объекты
                worldRef.current = createPhysicsWorld(GRAVITY_Y);

                // Создаем стены и границы
                if (worldRef.current) {
                  // Толщина стенок
                  const wallThickness = 10 / SCALE;
                  const width = newGameWidth / SCALE;
                  const height = newGameHeight / SCALE;
                  
                  // Создаем левую стену
                  leftWallRef.current = worldRef.current.createBody({
                    type: 'static',
                    position: planck.Vec2(-wallThickness / 2, height / 2),
                    userData: { type: 'wall', isWall: true }
                  });
                  
                  // Создаем форму для левой стены
                  const leftWallShape = planck.Box(wallThickness / 2, height / 2);
                  
                  // Добавляем фикстуру к телу левой стены
                  leftWallRef.current.createFixture({
                    shape: leftWallShape,
                    friction: 0.3,
                    restitution: 0.4
                  });
                  
                  // Создаем правую стену
                  rightWallRef.current = worldRef.current.createBody({
                    type: 'static',
                    position: planck.Vec2(width + wallThickness / 2, height / 2),
                    userData: { type: 'wall', isWall: true }
                  });
                  
                  // Создаем форму для правой стены
                  const rightWallShape = planck.Box(wallThickness / 2, height / 2);
                  
                  // Добавляем фикстуру к телу правой стены
                  rightWallRef.current.createFixture({
                    shape: rightWallShape,
                    friction: 0.3,
                    restitution: 0.4
                  });
                  
                  // Создаем верхнюю стену
                  topWallRef.current = worldRef.current.createBody({
                    type: 'static',
                    position: planck.Vec2(width / 2, -wallThickness / 2),
                    userData: { type: 'top_wall', isWall: true }
                  });
                  
                  // Создаем форму для верхней стены
                  const topWallShape = planck.Box(width / 2, wallThickness / 2);
                  
                  // Добавляем фикстуру к телу верхней стены
                  topWallRef.current.createFixture({
                    shape: topWallShape,
                    friction: 0.1,
                    restitution: 0.8
                  });
                  
                  // Создаем пол
                  floorRef.current = worldRef.current.createBody({
                    type: 'static',
                    position: planck.Vec2(width / 2, height + wallThickness / 2),
                  });
                  
                  // Создаем форму для пола с учетом высоты травы
                  const floorShape = planck.Box(width / 2, wallThickness / 2);
                  
                  // Добавляем фикстуру к телу пола
                  floorRef.current.createFixture({
                    shape: floorShape,
                    friction: 0.5,
                    restitution: 0.2
                  });
                  floorRef.current.setUserData({ isFloor: true });
                  
                  // Создаем тело игрока
                  const playerSize = PLAYER_SIZE / SCALE;
                  
                  playerBodyRef.current = worldRef.current.createBody({
                    type: 'static',
                    position: planck.Vec2(width / 2, PHYSICS_PLAYER_Y),
                    userData: { type: 'player', isPlayer: true }
                  });
                  
                  // Создаем форму для тела игрока
                  const playerShape = planck.Circle(playerSize / 2);
                  
                  // Добавляем фикстуру к телу игрока
                  playerBodyRef.current.createFixture({
                    shape: playerShape,
                    friction: 0.3,
                    restitution: 0.5
                  });
                }
                
                // Настраиваем физические колизии для обычных шаров
                setupNormalBallsCollisions(worldRef.current, ballsRef);
                
                // Настраиваем специальные коллизии для шаров Bull и Bomb
                if (worldRef.current) {
                  setupSpecialBallsCollisions(this, worldRef, ballsRef, floorRef);
                }
                
                // Генерируем текущий шар
                const currentLevel = generateBallLevel();
                currentBallRef.current = createNextBall(this, playerBodyRef, currentLevel);
                
                // Генерируем новый будущий шар с вероятностями для уровней от 1 до 5
                const futureBallLevel = generateBallLevel();
                nextBallLevelRef.current = futureBallLevel;
                setFutureNextBallLevel(futureBallLevel);
                
                // Создаем индикатор следующего шара
                createNextBallIndicator();
                // Обновляем его с текущим уровнем следующего шара
                updateNextBallIndicator(futureBallLevel);
                
                // Создаем пунктирную линию для траектории
                if (currentBallRef.current && currentBallRef.current.sprite) {
                  createTrajectoryLine(
                    this,
                    trajectoryLineRef,
                    currentBallRef.current.sprite.container.x,
                    currentBallRef.current.sprite.container.y
                  );
                }
                
                // Обработчик движения мыши
                this.input.on('pointermove', (pointer: any) => {
                  if (!playerBodyRef.current || isPaused) return;
                  
                  try {
                    // Преобразуем координаты указателя в физические координаты
                    const mouseX = pointer.x / 30;
                    
                    // Устанавливаем позицию игрока
                    playerBodyRef.current.setPosition(planck.Vec2(mouseX, FIXED_PLAYER_Y / 30));
                    playerBodyRef.current.setLinearVelocity(planck.Vec2(0, 0));
                    playerBodyRef.current.setAwake(true);
                    
                    // Обновляем визуальную позицию игрока
                    if (playerSprite) {
                      playerSprite.x = pointer.x;
                      playerSprite.y = FIXED_PLAYER_Y;
                    }
                    
                    // Перемещаем шар для броска вместе с игроком
                    if (currentBallRef.current && currentBallRef.current.sprite && 
                        currentBallRef.current.sprite.container && !currentBallRef.current.sprite.container.destroyed) {
                      currentBallRef.current.sprite.container.x = pointer.x;
                      currentBallRef.current.sprite.container.y = FIXED_PLAYER_Y + 24;
                      
                      // Обновляем положение пунктирной линии
                      updateTrajectoryLine(
                        this, 
                        trajectoryLineRef,
                        pointer.x, 
                        FIXED_PLAYER_Y + 24,
                        isPaused
                      );
                    }
                  } catch (error) {
                    // Ошибка при обработке движения мыши
                  }
                });
                
                // Обработчик клика мыши для броска шара
                this.input.on('pointerdown', (pointer: any) => {
                  // Добавляем отладочную информацию
                  // Клик мыши обработан
                  
                  if (isPaused) {
                    // Игра на паузе, бросок запрещен
                    return;
                  }
                  
                  // Упрощаем проверку границ, исключаем только очевидно неправильные координаты
                  const gameWidth = this.sys.game.config.width;
                  const gameHeight = this.sys.game.config.height;
                  
                  // Используем менее строгую проверку границ, чтобы избежать ложных блокировок
                  // Разрешаем клики в пределах небольшого буфера за границами игрового поля
                  const buffer = 50; // Буфер в 50 пикселей
                  if (pointer.x < -buffer || pointer.x > gameWidth + buffer || 
                      pointer.y < -buffer || pointer.y > gameHeight + buffer) {
                    // Клик вне игрового поля
                    return;
                  }
                  
                  // Если система перегрета, запрещаем бросок
                  if (isOverheated) {
                    // Система перегрета, бросок запрещен
                    
                    // Визуальное оповещение о перегреве (мигание бара)
                    this.tweens.add({
                      targets: overheatBarGraphics,
                      alpha: { from: 1, to: 0.5 },
                      duration: 100,
                      yoyo: true,
                      repeat: 3
                    });
                    return;
                  }
                  
                  // Проверяем время с последнего броска для базового ограничения спама
                  const currentTime = Date.now();
                  const MIN_THROW_INTERVAL = 250; // Уменьшаем минимальный интервал для лучшего отклика
                  
                  if (currentTime - lastThrowTime < MIN_THROW_INTERVAL) {
                    // Слишком короткий интервал между бросками
                    return;
                  }
                  
                  try {
                    // Если шар для броска не существует, создаем новый
                    if (!currentBallRef.current) {
                      // Шар для броска отсутствует, создаем новый
                      const newLevel = generateBallLevel();
                      currentBallRef.current = createNextBall(this, playerBodyRef, newLevel);
                      
                      // Проверяем, успешно ли создался шар
                      if (!currentBallRef.current) {
                        // Не удалось создать шар для броска
                        return;
                      }
                    }
                    
                    // Проверяем валидность шара перед броском
                    if (!currentBallRef.current || !currentBallRef.current.sprite || 
                        !currentBallRef.current.sprite.container) {
                      // Невалидный шар для броска
                      
                      // Попытка восстановления
                      const newLevel = generateBallLevel();
                      currentBallRef.current = createNextBall(this, playerBodyRef, newLevel);
                      
                      // Если восстановление не удалось, выходим
                      if (!currentBallRef.current) {
                        // Не удалось восстановить шар для броска
                        return;
                      }
                    }
                    
                    if (currentBallRef.current) {
                      // Бросаем шар
                      
                      // Увеличиваем уровень перегрева при каждом броске
                      overheatingLevel = Math.min(OVERHEAT_THRESHOLD, overheatingLevel + OVERHEAT_INCREASE_PER_THROW);
                      
                      // Если достигли порога перегрева, активируем состояние перегрева
                      if (overheatingLevel >= OVERHEAT_THRESHOLD) {
                        isOverheated = true;
                        
                        // Визуальная обратная связь о полном перегреве
                        this.tweens.add({
                          targets: overheatBarGraphics,
                          alpha: { from: 1, to: 0.5 },
                          duration: 200,
                          yoyo: true,
                          repeat: 5
                        });
                        
                        // Запускаем таймер охлаждения
                        this.time.delayedCall(OVERHEAT_COOLDOWN_TIME, () => {
                          isOverheated = false;
                          overheatingLevel = 0; // Сбрасываем уровень перегрева после охлаждения
                        });
                      }
                      
                      // Изменяем изображение игрока при броске
                      if (playerSprite) {
                        playerSprite.setTexture('coin-king-throw');
                        
                        // Возвращаем оригинальное изображение через 300 мс
                        setTimeout(() => {
                          if (playerSprite) {
                            playerSprite.setTexture('coin-king');
                          }
                        }, 300);
                      }
                      
                      // Бросаем шар
                      const thrownBall = throwBall(
                        this,
                        currentBallRef,
                        playerBodyRef,
                        worldRef,
                        ballsRef,
                        nextBallLevelRef,
                        trajectoryLineRef,
                        isPaused,
                        setFutureNextBallLevel
                      );
                      
                      // Проверяем результат броска
                      if (thrownBall) {
                        // Шар успешно брошен
                        
                        // Обновляем индикатор следующего шара
                        if (nextBallLevelRef.current) {
                          updateNextBallIndicator(nextBallLevelRef.current);
                        }
                        
                        // Если был брошен специальный шар
                        if (thrownBall.specialType === 'Bull') {
                          // Брошен шар Bull!
                          
                          // Создаем текст с информацией о броске Bull
                          const bullText = this.add.text(
                            gameWidth / 2,
                            gameHeight / 2,
                            'BULL!',
                            {
                              fontFamily: 'Arial',
                              fontSize: '36px',
                              color: '#FFFF00',
                              stroke: '#000000',
                              strokeThickness: 4,
                              align: 'center'
                            }
                          ).setOrigin(0.5);
                          
                          // Анимируем исчезновение текста
                          this.tweens.add({
                            targets: bullText,
                            alpha: 0,
                            y: gameHeight / 2 - 100,
                            scaleX: 1.5,
                            scaleY: 1.5,
                            duration: 1000,
                            ease: 'Power2',
                            onComplete: () => {
                              bullText.destroy();
                            }
                          });
                        } else if (thrownBall.specialType === 'Bomb') {
                          // Брошена бомба!
                          
                          // Сбрасываем тип специального шара после броска бомбы
                          if (setSpecialBallType) {
                            setSpecialBallType(null);
                          }
                          
                          // Создаем текст с информацией о броске бомбы
                          const bombText = this.add.text(
                            gameWidth / 2,
                            gameHeight / 2,
                            'BOMB!',
                            {
                              fontFamily: 'Arial',
                              fontSize: '36px',
                              color: '#FF0000',
                              stroke: '#000000',
                              strokeThickness: 4,
                              align: 'center'
                            }
                          ).setOrigin(0.5);
                          
                          // Анимируем исчезновение текста
                          this.tweens.add({
                            targets: bombText,
                            alpha: 0,
                            y: gameHeight / 2 - 100,
                            scaleX: 1.5,
                            scaleY: 1.5,
                            duration: 1000,
                            ease: 'Power2',
                            onComplete: () => {
                              bombText.destroy();
                            }
                          });
                        }
                      } else {
                        // Бросок шара не удался
                      }
                      
                      // Обновляем время последнего броска
                      lastThrowTime = currentTime;
                    }
                  } catch (error) {
                    // Ошибка при броске шара
                    
                    // Попытка восстановления после ошибки
                    try {
                      // Создаем новый шар
                      const newLevel = generateBallLevel();
                      currentBallRef.current = createNextBall(this, playerBodyRef, newLevel);
                      
                      // Обновляем время последнего броска, чтобы избежать спама при восстановлении
                      lastThrowTime = currentTime;
                    } catch (e) {
                      // Не удалось восстановиться после ошибки
                    }
                  }
                });
                
                // Добавляем обработку тачскрина
                try {
                  this.input.addPointer(3);
                  
                  this.game.canvas.addEventListener('touchstart', function(e: TouchEvent) {
                    e.preventDefault();
                  }, { passive: false });
                  
                  this.game.canvas.addEventListener('touchmove', function(e: TouchEvent) {
                    e.preventDefault();
                  }, { passive: false });
                  
                  this.game.canvas.addEventListener('touchend', function(e: TouchEvent) {
                    e.preventDefault();
                  }, { passive: false });
                } catch (error) {
                  // Ошибка при настройке обработки тачскрина
                }
                
                setDebugMessage("Инициализация завершена успешно");
                setIsLoading(false);
                isInitializedRef.current = true;

                // Устанавливаем стиль для canvas
                if (this.game.canvas) {
                  this.game.canvas.style.width = '100%';
                  this.game.canvas.style.height = '100%';
                  this.game.canvas.style.objectFit = 'contain';
                  this.game.canvas.style.maxWidth = `${newGameWidth}px`;
                  this.game.canvas.style.maxHeight = `${newGameHeight}px`;
                  this.game.canvas.style.margin = '0';
                  this.game.canvas.style.padding = '0';
                  this.game.canvas.style.position = 'absolute';
                  this.game.canvas.style.bottom = '0';
                  this.game.canvas.style.left = '50%';
                  this.game.canvas.style.transform = 'translateX(-50%)';
                  this.game.canvas.style.transition = 'width 0.2s ease, height 0.2s ease';
                }

                // Обновляем размер игры
                this.scale.resize(newGameWidth, newGameHeight);
                this.scale.refresh();

                // Вызываем функцию обновления шаров с правильными параметрами
                updateBallsOnResize(
                  ballsRef,
                  currentBallRef,
                  worldRef,
                  newGameWidth,
                  this.scale.width
                );
                
                // Обновляем изображения игровой зоны
                try {
                  const scene = this.game.scene.scenes[0];
                  if (scene) {
                    // Находим и обновляем изображение деревьев
                    scene.children.each((child: any) => {
                      if (child.texture && child.texture.key === 'trees') {
                        child.setPosition(newGameWidth / 2, 0);
                        child.setDisplaySize(newGameWidth, newGameHeight);
                      }
                      
                      // Находим и обновляем изображение пола
                      if (child.texture && child.texture.key === 'floor') {
                        const floorHeight = 30;
                        child.setPosition(newGameWidth / 2, newGameHeight - floorHeight / 2);
                        child.setDisplaySize(newGameWidth, floorHeight);
                      }
                    });
                    
                    // Обновляем графические элементы стен (если они есть)
                    scene.children.each((child: any) => {
                      if (child.type === 'Graphics') {
                        if (child.x === 0) { // Левая стена
                          child.clear();
                          child.fillStyle(WALL_COLOR, 0);
                          child.fillRect(0, 0, 32, newGameHeight);
                        } else if (child.x > newGameWidth - 50) { // Правая стена
                          child.clear();
                          child.fillStyle(WALL_COLOR, 0);
                          child.fillRect(0, 0, 32, newGameHeight);
                          child.setPosition(newGameWidth - 32, 0);
                        }
                      }
                    });
                  }
                } catch (error) {
                  // Ошибка при обновлении изображений игровой зоны
                }

                // Адаптируем физический мир к новым размерам
                if (worldRef.current) {
                  // Пересоздаем физические границы для нового размера
                  // Сначала удаляем старые границы
                  if (leftWallRef.current) {
                    worldRef.current.destroyBody(leftWallRef.current);
                    leftWallRef.current = null;
                  }
                  if (rightWallRef.current) {
                    worldRef.current.destroyBody(rightWallRef.current);
                    rightWallRef.current = null;
                  }
                  if (topWallRef.current) {
                    worldRef.current.destroyBody(topWallRef.current);
                    topWallRef.current = null;
                  }
                  if (floorRef.current) {
                    worldRef.current.destroyBody(floorRef.current);
                    floorRef.current = null;
                  }
                  
                  // Создаем новые границы с новыми размерами
                  const wallThickness = 10 / SCALE;
                  const width = newGameWidth / SCALE;
                  const height = newGameHeight / SCALE;
                  const floorHeight = 30; // Высота травы
                  
                  // Левая стена
                  leftWallRef.current = worldRef.current.createBody({
                    type: 'static',
                    position: planck.Vec2(-wallThickness / 2, height / 2),
                  });
                  leftWallRef.current.createFixture({
                    shape: planck.Box(wallThickness / 2, height / 2),
                    friction: 0.3,
                    restitution: 0.2,
                  });
                  
                  // Правая стена
                  rightWallRef.current = worldRef.current.createBody({
                    type: 'static',
                    position: planck.Vec2(width + wallThickness / 2, height / 2),
                  });
                  rightWallRef.current.createFixture({
                    shape: planck.Box(wallThickness / 2, height / 2),
                    friction: 0.3,
                    restitution: 0.2,
                  });
                  
                  // Верхняя стена
                  topWallRef.current = worldRef.current.createBody({
                    type: 'static',
                    position: planck.Vec2(width / 2, -wallThickness / 2),
                  });
                  topWallRef.current.createFixture({
                    shape: planck.Box(width / 2, wallThickness / 2),
                    friction: 0.1,
                    restitution: 0.8
                  });
                  
                  // Пол
                  floorRef.current = worldRef.current.createBody({
                    type: 'static',
                    position: planck.Vec2(width / 2, height + wallThickness / 2),
                  });
                  floorRef.current.createFixture({
                    shape: planck.Box(width / 2, wallThickness / 2),
                    friction: 0.5,
                    restitution: 0.2
                  });
                  floorRef.current.setUserData({ isFloor: true });
                }

                // Обновляем стили canvas
                if (this.game.canvas) {
                  this.game.canvas.style.maxWidth = `${newGameWidth}px`;
                  this.game.canvas.style.maxHeight = `${newGameHeight}px`;
                  this.game.canvas.style.position = 'absolute';
                  this.game.canvas.style.bottom = '0';
                  this.game.canvas.style.left = '50%';
                  this.game.canvas.style.transform = 'translateX(-50%)';
                  this.game.canvas.style.margin = '0';
                  
                  // Добавляем плавный переход для предотвращения скачков при изменении размера
                  this.game.canvas.style.transition = 'width 0.2s ease, height 0.2s ease';
                }
                
                // Получаем сцену игры
                const gameScene = this.game.scene.scenes[0];
                
                // Обновляем интерактивную зону для бросков после изменения размера
                if (gameScene && gameScene.input) {
                  // Создаем или обновляем прямоугольную область для обработки бросков
                  // Используем более простой подход к настройке области ввода
                  gameScene.input.enabled = true;
                  
                  // Устанавливаем обработку только верхнего объекта
                  gameScene.input.topOnly = true;
                  
                  // Создаем невидимую интерактивную зону на весь экран
                  const fullScreenZone = gameScene.add.zone(newGameWidth/2, newGameHeight/2, newGameWidth, newGameHeight);
                  fullScreenZone.setInteractive();
                  fullScreenZone.setOrigin(0.5, 0.5);
                  // Ставим высокий приоритет, чтобы зона была над другими элементами
                  fullScreenZone.setDepth(1000);

                  // Обновляем позицию интерактивной зоны и всей сцены
                  if (gameScene.cameras && gameScene.cameras.main) {
                    gameScene.cameras.main.setViewport(0, 0, newGameWidth, newGameHeight);
                    gameScene.cameras.main.setScroll(0, 0);
                  }
                }
                
                // Возобновляем обработку физики после обновления всех объектов
                if (gameScene) {
                  gameScene.physics?.resume();
                }

                // Сохраняем игровой экземпляр для будущего использования
                if (game) {
                  gameInstanceRef.current = game;
                  
                  // Получаем первую сцену
                  const scene = game.scene.scenes[0];
                  
                  if (scene) {
                    // Добавляем dispatch в сцену для возможности вызова действий Redux
                    scene.dispatch = dispatch;
                    
                    // Добавляем ссылку на состояние игры в сцену
                    scene.state = { inventory: { containerCapacity: snotCoins } };
                    
                    // Добавляем ссылки на refs в сцену
                    scene.playerBodyRef = playerBodyRef;
                    scene.ballsRef = ballsRef;
                    scene.currentBallRef = currentBallRef;
                    scene.trajectoryLineRef = trajectoryLineRef;
                    scene.nextBallLevelRef = nextBallLevelRef;
                    
                    console.log('Refs и dispatch добавлены в сцену');
                  }
                }
              } catch (error) {
                // Ошибка при создании сцены
                setDebugMessage(`Ошибка при создании сцены: ${error}`);
                setHasError(true);
                setIsLoading(false);
              }
            }
          }
        };
        
        // Создаем экземпляр игры
        const game = new Phaser.Game(config);
        gameInstanceRef.current = game;
        
        // Устанавливаем стиль для canvas
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
        
        // Добавляем обработчик изменения размера окна
        const handleResize = () => {
          // Проверяем, что игра уже инициализирована
          if (!game || !game.canvas) {
            return;
          }
          
          try {
            const oldGameWidth = game.scale.width;
            const oldGameHeight = game.scale.height;
            
            // Рассчитываем новые размеры игры
            const containerWidth = gameContainerRef.current?.clientWidth || window.innerWidth;
            const containerHeight = gameContainerRef.current?.clientHeight || window.innerHeight;
            
            // Определяем новые размеры с сохранением пропорций
            let newGameWidth, newGameHeight;
            
            if (containerHeight / aspectRatio > containerWidth) {
              newGameWidth = containerWidth;
              newGameHeight = containerWidth / aspectRatio;
            } else {
              newGameHeight = containerHeight;
              newGameWidth = containerHeight * aspectRatio;
            }
            
            // Округляем размеры
            newGameWidth = Math.floor(newGameWidth);
            newGameHeight = Math.floor(newGameHeight);
            
            const widthScaleFactor = newGameWidth / oldGameWidth;
            const heightScaleFactor = newGameHeight / oldGameHeight;
            const baseScaleFactor = newGameWidth / BASE_GAME_WIDTH;
            
            console.log(`Масштабирование: widthFactor=${widthScaleFactor.toFixed(2)}, heightFactor=${heightScaleFactor.toFixed(2)}, baseFactor=${baseScaleFactor.toFixed(2)}`);
            
            // Получаем сцену игры
            const phaseScene = game.scene.scenes[0];
            
            // Приостанавливаем обработку физики на время изменения размеров
            if (phaseScene && phaseScene.physics) {
              phaseScene.physics.pause();
            }
            
            try {
              // Обновляем шары с учетом нового размера игры
              updateBallsOnResize(
                ballsRef,
                currentBallRef,
                worldRef,
                newGameWidth,
                oldGameWidth,
                baseScaleFactor
              );
              
              // Обновляем элементы сцены с новыми размерами
              updateSceneElements(phaseScene, newGameWidth, newGameHeight, baseScaleFactor);
              
              // Обновляем фоновые изображения
              if (phaseScene && phaseScene.children && phaseScene.children.list) {
                phaseScene.children.list.forEach((child: any) => {
                  if (child.texture) {
                    // Обновляем положение и размер деревьев
                    if (child.texture.key === 'trees') {
                      child.setPosition(newGameWidth / 2, 0);
                      child.setDisplaySize(newGameWidth, newGameHeight);
                    }
                    // Обновляем положение и размер пола
                    else if (child.texture.key === 'floor') {
                      const floorHeight = 30 * baseScaleFactor;
                      child.setPosition(newGameWidth / 2, newGameHeight - floorHeight / 2);
                      child.setDisplaySize(newGameWidth, floorHeight);
                    }
                  }
                });
              }
            } catch (error) {
              console.error("Ошибка при обновлении объектов:", error);
            }
            
            // Теперь изменяем размер игры
            game.scale.resize(newGameWidth, newGameHeight);
            game.scale.refresh();

            // Адаптируем физический мир к новым размерам
            if (worldRef.current) {
              // Пересоздаем физические границы для нового размера
              // Сначала удаляем старые границы
              if (leftWallRef.current) {
                worldRef.current.destroyBody(leftWallRef.current);
                leftWallRef.current = null;
              }
              if (rightWallRef.current) {
                worldRef.current.destroyBody(rightWallRef.current);
                rightWallRef.current = null;
              }
              if (topWallRef.current) {
                worldRef.current.destroyBody(topWallRef.current);
                topWallRef.current = null;
              }
              if (floorRef.current) {
                worldRef.current.destroyBody(floorRef.current);
                floorRef.current = null;
              }
              
              // Создаем новые границы с новыми размерами
              const wallThickness = 10 / SCALE;
              const width = newGameWidth / SCALE;
              const height = newGameHeight / SCALE;
              const floorHeight = 30;
              
              // Левая стена
              leftWallRef.current = worldRef.current.createBody({
                type: 'static',
                position: planck.Vec2(-wallThickness / 2, height / 2),
              });
              leftWallRef.current.createFixture({
                shape: planck.Box(wallThickness / 2, height / 2),
                friction: 0.3,
                restitution: 0.2,
              });
              
              // Правая стена
              rightWallRef.current = worldRef.current.createBody({
                type: 'static',
                position: planck.Vec2(width + wallThickness / 2, height / 2),
              });
              rightWallRef.current.createFixture({
                shape: planck.Box(wallThickness / 2, height / 2),
                friction: 0.3,
                restitution: 0.2,
              });
              
              // Верхняя стена
              topWallRef.current = worldRef.current.createBody({
                type: 'static',
                position: planck.Vec2(width / 2, -wallThickness / 2),
              });
              topWallRef.current.createFixture({
                shape: planck.Box(width / 2, wallThickness / 2),
                friction: 0.1,
                restitution: 0.8
              });
              
              // Пол
              floorRef.current = worldRef.current.createBody({
                type: 'static',
                position: planck.Vec2(width / 2, height + wallThickness / 2),
              });
              floorRef.current.createFixture({
                shape: planck.Box(width / 2, wallThickness / 2),
                friction: 0.5,
                restitution: 0.2
              });
              floorRef.current.setUserData({ isFloor: true });
            }
            
            // Обновляем стили canvas
            if (game.canvas) {
              game.canvas.style.maxWidth = `${newGameWidth}px`;
              game.canvas.style.maxHeight = `${newGameHeight}px`;
              game.canvas.style.position = 'absolute';
              game.canvas.style.bottom = '0';
              game.canvas.style.left = '50%';
              game.canvas.style.transform = 'translateX(-50%)';
              game.canvas.style.margin = '0';
              
              // Добавляем плавный переход для предотвращения скачков при изменении размера
              game.canvas.style.transition = 'width 0.2s ease, height 0.2s ease';
            }
            
            // Получаем сцену игры
            const gameScene = game.scene.scenes[0];
            
            // Возобновляем обработку физики после обновления всех объектов
            if (gameScene) {
              gameScene.physics?.resume();
            }
          } catch (error) {
            console.error("Ошибка при изменении размера игры:", error);
          }
        };
        
        // Добавляем дебаунсинг для предотвращения слишком частых вызовов функции
        const debounceResize = (func: Function, wait: number) => {
          let timeout: NodeJS.Timeout | null = null;
          return function executedFunction() {
            // сохраняем контекст и аргументы для последующего вызова
            // @ts-ignore
            const context = this;
            const args = arguments;
            
            // очищаем предыдущий таймаут
            if (timeout) clearTimeout(timeout);
            
            // устанавливаем новый таймаут
            timeout = setTimeout(() => {
              func.apply(context, args);
            }, wait);
          };
        };
        
        // Используем дебаунсинг для функции handleResize
        const debouncedHandleResize = debounceResize(handleResize, 100);
        
        // Добавляем слушатель изменения размера окна
        window.addEventListener('resize', debouncedHandleResize);
        resizeHandler = debouncedHandleResize;
      } catch (error) {
        // Ошибка при инициализации Phaser
        setDebugMessage(`Критическая ошибка: ${error}`);
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
          // Ошибка при уничтожении Phaser игры
        }
      }
    };
  }, []);

  // Компонент не рендерит никакого UI
  return null;
};

export default GameInitializer; 