'use client'

import React, { useEffect, useRef } from 'react';
import * as planck from 'planck';
import { createPhysicsWorld } from '../physics/createPhysicsWorld';
import { createNextBall } from '../physics/createNextBall';
import { createTrajectoryLine, updateTrajectoryLine } from '../physics/trajectoryLine';
import { generateBallLevel } from '../physics/throwBall';
import { setupNormalBallsCollisions, isBodyDestroyed } from '../utils/bodyUtils';
import { setupSpecialBallsCollisions } from '../physics/collisionHandlers';
import { throwBall } from '../physics/throwBall';
import { BASE_GAME_WIDTH, FIXED_PLAYER_Y, GAME_ASPECT_RATIO, PLAYER_SIZE } from '../constants/gameConstants';
import { ExtendedBall, ExtendedNextBall, TrajectoryRef } from '../types';

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
  snotCoins
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
        console.error('Ошибка при остановке анимаций:', error);
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
            console.error("Ошибка при удалении тела шара в cleanupResources:", e);
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
      console.error('Ошибка при очистке шаров:', error);
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
                this.load.image('trees', '/images/merge/Game/ui/trees.webp');
                this.load.image('floor', '/images/merge/Game/ui/floor.webp');
                this.load.image('left-wall', '/images/merge/Game/ui/left-wall.webp');
                this.load.image('right-wall', '/images/merge/Game/ui/right-wall.webp');
                
                // Загружаем изображения персонажа
                this.load.image('coin-king', '/images/merge/Game/ui/CoinKing.webp');
                this.load.image('coin-king-throw', '/images/merge/Game/ui/CoinKing1.webp');
                
                // Загружаем изображения обычных шаров
                for (let i = 1; i <= 12; i++) {
                  this.load.image(`${i}`, `/images/merge/Balls/${i}.webp`);
                }
                
                // Загружаем специальные шары
                this.load.image('bull-ball', '/images/merge/Balls/Bull.webp');
                this.load.image('bomb', '/images/merge/Balls/Bomb.webp');
              } catch (error) {
                console.error('Ошибка при загрузке ресурсов:', error);
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
                
                // Добавляем стены
                const wallWidth = 32;
                this.add.image(wallWidth / 2, newGameHeight / 2, 'left-wall')
                  .setOrigin(0.5, 0.5)
                  .setDisplaySize(wallWidth, newGameHeight)
                  .setAlpha(0);
                
                this.add.image(newGameWidth - wallWidth / 2, newGameHeight / 2, 'right-wall')
                  .setOrigin(0.5, 0.5)
                  .setDisplaySize(wallWidth, newGameHeight)
                  .setAlpha(0);
                
                // Добавляем пол
                const floorHeight = 30;
                const floorImage = this.add.image(newGameWidth / 2, newGameHeight - floorHeight / 2, 'floor');
                floorImage.setDisplaySize(newGameWidth, floorHeight);
                floorImage.setDepth(90);
                
                // Создаем вертикальный бар перегрева с закругленными углами
                const barWidth = 20;
                const barHeight = 120;
                const barX = 30;
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
                  // Создаем контейнер с той же глубиной что и индикатор перегрева
                  nextBallIndicator = this.add.container(0, 0);
                  nextBallIndicator.setDepth(150);
                  
                  // Размеры и положение индикатора (без большой рамки)
                  const indicatorSize = 60; // Уменьшаем размер
                  const indicatorX = newGameWidth - indicatorSize - 10; // Размещаем ближе к краю экрана
                  const indicatorY = 50; // Тот же отступ сверху, что и у индикатора перегрева
                  
                  // Добавляем небольшую метку "СЛЕД." вместо большого заголовка
                  const titleText = this.add.text(indicatorX + indicatorSize / 2, indicatorY - 15, "СЛЕД.", {
                    fontFamily: 'Arial',
                    fontSize: '12px',
                    color: '#ffffff',
                    fontWeight: 'bold'
                  }).setOrigin(0.5);
                  
                  // Добавляем метку в контейнер
                  nextBallIndicator.add(titleText);
                  
                  // Сохраняем свойства для обновления
                  nextBallIndicator.centerX = indicatorX;
                  nextBallIndicator.centerY = indicatorY + indicatorSize / 2;
                  nextBallIndicator.size = indicatorSize; // Размер шара
                  
                  return nextBallIndicator;
                };
                
                // Функция для обновления индикатора следующего шара
                const updateNextBallIndicator = (level: number) => {
                  if (!nextBallIndicator) return;
                  
                  // Удаляем предыдущий шар, если он есть (кроме метки)
                  while (nextBallIndicator.list.length > 1) {
                    const item = nextBallIndicator.list[nextBallIndicator.list.length - 1];
                    nextBallIndicator.remove(item);
                    item.destroy();
                  }
                  
                  // Создаем временную сцену для получения контейнера следующего шара
                  try {
                    // Используем уменьшенный масштаб для шара в индикаторе
                    const scaleFactor = 0.7;
                    
                    // Имитируем тело игрока для создания шара
                    const tempPlayerBody = {
                      getPosition: () => ({ x: nextBallIndicator.centerX / 30, y: 0 })
                    };
                    
                    const tempPlayerBodyRef = { current: tempPlayerBody };
                    
                    // Создаем шар того же уровня, что будет следующим
                    const nextBall = createNextBall(
                      this, 
                      tempPlayerBodyRef, 
                      level
                    );
                    
                    if (nextBall && nextBall.sprite && nextBall.sprite.container) {
                      // Получаем контейнер шара
                      const ballContainer = nextBall.sprite.container;
                      
                      // Устанавливаем позицию шара в центр индикатора
                      ballContainer.x = nextBallIndicator.centerX;
                      ballContainer.y = nextBallIndicator.centerY;
                      
                      // Масштабируем шар для компактного отображения
                      ballContainer.setScale(scaleFactor, scaleFactor);
                      
                      // Останавливаем все твины и анимации для индикатора
                      try {
                        // Останавливаем все анимации контейнера
                        this.tweens.killTweensOf(ballContainer);
                        
                        // Останавливаем все анимации вращения или пульсации внутри
                        if (ballContainer.getAll) {
                          const children = ballContainer.getAll();
                          children.forEach((child: any) => {
                            if (child) {
                              this.tweens.killTweensOf(child);
                            }
                          });
                        }
                      } catch (e) {
                        console.warn('Не удалось полностью остановить анимации индикатора', e);
                      }
                      
                      // Определяем размер шара для создания круглой рамки
                      // Получаем фактический размер шара в зависимости от уровня
                      const baseRadius = level <= 3 ? 20 : level <= 6 ? 22 : level <= 9 ? 24 : 26;
                      const ballRadius = baseRadius * scaleFactor;
                      
                      // Создаем круглую рамку вокруг шара
                      const circleFrame = this.add.graphics();
                      circleFrame.lineStyle(2, 0xffffff, 0.8); // Белая рамка с прозрачностью
                      circleFrame.strokeCircle(0, 0, ballRadius + 3); // Чуть больше радиуса шара
                      
                      // Убедимся, что рамка находится под шаром в контейнере, но над фоном
                      if (ballContainer.list && ballContainer.list.length > 0) {
                        // Вставляем рамку в начало списка дочерних элементов контейнера
                        ballContainer.addAt(circleFrame, 0);
                      } else {
                        // Добавляем рамку в контейнер шара
                        ballContainer.add(circleFrame);
                      }
                      
                      // Добавляем шар в индикатор
                      nextBallIndicator.add(ballContainer);
                    }
                  } catch (error) {
                    console.error('Ошибка при обновлении индикатора следующего шара:', error);
                  }
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
                createPhysicsWorld(newGameWidth, newGameHeight, {
                  worldRef,
                  playerBodyRef,
                  leftWallRef,
                  rightWallRef,
                  topWallRef,
                  floorRef
                });
                
                // Настраиваем обработчики столкновений
                if (worldRef.current) {
                  // Для обычных шаров
                  setupNormalBallsCollisions(worldRef.current, ballsRef);
                  
                  // Для специальных шаров
                  setupSpecialBallsCollisions(
                    worldRef.current,
                    ballsRef,
                    worldRef,
                    floorRef,
                    leftWallRef,
                    rightWallRef,
                    topWallRef,
                    (ball: ExtendedBall) => {
                      if (ball && ball.body && worldRef.current) {
                        ball.body.setUserData(null);
                        worldRef.current.destroyBody(ball.body);
                      }
                      if (ball && ball.sprite && ball.sprite.container) {
                        ball.sprite.container.destroy();
                      }
                      const index = ballsRef.current.indexOf(ball);
                      if (index > -1) {
                        ballsRef.current.splice(index, 1);
                      }
                    },
                    dispatch,
                    snotCoins,
                    isBodyDestroyed
                  );
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
                    console.error('Ошибка при обработке движения мыши:', error);
                  }
                });
                
                // Обработчик клика мыши для броска шара
                this.input.on('pointerdown', (pointer: any) => {
                  // Добавляем отладочную информацию
                  console.log('Клик мыши обработан', {
                    isPaused,
                    isOverheated,
                    pointer: { x: pointer.x, y: pointer.y },
                    gameSize: { width: this.sys.game.config.width, height: this.sys.game.config.height },
                    lastThrowTime,
                    currentTime: Date.now(),
                    timeSinceLastThrow: Date.now() - lastThrowTime,
                    hasBall: !!currentBallRef.current
                  });
                  
                  if (isPaused) {
                    console.log('Игра на паузе, бросок запрещен');
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
                    console.log('Клик вне игрового поля', {
                      pointerX: pointer.x,
                      pointerY: pointer.y,
                      gameWidth,
                      gameHeight
                    });
                    return;
                  }
                  
                  // Если система перегрета, запрещаем бросок
                  if (isOverheated) {
                    console.log('Система перегрета, бросок запрещен');
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
                    console.log('Слишком короткий интервал между бросками', {
                      interval: currentTime - lastThrowTime,
                      minInterval: MIN_THROW_INTERVAL
                    });
                    return;
                  }
                  
                  try {
                    // Если шар для броска не существует, создаем новый
                    if (!currentBallRef.current) {
                      console.log('Шар для броска отсутствует, создаем новый');
                      const newLevel = generateBallLevel();
                      currentBallRef.current = createNextBall(this, playerBodyRef, newLevel);
                      
                      // Проверяем, успешно ли создался шар
                      if (!currentBallRef.current) {
                        console.error('Не удалось создать шар для броска');
                        return;
                      }
                    }
                    
                    // Проверяем валидность шара перед броском
                    if (!currentBallRef.current || !currentBallRef.current.sprite || 
                        !currentBallRef.current.sprite.container) {
                      console.error('Невалидный шар для броска', currentBallRef.current);
                      
                      // Попытка восстановления
                      const newLevel = generateBallLevel();
                      currentBallRef.current = createNextBall(this, playerBodyRef, newLevel);
                      
                      // Если восстановление не удалось, выходим
                      if (!currentBallRef.current) {
                        console.error('Не удалось восстановить шар для броска');
                        return;
                      }
                    }
                    
                    if (currentBallRef.current) {
                      console.log('Бросаем шар', { 
                        level: currentBallRef.current.level,
                        specialType: currentBallRef.current.specialType || 'обычный'
                      });
                      
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
                        console.log('Шар успешно брошен');
                        
                        // Обновляем индикатор следующего шара
                        if (nextBallLevelRef.current) {
                          updateNextBallIndicator(nextBallLevelRef.current);
                        }
                      } else {
                        console.warn('Бросок шара не удался');
                      }
                      
                      // Обновляем время последнего броска
                      lastThrowTime = currentTime;
                    }
                  } catch (error) {
                    console.error('Ошибка при броске шара:', error);
                    
                    // Попытка восстановления после ошибки
                    try {
                      // Создаем новый шар
                      const newLevel = generateBallLevel();
                      currentBallRef.current = createNextBall(this, playerBodyRef, newLevel);
                      
                      // Обновляем время последнего броска, чтобы избежать спама при восстановлении
                      lastThrowTime = currentTime;
                    } catch (e) {
                      console.error('Не удалось восстановиться после ошибки:', e);
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
                  console.error('Ошибка при настройке обработки тачскрина:', error);
                }
                
                setDebugMessage("Инициализация завершена успешно");
                setIsLoading(false);
                isInitializedRef.current = true;
              } catch (error) {
                console.error('Ошибка при создании сцены:', error);
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
          if (!gameContainerRef.current || !game) return;
          
          const newContainerRect = gameContainerRef.current.getBoundingClientRect();
          const newContainerWidth = newContainerRect.width;
          const newContainerHeight = newContainerRect.height;
          
          // Определяем новые размеры с сохранением пропорций
          let newGameWidth, newGameHeight;
          
          if (newContainerHeight / aspectRatio > newContainerWidth) {
            newGameWidth = newContainerWidth;
            newGameHeight = newContainerWidth / aspectRatio;
          } else {
            newGameHeight = newContainerHeight;
            newGameWidth = newContainerHeight * aspectRatio;
          }
          
          // Округляем размеры
          newGameWidth = Math.floor(newGameWidth);
          newGameHeight = Math.floor(newGameHeight);
          
          // Проверяем, достаточно ли изменился размер для перерисовки
          const minResizeThreshold = 5;
          if (Math.abs(newGameWidth - game.scale.width) < minResizeThreshold && 
              Math.abs(newGameHeight - game.scale.height) < minResizeThreshold) {
            return;
          }
          
          // Обновляем размер игры
          game.scale.resize(newGameWidth, newGameHeight);
          game.scale.refresh();
          
          // Обновляем стили canvas
          if (game.canvas) {
            game.canvas.style.maxWidth = `${newGameWidth}px`;
            game.canvas.style.maxHeight = `${newGameHeight}px`;
          }
        };
        
        // Добавляем слушатель изменения размера окна
        window.addEventListener('resize', handleResize);
        resizeHandler = handleResize;
        
      } catch (error) {
        console.error('Ошибка при инициализации Phaser:', error);
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
          console.error('Ошибка при уничтожении Phaser игры:', error);
        }
      }
    };
  }, []);

  // Компонент не рендерит никакого UI
  return null;
};

export default GameInitializer; 