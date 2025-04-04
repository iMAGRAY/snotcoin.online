'use client'

import planck from 'planck';
import { PhaserType, ExtendedBall, NextBall } from '../types/index';
import { createTrajectoryLine, updateTrajectoryLine } from '../utils/sceneUtils';
import { BASE_GAME_WIDTH } from '../constants/gameConstants';

// Типы для параметров сцены
export interface SceneRefs {
  ballsRef: React.MutableRefObject<ExtendedBall[]>;
  worldRef: React.MutableRefObject<planck.World | null>;
  currentBallRef: React.MutableRefObject<NextBall | null>;
  floorRef: React.MutableRefObject<planck.Body | null>;
  leftWallRef: React.MutableRefObject<planck.Body | null>;
  rightWallRef: React.MutableRefObject<planck.Body | null>;
  topWallRef: React.MutableRefObject<planck.Body | null>;
  playerBodyRef: React.MutableRefObject<planck.Body | null>;
  trajectoryLineRef: React.MutableRefObject<any>;
  isFreezeModeActive: React.MutableRefObject<boolean>;
  gameStateRef: React.MutableRefObject<{
    isPaused: boolean;
    isGameOver: boolean;
  }>;
}

/**
 * Предзагрузка ресурсов для сцены
 * @param scene Сцена Phaser
 */
export const preloadScene = (scene: any) => {
  // Загружаем текстуры - используем пути с единообразным регистром
  // Используем lowercase для директорий, чтобы избежать проблем с регистром
  scene.load.image('trees', '/images/merge/game/ui/trees.webp');
  scene.load.image('floor', '/images/merge/game/ui/floor.webp');
  scene.load.image('ball1', '/images/merge/balls/1.webp');
  scene.load.image('ball2', '/images/merge/balls/2.webp');
  scene.load.image('ball3', '/images/merge/balls/3.webp');
  scene.load.image('ball4', '/images/merge/balls/4.webp');
  scene.load.image('ball5', '/images/merge/balls/5.webp');
  scene.load.image('ball6', '/images/merge/balls/6.webp');
  scene.load.image('ball7', '/images/merge/balls/7.webp');
  scene.load.image('ball8', '/images/merge/balls/8.webp');
  scene.load.image('ball9', '/images/merge/balls/9.webp');
  scene.load.image('ball10', '/images/merge/balls/10.webp');
  scene.load.image('ball11', '/images/merge/balls/11.webp');
  scene.load.image('ball12', '/images/merge/balls/12.webp');
  
  // Специальные шары
  scene.load.image('bull', '/images/merge/balls/bull.webp');
  scene.load.image('bomb', '/images/merge/balls/bomb.webp');
  
  // Добавляем явную загрузку фона игры
  scene.load.image('background', '/images/merge/game/BackGround.webp');
};

/**
 * Создает сцену для игры
 * @param scene Сцена Phaser
 * @param Phaser Объект Phaser
 * @param gameWidth Ширина игры
 * @param gameHeight Высота игры
 * @param sceneRefs Ссылки на объекты сцены
 * @param FIXED_PLAYER_Y Константа Y-координаты игрока
 * @param PLAYER_SIZE Размер игрока
 * @param onSetPlayerSprite Callback для установки спрайта игрока
 */
