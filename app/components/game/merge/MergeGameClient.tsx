'use client'

import React, { useState, useEffect, useRef } from 'react';
import * as planck from 'planck';
// Удаляем дублирующиеся интерфейсы и импортируем их из директории types
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
import { formatSnotValue } from '../../../utils/formatters';
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
  BALL_RESTITUTION,
  BALL_COLORS,
  BULL_COLOR,
  BOMB_COLOR
} from './constants/gameConstants';
import GameHeader from './components/GameHeader';
import PauseMenu from './components/PauseMenu';
import LoadingScreen from './components/LoadingScreen';
import { useGameContext } from '../../../contexts/game/hooks/useGameContext';
// Импортируем типы из файла типов
import { Ball, NextBall, TrajectoryRef, MergeGameProps, PhaserType } from './types/index';

// Константа для частоты проверки "зависших" шаров
const STUCK_CHECK_INTERVAL = 30;

// Уменьшаем отступы безопасности до нуля
const safetyMargin = 0;

// Функция для проверки, удалено ли тело - перемещаем в начало файла
const isBodyDestroyed = (body: planck.Body): boolean => {
  // Проверяем несколько признаков, указывающих на то, что тело было удалено
  try {
    // 1. Проверяем, активно ли тело
    if (!body.isActive()) return true;
    
    // 2. Проверяем наличие фикстур
    if (!body.getFixtureList()) return true;
    
    // 3. Проверяем, связано ли тело с миром
    if (!body.getWorld()) return true;
    
    // Если все проверки прошли, тело не считается удаленным
    return false;
  } catch (e) {
    // Если при доступе к телу возникла ошибка, считаем его удаленным
    console.warn('Ошибка при проверке тела, считаем его удаленным:', e);
    return true;
  }
};

// Определяем дополнительные типы, расширяющие импортированные типы
interface ExtendedBall extends Ball {
  markedForRemoval?: boolean;
  isMerging?: boolean;
  isMerged?: boolean;
  markedForMerge?: boolean;
  mergeTimer?: number;
}

interface ExtendedNextBall extends NextBall {
  body?: planck.Body; // Добавляем поле body, которое используется в некоторых местах кода
  createdAt?: number;
}

// Определяем структуру данных, хранящихся в физических телах
interface PhysicsUserData {
  isBall?: boolean;
  type?: string;
  specialType?: string;
  level?: number;
  createdAt?: number;
  shouldMerge?: boolean;
  mergeWith?: planck.Body;
  [key: string]: any; // Другие возможные поля
}