export const createScene = (
  scene: any,
  Phaser: PhaserType,
  gameWidth: number,
  gameHeight: number,
  sceneRefs: SceneRefs,
  FIXED_PLAYER_Y: number,
  PLAYER_SIZE: number,
  onSetPlayerSprite: (sprite: any) => void
) => {
  // Получаем ссылки на объекты
  const { 
    trajectoryLineRef, 
    currentBallRef, 
    isFreezeModeActive, 
    gameStateRef 
  } = sceneRefs;
  
  // Рассчитываем масштаб относительно базового размера
  const scaleX = gameWidth / BASE_GAME_WIDTH;
  const scaleY = gameHeight / (BASE_GAME_WIDTH * 1.335); // Соотношение сторон 2:2.67
  
  console.log(`Создание сцены с масштабом: scaleX=${scaleX}, scaleY=${scaleY}`);
  
  // Рассчитываем относительные размеры элементов
  const relativePlayerSize = PLAYER_SIZE * scaleX;
  const relativeFloorHeight = Math.round(30 * scaleY); // 30px базовая высота пола
  const relativeInstructionsY = Math.round(64 * scaleY); // 64px базовая позиция инструкций
  const relativeFreezeTextY = Math.round(80 * scaleY); // 80px базовая позиция текста заморозки
  
  // Добавляем основной фон игры (задний план)
  const bgImage = scene.add.image(gameWidth / 2, gameHeight / 2, 'background');
  bgImage.setOrigin(0.5, 0.5);
  bgImage.setDisplaySize(gameWidth, gameHeight);
  bgImage.setDepth(-20); // Самый нижний слой
  
  // Добавляем фон с деревьями (средний план)
  const treesImage = scene.add.image(gameWidth / 2, 0, 'trees');
  treesImage.setOrigin(0.5, 0);
  treesImage.setDisplaySize(gameWidth, gameHeight);
  treesImage.setDepth(-10); // Выше основного фона, но ниже игровых элементов
  
  // Добавляем пол - его высота пропорциональна размеру игры
  const floorImage = scene.add.image(gameWidth / 2, gameHeight - relativeFloorHeight / 2, 'floor');
  floorImage.setDisplaySize(gameWidth, relativeFloorHeight);
  floorImage.setOrigin(0.5, 0.5);
  
  // Добавляем инструкции для игрока с масштабируемым шрифтом
  const fontSize = Math.max(16 * scaleX, 10); // Минимальный размер шрифта 10px
  const instructions = scene.add.text(
    gameWidth / 2, 
    relativeInstructionsY,
    "Наведите и нажмите, чтобы бросить",
    { 
      fontFamily: 'Arial', 
      fontSize: `${fontSize}px`, 
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: Math.max(3 * scaleX, 1),
      align: 'center'
    }
  );
  instructions.setOrigin(0.5, 0.5);
  
  // Создаем игрока (круг в нижней части экрана)
  // Размер также должен быть пропорционален размеру игровой зоны
  const playerSprite = scene.add.circle(gameWidth / 2, FIXED_PLAYER_Y, relativePlayerSize, 0x00ff00);
  onSetPlayerSprite(playerSprite);
  
  // Создаем пунктирную линию траектории с учетом масштаба
  createTrajectoryLine(
    scene, 
    trajectoryLineRef, 
    gameWidth / 2, 
    FIXED_PLAYER_Y,
    scaleX // Передаем масштаб для правильной толщины линии
  );
  
  // Скрываем линию траектории если игра на паузе
  if (gameStateRef.current.isPaused) {
    if (trajectoryLineRef.current) {
      trajectoryLineRef.current.visible = false;
    }
  }
  
  // Добавляем обработку ввода для обновления траектории
  scene.input.on('pointermove', (pointer: any) => {
    // Пропускаем обработку, если игра на паузе или окончена
    if (gameStateRef.current.isPaused || gameStateRef.current.isGameOver) return;
    
    // Обновляем линию в зависимости от положения указателя
    if (trajectoryLineRef.current) {
      updateTrajectoryLine(
        scene, 
        trajectoryLineRef, 
        pointer.x, 
        FIXED_PLAYER_Y,
        gameStateRef.current.isPaused,
        scaleX // Передаем масштаб для корректного обновления
      );
    }
  });
  
  // Если активен режим заморозки, добавляем визуальный эффект
  if (isFreezeModeActive.current) {
    // Создаем синюю полупрозрачную накладку
    const freezeOverlay = scene.add.rectangle(
      gameWidth / 2,
      gameHeight / 2,
      gameWidth,
      gameHeight,
      0x0088ff,
      0.2
    );
    
    // Добавляем текст об активации заморозки с масштабированием
    const freezeFontSize = Math.max(20 * scaleX, 12);
    const freezeText = scene.add.text(
      gameWidth / 2,
      relativeFreezeTextY,
      "ЗАМОРОЗКА АКТИВНА",
      {
        fontFamily: 'Arial',
        fontSize: `${freezeFontSize}px`,
        color: '#ffffff',
        stroke: '#0088ff',
        strokeThickness: Math.max(4 * scaleX, 2),
        align: 'center'
      }
    );
    freezeText.setOrigin(0.5, 0.5);
    
    // Анимация мерцания текста
    scene.tweens.add({
      targets: freezeText,
      alpha: 0.5,
      duration: 500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
  }
};

/**
 * Обновляет сцену каждый кадр
 * @param sceneRefs Ссылки на объекты сцены
 * @param checkStuckBalls Функция проверки зависших шаров
 */
export const updateScene = (
  sceneRefs: SceneRefs,
  checkStuckBalls: () => void
) => {
  const { worldRef, gameStateRef } = sceneRefs;
  
  // Пропускаем обновление, если игра на паузе или окончена
  if (gameStateRef.current.isPaused || gameStateRef.current.isGameOver) {
    return;
  }
  
  // Обновляем физический мир
  if (worldRef.current) {
    worldRef.current.step(1/60);
  }
  
  // Проверяем зависшие шары
  checkStuckBalls();
}; 