const MergeGameClient: React.FC<MergeGameProps> = ({ onClose, gameOptions = {} }) => {
  // Получаем состояние игры из контекста
  const { state: gameState, dispatch } = useGameContext();
  const snotCoins = gameState.inventory?.snotCoins || 0;
  const snot = gameState.inventory?.snot || 0;
  const containerCapacity = gameState.inventory?.containerCapacity || 1;

  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<any>(null);
  const ballsRef = useRef<ExtendedBall[]>([]);
  const nextBallLevelRef = useRef<number>(1);
  const currentBallRef = useRef<ExtendedNextBall | null>(null);
  const trajectoryLineRef = useRef<TrajectoryRef | null>(null);
  const frameCounterRef = useRef<number>(0);
  
  // Добавляем счетчик кадров для проверки зависших шаров
  const stuckCheckCounterRef = useRef<number>(0);
  
  // Добавляем Map для отслеживания потенциально зависших шаров и их времени
  const potentiallyStuckBallsRef = useRef<Map<ExtendedBall, number>>(new Map());
  
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
  
  // Добавляем состояние для отслеживания, был ли использован шар Bull
  const [bullUsed, setBullUsed] = useState<boolean>(false);
  
  // Стоимость использования специальных возможностей в % от вместимости
  const specialCosts = {
    Bull: 20, // 20% от вместимости
    Bomb: 5,  // 5% от вместимости
    Joy: 10   // 10% от вместимости
  };
  
  // Минимальный интервал между бросками шаров (в миллисекундах)
  const MIN_THROW_INTERVAL = 1000; // 1 секунда
  
  // Добавляем функцию для проверки, можно ли использовать специальную возможность
  const canUseSpecialFeature = (type: string): boolean => {
    // Получаем стоимость использования в процентах от вместимости
    const costPercent = specialCosts[type as keyof typeof specialCosts] || 0;
    
    // Вычисляем абсолютную стоимость
    const cost = (costPercent / 100) * containerCapacity;
    
    // Проверяем, достаточно ли ресурсов
    return snotCoins >= cost;
  };
  
  // Добавляем функцию для списания стоимости использования специальной возможности
  const deductResourceCost = (type: string): void => {
    // Получаем стоимость использования в процентах от вместимости
    const costPercent = specialCosts[type as keyof typeof specialCosts] || 0;
    
    // Вычисляем абсолютную стоимость
    const cost = (costPercent / 100) * containerCapacity;
    
    // Списываем ресурсы через dispatch
    dispatch({
      type: 'UPDATE_INVENTORY',
      payload: {
        snotCoins: Math.max(0, snotCoins - cost)
      }
    });
    
    // Выводим в консоль для отладки
    console.log(`Использована способность ${type}, списано ${cost.toFixed(4)} SC. Осталось: ${(snotCoins - cost).toFixed(4)} SC`);
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
        // Добавляем загрузку изображения шара Bull
        scene.load.image('bull-ball', '/images/merge/Balls/Bull.webp');
        // Добавляем загрузку изображений CoinKing
        scene.load.image('coin-king', '/images/merge/Game/ui/CoinKing.webp');
        scene.load.image('coin-king-throw', '/images/merge/Game/ui/CoinKing1.webp');
        
        // Добавляем загрузку изображений шаров уровней от 1 до 12
        scene.load.image('1', '/images/merge/Balls/1.webp');
        scene.load.image('2', '/images/merge/Balls/2.webp');
        scene.load.image('3', '/images/merge/Balls/3.webp');
        scene.load.image('4', '/images/merge/Balls/4.webp');
        scene.load.image('5', '/images/merge/Balls/5.webp');
        scene.load.image('6', '/images/merge/Balls/6.webp');
        scene.load.image('7', '/images/merge/Balls/7.webp');
        scene.load.image('8', '/images/merge/Balls/8.webp');
        scene.load.image('9', '/images/merge/Balls/9.webp');
        scene.load.image('10', '/images/merge/Balls/10.webp');
        scene.load.image('11', '/images/merge/Balls/11.webp');
        scene.load.image('12', '/images/merge/Balls/12.webp');
        
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
            const playerSizeScaled = PLAYER_SIZE * 4 * scaleFactor; // Увеличиваем размер для изображения в 4 раза
            
            // Создаем игрока как изображение CoinKing вместо круга
            playerSprite = scene.add.image(gameWidth / 2, FIXED_PLAYER_Y, 'coin-king')
              .setOrigin(0.5, 0.5)
              .setDisplaySize(playerSizeScaled, playerSizeScaled)
              .setDepth(5); // Низкое значение глубины, чтобы отображаться за шарами
            
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
        
        // Регистрируем обработчик событий
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
              // Преобразуем координаты указателя в физические координаты
              const mouseX = pointer.x / 30;
              
              // Устанавливаем позицию игрока, поддерживая фиксированную высоту
              playerBodyRef.current.setPosition(planck.Vec2(mouseX, FIXED_PLAYER_Y / 30));
              
              // Сбрасываем скорость для предотвращения падения
              playerBodyRef.current.setLinearVelocity(planck.Vec2(0, 0));
              
              // Пробуждаем тело, если оно уснуло
              playerBodyRef.current.setAwake(true);
              
              // Обновляем визуальную позицию игрока
              if (playerSprite) {
                playerSprite.x = pointer.x;
                playerSprite.y = FIXED_PLAYER_Y;
              }
              
              // Перемещаем шар для броска вместе с игроком
              if (currentBallRef.current && currentBallRef.current.sprite && 
                  currentBallRef.current.sprite.container && !currentBallRef.current.sprite.container.destroyed) {
                // Используем позицию указателя мыши для более точного позиционирования
                currentBallRef.current.sprite.container.x = pointer.x;
                currentBallRef.current.sprite.container.y = FIXED_PLAYER_Y + 24; // Располагаем НИЖЕ игрока
                
                // Обновляем положение пунктирной линии
                updateTrajectoryLine(
                  scene, 
                  trajectoryLineRef,
                  pointer.x, 
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
                сцена: !!scene, 
                specialType: currentBallRef.current?.specialType || 'обычный'
              });
              
              if (currentBallRef.current) {
                // Изменяем изображение игрока на CoinKing1.webp при броске
                if (playerSprite) {
                  playerSprite.setTexture('coin-king-throw');
                  
                  // Возвращаем оригинальное изображение через 300 мс
                  setTimeout(() => {
                    if (playerSprite) {
                      playerSprite.setTexture('coin-king');
                    }
                  }, 300);
                }
                
                // Обновляем время последнего броска
                setLastThrowTime(currentTime);
                
                // Проверяем, если текущий шар - Bull, отмечаем его как использованный
                if (currentBallRef.current.specialType === 'Bull') {
                  console.log('Бросок шара Bull, устанавливаем bullUsed = true');
                  setBullUsed(true);
                  
                  // После броска сразу меняем специальный тип шара на null для следующего шара
                  setSpecialBallType(null);
                }
                
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
      try {
        if (isPaused || !worldRef.current) return;
        
        // Инкрементируем счетчик кадров
        frameCounterRef.current++;
        
        // Увеличиваем счетчик для проверки зависших шаров
        stuckCheckCounterRef.current++;
        
        // Проверяем на потенциально "зависшие" шары каждые N кадров
        if (stuckCheckCounterRef.current >= STUCK_CHECK_INTERVAL) {
          stuckCheckCounterRef.current = 0;
          checkStuckBalls();
        }
        
        // Безопасное выполнение физического шага
        try {
          // Проверяем все контакты перед шагом, удаляя недействительные
          let contact = worldRef.current.getContactList();
          while (contact) {
            const nextContact = contact.getNext(); // Сохраняем следующий контакт перед возможным удалением
            const fixtureA = contact.getFixtureA();
            const fixtureB = contact.getFixtureB();
            
            // Проверяем, что фикстуры и их тела существуют и действительны
            if (!fixtureA || !fixtureB || !fixtureA.getBody() || !fixtureB.getBody() ||
                !fixtureA.getBody().isActive() || !fixtureB.getBody().isActive() ||
                isBodyDestroyed(fixtureA.getBody()) || isBodyDestroyed(fixtureB.getBody())) {
              // Если фикстуры или тела недействительны, отключаем контакт
              contact.setEnabled(false);
            }
            
            contact = nextContact;
          }
          
          // Выполняем шаг физического мира
          try {
            // Более агрессивная очистка контактов перед шагом
            let pendingContacts: any[] = [];
            let contact = worldRef.current.getContactList();
            
            // Сначала соберем все контакты для безопасной итерации
            while (contact) {
              pendingContacts.push(contact);
              contact = contact.getNext();
            }
            
            // Теперь проверяем и отключаем проблемные контакты
            for (const contact of pendingContacts) {
              try {
                const fixtureA = contact.getFixtureA();
                const fixtureB = contact.getFixtureB();
                
                if (!fixtureA || !fixtureB) {
                  contact.setEnabled(false);
                  continue;
                }
                
                const bodyA = fixtureA.getBody();
                const bodyB = fixtureB.getBody();
                
                if (!bodyA || !bodyB || !bodyA.isActive() || !bodyB.isActive()) {
                  contact.setEnabled(false);
                }
              } catch (contactError) {
                // При любой ошибке отключаем контакт
                try {
                  contact.setEnabled(false);
                } catch (e) {
                  // Игнорируем ошибки при попытке отключить контакт
                }
              }
            }
            
            // Прямое обращение к внутренним структурам, чтобы гарантировать удаление проблемных контактов
            const world = worldRef.current as any;
            if (world.m_contactManager && world.m_contactManager.m_contactList) {
              // Принудительно отключаем все проблемные контакты
              const safeContacts = [];
              let currentContact = world.m_contactManager.m_contactList;
              
              while (currentContact) {
                safeContacts.push(currentContact);
                currentContact = currentContact.getNext();
              }
              
              safeContacts.forEach(contact => {
                try {
                  if (!contact.getFixtureA() || !contact.getFixtureB()) {
                    contact.setEnabled(false);
                  }
                } catch (e) {
                  // Ошибка при проверке контакта - отключаем
                  try { contact.setEnabled(false); } catch (_) {}
                }
              });
            }
            
            // Теперь выполняем шаг физики
            worldRef.current.step(TIME_STEP, VELOCITY_ITERATIONS, POSITION_ITERATIONS);
          } catch (stepError) {
            console.error('Ошибка при выполнении шага физического мира:', stepError);
            
            // Если произошла критическая ошибка, пробуем восстановить мир
            // путем удаления всех контактов и пробуждения всех тел
            try {
              const world = worldRef.current as any;
              
              // Отключаем все контакты
              if (world.m_contactManager) {
                let currentContact = world.m_contactManager.m_contactList;
                while (currentContact) {
                  try {
                    currentContact.setEnabled(false);
                  } catch (e) {}
                  currentContact = currentContact.getNext();
                }
              }
              
              // Пробуждаем все тела
              let body = worldRef.current.getBodyList();
              while (body) {
                try {
                  body.setAwake(true);
                } catch (e) {}
                body = body.getNext();
              }
            } catch (recoveryError) {
              console.error('Не удалось восстановить физический мир:', recoveryError);
            }
          }
          
          // Обновляем позицию игрока, если спрайт доступен
          if (playerBodyRef.current && playerSprite) {
            const position = playerBodyRef.current.getPosition();
            playerSprite.x = toPixels(position.x);
            playerSprite.y = toPixels(position.y);
            
            // Делаем принудительный сброс скорости игрока
            playerBodyRef.current.setLinearVelocity(planck.Vec2(0, 0));
            playerBodyRef.current.setAwake(true);
          }
          
          // Проверяем на слияния каждые N кадров
          if (frameCounterRef.current % CHECK_MERGE_FREQUENCY === 0) {
            if (hasBallsMarkedForMerge(worldRef)) {
              // Вызываем checkAndMergeBalls с правильными аргументами
              checkAndMergeBalls(
                gameInstanceRef.current.scene.scenes[0],
                worldRef,
                ballsRef,
                frameCounterRef.current
              );
            }
          }
          
          // Обновляем позиции всех шаров и проверяем их статус
          if (ballsRef.current.length > 0) {
            for (let i = 0; i < ballsRef.current.length; i++) {
              const ball = ballsRef.current[i];
              
              // Пропускаем недействительные шары или шары без тела
              if (!ball || !ball.body || isBodyDestroyed(ball.body)) {
                continue;
              }
              
              // Обновляем визуальное представление шара
              try {
                const pos = ball.body.getPosition();
                if (ball.sprite && ball.sprite.container && !ball.sprite.container.destroyed) {
                  ball.sprite.container.x = pos.x * 30;
                  ball.sprite.container.y = pos.y * 30;
                }
                
                // Обновляем вращение, если это необходимо
                if (ball.body.getAngle() !== 0 && ball.sprite.circle) {
                  const angle = ball.body.getAngle() * (180 / Math.PI); // Переводим радианы в градусы
                  ball.sprite.circle.angle = angle;
                }
              } catch (error) {
                console.warn('Ошибка при обновлении позиции шара:', error);
              }
            }
          }
        } catch (error) {
          console.error('Ошибка при выполнении шага физического мира:', error);
          // Безопасная очистка недействительных тел при ошибке
          if (worldRef.current) {
            try {
              let body = worldRef.current.getBodyList();
              let bodiesRemoved = false;
              
              while (body) {
                const nextBody = body.getNext();
                
                // Проверяем действительность тела
                if (isBodyDestroyed(body)) {
                  // Удаляем тело, если оно недействительно
                  worldRef.current.destroyBody(body);
                  bodiesRemoved = true;
                }
                
                body = nextBody;
              }
              
              if (bodiesRemoved) {
                console.log('Удалены недействительные тела для восстановления работы физического мира');
              }
            } catch (cleanupError) {
              console.error('Ошибка при попытке очистки недействительных тел:', cleanupError);
            }
          }
        }
        
        // Обновляем текущий шар для броска, если он существует
        if (currentBallRef.current && currentBallRef.current.sprite && 
            currentBallRef.current.sprite.container && !currentBallRef.current.sprite.container.destroyed &&
            playerBodyRef.current) {
          // Получаем позицию игрока
          const playerPos = playerBodyRef.current.getPosition();
          
          // Обновляем позицию шара для броска
          currentBallRef.current.sprite.container.x = 30 * playerPos.x;
          currentBallRef.current.sprite.container.y = FIXED_PLAYER_Y + 24;
          
          // Обновляем положение пунктирной траектории
          updateTrajectoryLine(
            gameInstanceRef.current.scene.scenes[0], 
            trajectoryLineRef,
            30 * playerPos.x, 
            FIXED_PLAYER_Y + 24,
            isPaused
          );
        }
      } catch (error) {
        console.error('Критическая ошибка в updateScene:', error);
        // Приостанавливаем игру при критической ошибке
        setIsPaused(true);
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
    const removeBall = (ball: ExtendedBall) => {
      if (!ball) {
        console.warn("Попытка удаления несуществующего шара");
        return;
      }
      
      console.log(`🔥 УДАЛЕНИЕ ШАРА: уровень ${ball.level}, тип ${ball.specialType || 'обычный'}`);
      
      // Принудительно фильтруем массив, чтобы сразу исключить шар из будущих обработок
      ballsRef.current = ballsRef.current.filter(b => b !== ball);
      
      // 1. Сначала удаляем все визуальные компоненты шара НЕМЕДЛЕННО
      if (ball.sprite) {
        try {
          // Для шаров с эффектами
          if (ball.sprite.effectsContainer && !ball.sprite.effectsContainer.destroyed) {
            console.log(`Удаляем контейнер эффектов шара уровня ${ball.level}`);
            ball.sprite.effectsContainer.destroy();
          }
          
          // Удаляем основной контейнер
          if (ball.sprite.container && !ball.sprite.container.destroyed) {
            console.log(`Удаляем визуальный контейнер шара уровня ${ball.level}`);
            // Принудительно удаляем все дочерние элементы
            if (ball.sprite.container.list && Array.isArray(ball.sprite.container.list)) {
              ball.sprite.container.list.forEach((child: any) => {
                if (child && !child.destroyed) {
                  child.destroy();
                }
              });
            }
            ball.sprite.container.destroy();
          }
          
          // Явно устанавливаем все спрайты в null
          ball.sprite.container = null;
          ball.sprite.circle = null;
          ball.sprite.text = null;
          if (ball.sprite.effectsContainer) ball.sprite.effectsContainer = null;
        } catch (e) {
          console.error(`Ошибка при удалении визуальных элементов шара уровня ${ball.level}:`, e);
        }
      }
      
      // 2. Затем удаляем физическое тело
      if (ball.body && worldRef.current) {
        try {
          // Проверяем, активно ли еще тело
          const isBodyActive = ball.body.isActive();
          
          // Очищаем пользовательские данные
          ball.body.setUserData(null);
          
          // Останавливаем тело
          ball.body.setLinearVelocity({ x: 0, y: 0 });
          ball.body.setAngularVelocity(0);
          
          // Отключаем физику
          ball.body.setActive(false);
          ball.body.setAwake(false);
          
          // Удаляем все фикстуры
          let fixture = ball.body.getFixtureList();
          while (fixture) {
            const nextFixture = fixture.getNext();
            ball.body.destroyFixture(fixture);
            fixture = nextFixture;
          }
          
          // Удаляем тело из мира, если оно еще активно
          if (isBodyActive) {
            console.log(`Удаляем физическое тело шара уровня ${ball.level}`);
            try {
              worldRef.current.destroyBody(ball.body);
            } catch (e) {
              console.error(`Ошибка при удалении физического тела: ${e}`);
            }
          }
          
          // Явное освобождение памяти
          ball.body = null as any;
        } catch (e) {
          console.error(`Ошибка при удалении физического тела шара уровня ${ball.level}:`, e);
        }
      }
      
      // 3. Очищаем все ссылки в объекте шара
      Object.keys(ball).forEach(key => {
        (ball as any)[key] = null;
      });
      
      // 4. Ещё раз убеждаемся, что шар удалён из массива
      const stillExists = ballsRef.current.some(b => b === ball);
      if (stillExists) {
        console.error(`⚠️ ШАР ВСЁ ЕЩЁ СУЩЕСТВУЕТ В МАССИВЕ! Принудительно очищаем...`);
        ballsRef.current = ballsRef.current.filter(b => b !== ball);
      }
      
      // 5. Проверяем и удаляем все "мёртвые" шары без физических тел
      const invalidBalls = ballsRef.current.filter(b => !b || !b.body);
      if (invalidBalls.length > 0) {
        console.warn(`Найдено ${invalidBalls.length} шаров без физических тел, очищаем...`);
        ballsRef.current = ballsRef.current.filter(b => b && b.body);
      }
      
      // Пробуем явно вызвать сборщик мусора (если доступен)
      if (typeof global !== 'undefined' && global.gc) {
        try {
          global.gc();
        } catch (e) {
          console.warn("Не удалось запустить сборщик мусора:", e);
        }
      }
    };
    
    // Функция для поиска нижних шаров
    const findBottomBalls = (count: number): ExtendedBall[] => {
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
    
    // Функция для настройки обнаружения столкновений специальных шаров (Bull и Bomb)
    const setupBullCollisionDetection = (world: planck.World) => {
      // Создаем сет для отслеживания уже обработанных контактов
      const processedContacts = new Set<string>();
      
      // Регистрируем обработчик начала контакта
      world.on('begin-contact', (contact: planck.Contact) => {
        try {
          const fixtureA = contact.getFixtureA();
          const fixtureB = contact.getFixtureB();
          
          if (!fixtureA || !fixtureB) return;
          
          const bodyA = fixtureA.getBody();
          const bodyB = fixtureB.getBody();
          
          if (!bodyA || !bodyB) return;
          
          const userDataA = bodyA.getUserData() as PhysicsUserData || {};
          const userDataB = bodyB.getUserData() as PhysicsUserData || {};
          
          // Проверяем, является ли один из объектов специальным шаром (Bull или Bomb)
          const isBullA = userDataA.specialType === 'Bull';
          const isBullB = userDataB.specialType === 'Bull';
          const isBombA = userDataA.specialType === 'Bomb';
          const isBombB = userDataB.specialType === 'Bomb';
          
          const isSpecialA = isBullA || isBombA;
          const isSpecialB = isBullB || isBombB;
          
          // Если ни один из объектов не является специальным шаром, пропускаем
          if (!isSpecialA && !isSpecialB) return;
          
          // Определяем, какой из объектов является специальным шаром
          const specialBody = isSpecialA ? bodyA : bodyB;
          const otherBody = isSpecialA ? bodyB : bodyA;
          const specialData = isSpecialA ? userDataA : userDataB;
          const otherData = isSpecialA ? userDataB : userDataA;
          const specialType = specialData.specialType || 'unknown';
          
          // Создаем уникальный идентификатор контакта
          const contactId = `${specialData.createdAt || Date.now()}-${otherData.createdAt || Date.now() + 1}`;
          
          // Проверяем, был ли этот контакт уже обработан
          if (processedContacts.has(contactId)) {
            return; // Пропускаем повторные контакты
          }
          
          // Добавляем контакт в список обработанных
          processedContacts.add(contactId);
          
          // Очищаем список обработанных контактов через 300 мс
          setTimeout(() => {
            processedContacts.delete(contactId);
          }, 300);
          
          // Получаем данные для отладки
          const specialLevel = specialData.level || 'неизвестен';
          const otherLevel = otherData.level || 'неизвестен';
          const otherType = otherData.type || 'неизвестен';
          
          console.log(`КОНТАКТ: ${specialType} (${specialLevel}) с объектом типа ${otherType}, уровень ${otherLevel}`);
          
          // Проверяем, является ли другой объект полом, стеной или другим объектом
          const isFloor = otherBody === floorRef.current;
          const isWall = otherBody === leftWallRef.current || 
                          otherBody === rightWallRef.current ||
                          otherBody === topWallRef.current;
          
          // Если специальный шар касается пола, удаляем его
          if (isFloor) {
            const specialBall = ballsRef.current.find(ball => 
              ball && ball.body === specialBody && ball.specialType === specialType
            );
            
            if (specialBall) {
              console.log(`${specialType} касается пола, удаляем его`);
              removeBall(specialBall);
            }
            return;
          }
          
          // Если это стена, пропускаем обработку
          if (isWall) {
            console.log(`${specialType} столкнулся со стеной, пропускаем`);
            return;
          }
          
          // Проверяем, является ли другой объект шаром
          const isBallByUserData = otherData && 
                              (otherData.isBall === true || 
                               otherData.type === 'ball' || 
                               (typeof otherData.level === 'number' && otherData.level > 0));
          
          const existsInBallsArray = ballsRef.current.some(ball => ball && ball.body === otherBody);
          const isNotSelfSpecial = otherData.specialType !== specialType;
          
          const isBallObject = (isBallByUserData || existsInBallsArray) && isNotSelfSpecial;
          
          if (!isBallObject) {
            console.log('Объект не является шаром, пропускаем');
            return;
          }
          
          // Находим шар, который нужно обработать
          const ballToProcess = ballsRef.current.find(ball => 
            ball && ball.body === otherBody
          );
          
          if (ballToProcess) {
            console.log(`${specialType} столкнулся с шаром уровня ${ballToProcess.level}`);
            
            // Для Bull шара начисляем очки и удаляем другой шар
            if (specialType === 'Bull') {
              const ballLevel = ballToProcess.level || 0;
              
              // Начисляем очки
              dispatch({
                type: 'UPDATE_INVENTORY',
                payload: {
                  snotCoins: snotCoins + ballLevel
                }
              });
              
              // Удаляем обычный шар
              removeBall(ballToProcess);
            } 
            // Для Bomb шара удаляем и его, и другой шар
            else if (specialType === 'Bomb') {
              // Удаляем обычный шар
              removeBall(ballToProcess);
              
              // Находим и удаляем Bomb шар
              const bombBall = ballsRef.current.find(ball => 
                ball && ball.body === specialBody && ball.specialType === 'Bomb'
              );
              
              if (bombBall) {
                console.log('Удаляем шар Bomb после столкновения');
                removeBall(bombBall);
              }
            }
          } else {
            console.log(`${specialType} столкнулся с объектом, но шар для обработки не найден`);
            
            // Дополнительная проверка: принудительно удаляем потерянное тело
            if (otherData.level && otherBody && worldRef.current && !isBodyDestroyed(otherBody)) {
              try {
                worldRef.current.destroyBody(otherBody);
                console.log(`Удалено "потерянное" физическое тело с уровнем ${otherData.level}`);
              } catch (e) {
                console.error(`Ошибка при удалении "потерянного" тела:`, e);
              }
            }
            
            // Если это Bomb, убираем и его тоже
            if (specialType === 'Bomb') {
              const bombBall = ballsRef.current.find(ball => 
                ball && ball.body === specialBody && ball.specialType === 'Bomb'
              );
              
              if (bombBall) {
                console.log('Удаляем шар Bomb после контакта с потерянным объектом');
                removeBall(bombBall);
              }
            }
          }
        } catch (error) {
          console.error('Ошибка при обработке столкновения:', error);
        }
      });
      
      // Добавляем обработчик post-solve для корректной обработки контактов
      world.on('post-solve', (contact: planck.Contact) => {
        const fixtureA = contact.getFixtureA();
        const fixtureB = contact.getFixtureB();
        
        if (!fixtureA || !fixtureB) return;
        
        const bodyA = fixtureA.getBody();
        const bodyB = fixtureB.getBody();
        
        if (!bodyA || !bodyB) return;
        
        const userDataA = bodyA.getUserData() as PhysicsUserData || {};
        const userDataB = bodyB.getUserData() as PhysicsUserData || {};
        
        // Проверяем, является ли один из объектов специальным шаром
        const isSpecialA = userDataA.specialType === 'Bull' || userDataA.specialType === 'Bomb';
        const isSpecialB = userDataB.specialType === 'Bull' || userDataB.specialType === 'Bomb';
        
        // Если один из объектов - специальный шар
        if (isSpecialA || isSpecialB) {
          // Устанавливаем контакт как активный
          contact.setEnabled(true);
          
          // Если это Bull, уменьшаем трение для лучшего скольжения
          const isBull = userDataA.specialType === 'Bull' || userDataB.specialType === 'Bull';
          if (isBull) {
            contact.setFriction(0.1);
          }
        }
      });
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
        
        // Настраиваем обнаружение столкновений для Bull после создания физического мира
        // Это должно быть после создания физического мира через createPhysicsWorld
        if (worldRef.current) {
          setupBullCollisionDetection(worldRef.current);
        }
        
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
                    if (trajectoryLineRef.current.destroy) {
                      trajectoryLineRef.current.destroy();
                    }
                    
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
        
        // Создаем новый шар выбранного типа
        // Для Bull используем level = 1 (а не 10), чтобы создать шар размером с 1 уровень
        const level = type === 'Bull' ? 1 : (type === 'Bomb' ? 12 : generateBallLevel());
        currentBallRef.current = createNextBall(scene, playerBodyRef, level, type);
        
        console.log(`Создан специальный шар ${type}:`, currentBallRef.current);
        
        // Если это шар Bull, меняем его физические свойства для прохождения сквозь другие шары
        if (currentBallRef.current && type === 'Bull' && 
            currentBallRef.current.specialType === 'Bull' && 
            currentBallRef.current.body) {
          
          console.log('Настраиваем физические свойства для Bull');
          
          try {
            // Удаляем существующую фикстуру
            const fixtures = currentBallRef.current.body.getFixtureList();
            if (fixtures) {
              currentBallRef.current.body.destroyFixture(fixtures);
              
              // Создаем новую фикстуру с категорией фильтрации, чтобы проходить сквозь другие шары
              const ballRadius = getBallPhysicsSize(currentBallRef.current.level);
              const ballShape = planck.Circle(ballRadius);
              
              // ВАЖНОЕ ИЗМЕНЕНИЕ: превращаем фикстуру шара Bull в сенсор и позволяем ему 
              // взаимодействовать со всеми шарами через категорию фильтрации
              currentBallRef.current.body.createFixture({
                shape: ballShape,
                density: BALL_DENSITY,
                friction: BALL_FRICTION,
                restitution: BALL_RESTITUTION,
                filterCategoryBits: 0x0002, // Категория для Bull
                filterMaskBits: 0xFFFF,    // Взаимодействуем со ВСЕМИ объектами
                isSensor: true, // Делаем сенсором, чтобы проходить сквозь объекты, но получать контакты
              });
              
              // Устанавливаем дополнительные данные для однозначной идентификации
              const userData = currentBallRef.current.body.getUserData() as PhysicsUserData || {};
              userData.isBall = true;
              userData.type = 'ball';
              userData.specialType = 'Bull';
              userData.createdAt = Date.now();
              currentBallRef.current.body.setUserData(userData);
              
              // Включаем bullet для более точной проверки столкновений
              currentBallRef.current.body.setBullet(true);
              
              console.log('Физические свойства для Bull успешно настроены');
            } else {
              console.log('У шара Bull нет фикстур для изменения');
            }
          } catch (error) {
            console.error('Ошибка при настройке физических свойств для Bull:', error);
          }
        }
        
        // Создаем новую пунктирную линию
        if (currentBallRef.current && currentBallRef.current.sprite) {
          createTrajectoryLine(
            scene, 
            trajectoryLineRef,
            currentBallRef.current.sprite.container.x, 
            currentBallRef.current.sprite.container.y
          );
        }
      } catch (error) {
        console.error('Ошибка при создании специального шара:', error);
        
        // Показываем уведомление об ошибке
        if (gameInstanceRef.current && gameInstanceRef.current.scene && gameInstanceRef.current.scene.scenes[0]) {
          const scene = gameInstanceRef.current.scene.scenes[0];
          const errorText = scene.add.text(
            scene.cameras.main.width / 2,
            scene.cameras.main.height / 2,
            'Ошибка при создании шара',
            { 
              fontFamily: 'Arial', 
              fontSize: '18px', 
              color: '#ff0000',
              stroke: '#000000',
              strokeThickness: 3,
              align: 'center'
            }
          ).setOrigin(0.5);
          
          scene.tweens.add({
            targets: errorText,
            alpha: 0,
            y: scene.cameras.main.height / 2 - 40,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
              errorText.destroy();
            }
          });
        }
      }
    } else {
      console.log('Невозможно создать специальный шар: currentBallRef.current или gameInstanceRef.current не существует');
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
  
  // Функция для создания специального шара типа "Bull"
  const handleBullBall = () => {
    console.log('handleBullBall вызван, проверяем условия...');
    // Проверяем, можем ли мы использовать эту возможность (хватает ли ресурсов)
    if (canUseSpecialFeature('Bull') && !bullUsed) {
      console.log('Условия для Bull выполнены, списываем стоимость и создаем шар Bull');
      // Списываем стоимость
      deductResourceCost('Bull');
      // Меняем тип шара на Bull
      changeSpecialBall('Bull');
      // Устанавливаем специальный тип шара
      setSpecialBallType('Bull');
      
      // Добавим проверку и логирование для текущего шара
      if (currentBallRef.current) {
        console.log('Шар Bull создан и готов к броску:', {
          специальныйТип: currentBallRef.current.specialType,
          уровень: currentBallRef.current.level
        });
      } else {
        console.error('Ошибка: currentBallRef.current is null после создания шара Bull');
      }
    } else if (bullUsed) {
      console.log('Bull уже использован, показываем уведомление о перезарядке');
      // Показываем уведомление, что Bull уже использован
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
    }
  };
  
  // Функция для создания специального шара типа "Bomb"
  const handleBombBall = () => {
    console.log('handleBombBall вызван, проверяем условия...');
    // Проверяем, можем ли мы использовать эту возможность (хватает ли ресурсов)
    if (canUseSpecialFeature('Bomb')) {
      console.log('Условия для Bomb выполнены, списываем стоимость и создаем шар Bomb');
      // Списываем стоимость
      deductResourceCost('Bomb');
      // Меняем тип шара на Bomb
      changeSpecialBall('Bomb');
      // Устанавливаем специальный тип шара
      setSpecialBallType('Bomb');
      
      // Добавим проверку и логирование для текущего шара
      if (currentBallRef.current) {
        console.log('Шар Bomb создан и готов к броску:', {
          специальныйТип: currentBallRef.current.specialType,
          уровень: currentBallRef.current.level
        });
      } else {
        console.error('Ошибка: currentBallRef.current is null после создания шара Bomb');
      }
    }
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
    // Рассчитываем стоимость для каждой способности
    const bullCost = (specialCosts.Bull / 100) * containerCapacity;
    const bombCost = (specialCosts.Bomb / 100) * containerCapacity;
    const joyCost = (specialCosts.Joy / 100) * containerCapacity;
    
    // Проверяем, достаточно ли ресурсов для каждой способности
    const canUseBull = snotCoins >= bullCost && !bullUsed;
    const canUseBomb = snotCoins >= bombCost;
    const canUseJoy = snotCoins >= joyCost;
    
    return (
      <div className="absolute bottom-0 left-0 right-0 flex justify-center items-center space-x-4 p-2 bg-black/30 backdrop-blur-sm">
        {/* Кнопка Bull */}
        <button
          onClick={onBullClick}
          disabled={!canUseBull || bullUsed}
          className={`relative flex flex-col items-center justify-center px-4 py-2 rounded-lg 
            ${canUseBull ? 'bg-red-700 hover:bg-red-600' : 'bg-red-900 opacity-50'} 
            transition-all duration-300`}
        >
          <div className="text-xs text-white font-bold">Bull</div>
          <div className="text-[10px] text-yellow-300">{formatSnotValue(bullCost, 1)} SC</div>
          {bullUsed && <div className="absolute inset-0 bg-gray-800/70 flex items-center justify-center rounded-lg">
            <div className="text-xs text-white font-bold">Перезарядка</div>
          </div>}
        </button>
        
        {/* Кнопка Bomb */}
        <button
          onClick={onBombClick}
          disabled={!canUseBomb}
          className={`relative flex flex-col items-center justify-center px-4 py-2 rounded-lg 
            ${canUseBomb ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-900 opacity-50'} 
            transition-all duration-300`}
        >
          <div className="text-xs text-white font-bold">Bomb</div>
          <div className="text-[10px] text-yellow-300">{formatSnotValue(bombCost, 1)} SC</div>
        </button>
        
        {/* Кнопка Joy */}
        <button
          onClick={onJoyClick}
          disabled={!canUseJoy}
          className={`relative flex flex-col items-center justify-center px-4 py-2 rounded-lg 
            ${canUseJoy ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-900 opacity-50'} 
            transition-all duration-300`}
        >
          <div className="text-xs text-white font-bold">Joy</div>
          <div className="text-[10px] text-yellow-300">{formatSnotValue(joyCost, 1)} SC</div>
        </button>
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
  
  // Модифицируем обработчик закрытия игры, чтобы при выходе переходить на вкладку Merge
  const handleGameClose = () => {
    // Логируем закрытие игры для отладки
    console.log("Закрытие игры MergeGameClient");
    
    // Сначала очищаем все ресурсы
    cleanupResources();
    
    // Делаем паузу, чтобы убедиться, что игра остановлена
    setIsPaused(true);
    
    // Явно уничтожаем экземпляр игры Phaser
    if (gameInstanceRef.current) {
      try {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
      } catch (error) {
        console.error('Ошибка при уничтожении Phaser игры:', error);
      }
    }
    
    // Устанавливаем активную вкладку "merge" при выходе из игры
    try {
      dispatch({
        type: 'SET_ACTIVE_TAB',
        payload: 'merge'
      });
      console.log("Успешно установлена активная вкладка 'merge'");
    } catch (error) {
      console.error("Ошибка при установке активной вкладки:", error);
    }
    
    // Небольшая задержка перед закрытием для завершения очистки ресурсов
    setTimeout(() => {
      // Вызываем обработчик onClose из props
      if (typeof onClose === 'function') {
        console.log("Вызываем onClose коллбэк");
        onClose();
      } else {
        console.error("onClose не является функцией:", onClose);
      }
    }, 50);
  };
  
  // Функция для предзагрузки ресурсов игры
  const preloadScene = (scene: any) => {
    try {
      // Загружаем все необходимые текстуры и изображения
      console.log('Загрузка текстур и изображений...');

      // Загружаем изображения шаров разных уровней
      // Добавляем обработку ошибок загрузки для каждого изображения
      // Шары уровней от 1 до 11 и 12 используют свои изображения
      for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
        scene.load.image(`${level}`, `/images/merge/Balls/${level}.webp`);
      }

      // Загружаем изображение для Bull шара
      scene.load.image('bull-ball', '/images/merge/Balls/bull.webp');
      
      // Загружаем изображение для Bomb шара
      scene.load.image('bomb-ball', '/images/merge/Balls/bomb.webp');

      // Загружаем частицы для эффектов
      scene.load.image('particle', '/images/merge/Balls/particle.webp');

      // Создаем событие для обработки ошибок загрузки
      scene.load.on('loaderror', (fileObj: any) => {
        console.warn(`Ошибка загрузки файла: ${fileObj.src}`);
        
        // Если ошибка связана с изображением шара, создаем и используем fallback текстуру
        if (fileObj.key && !isNaN(parseInt(fileObj.key))) {
          const level = parseInt(fileObj.key);
          generateColorTexture(scene, level);
        } else if (fileObj.key === 'bull-ball') {
          generateColorTexture(scene, 'bull');
        } else if (fileObj.key === 'bomb-ball') {
          generateColorTexture(scene, 'bomb');
        } else if (fileObj.key === 'particle') {
          generateColorTexture(scene, 'particle');
        }
      });
    } catch (error) {
      console.error('Ошибка в preloadScene:', error);
    }
  };

  // Функция для генерации текстуры-заглушки при ошибке загрузки
  const generateColorTexture = (scene: any, key: number | string) => {
    try {
      const size = 128; // Размер текстуры
      const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
      let color = 0xffffff; // Цвет по умолчанию - белый
      let textureKey = "fallback";
      
      if (typeof key === 'string') {
        // Для строковых ключей
        textureKey = key;
        if (key === 'bull') {
          color = BULL_COLOR; // Используем константу для Bull
        } else if (key === 'bomb') {
          color = BOMB_COLOR; // Используем константу для Bomb
        } else if (key === 'particle') {
          color = 0xffff00; // Желтый для частиц
        }
      } else if (typeof key === 'number') {
        // Для числовых ключей
        textureKey = key.toString();
        
        // Проверяем, что массив цветов существует и не пуст
        if (BALL_COLORS && BALL_COLORS.length > 0) {
          // Определяем индекс цвета, гарантируя, что он находится в пределах массива
          let index = 0; // По умолчанию используем первый цвет
          
          // Безопасно определяем значение уровня
          const safeLevel: number = key || 1;
          
          // Определяем индекс с защитой от выхода за границы массива
          if (safeLevel > 0 && safeLevel <= BALL_COLORS.length) {
            index = safeLevel - 1;
          } else if (safeLevel > BALL_COLORS.length) {
            index = BALL_COLORS.length - 1;
          }
          
          // Устанавливаем цвет
          color = BALL_COLORS[index];
        }
      }
      
      // Создаем круглую текстуру с нужным цветом
      graphics.fillStyle(color, 1);
      graphics.fillCircle(size / 2, size / 2, size / 2);
      
      // Для числовых ключей добавляем контур
      if (typeof key === 'number') {
        graphics.lineStyle(2, 0xffffff, 1);
        graphics.strokeCircle(size / 2, size / 2, size / 2 - 1);
      }
      
      // Создаем текстуру из графики
      graphics.generateTexture(textureKey, size, size);
      
      console.log(`Создана fallback текстура для: ${key}`);
    } catch (error) {
      console.error('Ошибка при создании fallback текстуры:', error);
    }
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
              onBullClick={handleBullBall}
              onBombClick={handleBombBall}
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
          onClose={handleGameClose}
        />
      )}
    </div>
  );
};

export default MergeGameClient;