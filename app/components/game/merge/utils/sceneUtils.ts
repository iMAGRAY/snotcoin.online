'use client'

import { generateColorTexture } from './textureUtils';
import { BASE_GAME_WIDTH, BASE_BALL_SIZE, PLAYER_SIZE, GAME_ASPECT_RATIO, HEADER_HEIGHT, HEADER_HEIGHT_MOBILE, FOOTER_HEIGHT, FOOTER_HEIGHT_MOBILE, FIXED_PLAYER_Y } from '../constants/gameConstants';
import { getBallSize } from './ballUtils';
import * as planck from 'planck';
import { ExtendedBall, ExtendedNextBall } from '../types';
import { updateBallsOnResize } from './ballUtils';

/**
 * Функция для предзагрузки ресурсов игры
 * @param scene Сцена Phaser
 */
export const preloadScene = (scene: any) => {
  try {
    // Загружаем все необходимые текстуры и изображения
    // Загружаем изображения шаров разных уровней
    // Добавляем обработку ошибок загрузки для каждого изображения
    // Шары уровней от 1 до 11 и 12 используют свои изображения
    for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      scene.load.image(`${level}`, `/images/merge/balls/${level}.webp`);
    }

    // Загружаем изображение для Bull шара
    scene.load.image('bull-ball', '/images/merge/balls/bull.webp');
    
    // Загружаем изображение для Bomb шара
    scene.load.image('bomb-ball', '/images/merge/balls/bomb.webp');

    // Загружаем частицы для эффектов
    scene.load.image('particle', '/images/merge/balls/particle.webp');
    
    // Загружаем фоновые изображения
    scene.load.image('trees', '/images/merge/game/ui/trees.webp');
    scene.load.image('floor', '/images/merge/game/ui/floor.webp');
    scene.load.image('background', '/images/merge/game/BackGround.webp');

    // Создаем событие для обработки ошибок загрузки
    scene.load.on('loaderror', (fileObj: any) => {
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
    console.error('Ошибка при предзагрузке ресурсов:', error);
  }
};

// Загружает текстуры для шаров разных уровней
export const loadBallTextures = (scene: Phaser.Scene, maxLevel: number): void => {
  try {
    // Загружаем текстуры для обычных шаров всех уровней
    for (let i = 1; i <= maxLevel; i++) {
      const textureKey = i.toString();
      
      // Формируем путь к текстуре
      const texturePath = `/images/balls/level${i}.png`;
      
      // Загружаем текстуру в сцену
      scene.load.image(textureKey, texturePath);
    }
    
    // Загружаем текстуры для специальных шаров
    
    // Бомба
    scene.load.image('bomb', '/images/balls/bomb.png');
    
    // Бык
    scene.load.image('bull', '/images/balls/bull.png');
    
    // Текстуры загружены успешно
  } catch (error) {
    // Ошибка при загрузке текстур шаров
  }
};

// Реэкспортируем функции связанные с сценой из разных модулей
export { createTrajectoryLine, updateTrajectoryLine } from '../physics/trajectoryLine';

/**
 * Обработчик изменения размера окна
 */
export const handleResize = (
  containerRef: React.RefObject<HTMLDivElement>,
  game: any,
  worldRef: React.MutableRefObject<planck.World | null>,
  physicsRefs: any,
  ballsRef: React.MutableRefObject<ExtendedBall[]>,
  currentBallRef: React.MutableRefObject<ExtendedNextBall | null>,
  updateUI?: () => void
) => {
  // Проверяем, инициализирован ли контейнер и объект игры
  if (!containerRef.current || !game) return;

  // Получаем текущие размеры контейнера (родителя)
  const parentWidth = containerRef.current.offsetWidth;
  const parentHeight = containerRef.current.offsetHeight;

  // Обязательно учитываем высоту верхнего и нижнего бара
  const headerHeight = window.innerWidth <= 768 ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT;
  const footerHeight = window.innerWidth <= 768 ? FOOTER_HEIGHT_MOBILE : FOOTER_HEIGHT;
  
  // Высота игрового поля - это высота контейнера минус высота верхнего и нижнего бара
  const availableHeight = parentHeight - headerHeight - footerHeight;
  
  // Применяем соотношение сторон для расчета ширины
  // Поле должно быть выше, чем шире (соотношение 2:2.67)
  let newWidth = availableHeight * GAME_ASPECT_RATIO;
  let newHeight = availableHeight;
  
  // Проверяем, что ширина не превышает доступную ширину
  if (newWidth > parentWidth) {
    newWidth = parentWidth;
    newHeight = newWidth / GAME_ASPECT_RATIO;
  }
  
  // Логгируем информацию о размерах для диагностики
  console.log(`Изменение размера игры: с ${game.scale.width}x${game.scale.height} на ${newWidth}x${newHeight}`);
  
  // Обновляем размер игры
  game.scale.resize(newWidth, newHeight);
  
  // Обновляем физические границы игрового поля
  if (worldRef.current) {
    // Получаем метод createWalls из физических референсов
    // Метод createWalls доступен из physicsRefs, который передается в компонент
    if (typeof physicsRefs?.createWalls === 'function') {
      console.log(`Обновление физических границ игры: ${newWidth}x${newHeight}`);
      physicsRefs.createWalls(newWidth, newHeight);
    }
  }
  
  // Обновляем визуальные элементы игровой сцены
  if (game.scene && game.scene.scenes && game.scene.scenes[0]) {
    const mainScene = game.scene.scenes[0];
    // Используем новую функцию для обновления элементов сцены
    updateSceneElements(mainScene, newWidth, newHeight);
  }
  
  // Обновляем шары после изменения размера игры
  if (ballsRef.current && currentBallRef.current && worldRef.current) {
    const oldWidth = game.scale.width || BASE_GAME_WIDTH;
    
    console.log(`Вызов updateBallsOnResize: oldWidth=${oldWidth}, newWidth=${newWidth}`);
    
    // Обновляем шары с учетом нового размера
    updateBallsOnResize(
      ballsRef, 
      currentBallRef, 
      worldRef, 
      newWidth, 
      oldWidth
    );
  }
  
  // Дополнительно обновляем пользовательский интерфейс
  if (typeof updateUI === 'function') {
    updateUI();
  }
};

/**
 * Обновляет элементы сцены при изменении размера окна
 * 
 * @param scene Сцена Phaser
 * @param gameWidth Новая ширина игры
 * @param gameHeight Новая высота игры
 */
export const updateSceneElements = (
  scene: any,
  gameWidth: number,
  gameHeight: number
) => {
  if (!scene || !scene.children || !scene.children.list) {
    return;
  }

  console.log(`Обновление элементов сцены: ${gameWidth}x${gameHeight}`);
  
  // Рассчитываем масштаб относительно базового размера
  const scaleX = gameWidth / BASE_GAME_WIDTH;
  const scaleY = gameHeight / (BASE_GAME_WIDTH * 1.335); // Используем базовое соотношение сторон 2:2.67
  
  // Обновляем масштаб камеры, если это возможно
  if (scene.cameras && scene.cameras.main) {
    scene.cameras.main.setZoom(1); // Сбрасываем зум к 1, чтобы избежать кумулятивного эффекта
  }
  
  // Обновляем фон с деревьями
  const treesImage = scene.children.list.find((child: any) => 
    child.texture && child.texture.key === 'trees'
  );
  if (treesImage) {
    treesImage.setPosition(gameWidth / 2, 0);
    // Используем setDisplaySize для сохранения пропорций
    treesImage.setDisplaySize(gameWidth, gameHeight);
    // Устанавливаем origin для правильного позиционирования
    treesImage.setOrigin(0.5, 0);
    // Устанавливаем низкий z-index, чтобы деревья были позади всех игровых элементов,
    // но впереди основного фона
    treesImage.setDepth(-10);
  }
  
  // Обновляем пол
  const floorImage = scene.children.list.find((child: any) => 
    child.texture && child.texture.key === 'floor'
  );
  if (floorImage) {
    const floorHeight = 30 * scaleY; // Масштабируем высоту пола
    floorImage.setPosition(gameWidth / 2, gameHeight - floorHeight / 2);
    floorImage.setDisplaySize(gameWidth, floorHeight);
    floorImage.setOrigin(0.5, 0.5);
  }
  
  // Обновляем позицию игрока
  const playerSprite = scene.children.list.find((child: any) => 
    child.type === 'Arc' && child.fillColor === 0x00ff00
  );
  if (playerSprite) {
    // Сохраняем позицию Y игрока (FIXED_PLAYER_Y) при обновлении позиции X
    playerSprite.setPosition(gameWidth / 2, playerSprite.y);
    // Масштабируем размер игрока
    const playerSize = PLAYER_SIZE * scaleX;
    if (playerSprite.setRadius) {
      playerSprite.setRadius(playerSize);
    }
  }
  
  // Обновляем текст инструкций
  const instructionsText = scene.children.list.find((child: any) => 
    child.type === 'Text' && 
    child.text && 
    typeof child.text === 'string' && 
    child.text.includes('Наведите')
  );
  if (instructionsText) {
    instructionsText.setPosition(gameWidth / 2, 64 * scaleY);
    // Обновляем размер шрифта в зависимости от масштаба
    const fontSize = Math.max(16 * scaleX, 10);
    instructionsText.setFontSize(`${fontSize}px`);
    instructionsText.setOrigin(0.5, 0.5);
  }
  
  // Обновляем оверлей замерзания, если он есть
  const freezeOverlay = scene.children.list.find((child: any) => 
    child.type === 'Rectangle' && 
    child.fillColor === 0x0088ff
  );
  if (freezeOverlay) {
    freezeOverlay.setPosition(gameWidth / 2, gameHeight / 2);
    freezeOverlay.setSize(gameWidth, gameHeight);
  }
  
  // Обновляем текст замерзки, если он есть
  const freezeText = scene.children.list.find((child: any) => 
    child.type === 'Text' && 
    child.text && 
    typeof child.text === 'string' && 
    child.text.includes('ЗАМОРОЗКА')
  );
  if (freezeText) {
    freezeText.setPosition(gameWidth / 2, 80 * scaleY);
    // Обновляем размер шрифта в зависимости от масштаба
    const fontSize = Math.max(20 * scaleX, 12);
    freezeText.setFontSize(`${fontSize}px`);
  }
  
  // Обновляем линию траектории, если она есть
  const trajectoryLine = scene.children.list.find((child: any) => 
    child.type === 'Graphics' && child._lineStyle && child._lineStyle.width
  );
  if (trajectoryLine) {
    // Обновляем толщину линии
    const lineWidth = Math.max(2 * scaleX, 1);
    trajectoryLine.lineStyle(lineWidth, trajectoryLine._lineStyle.color, trajectoryLine._lineStyle.alpha);
    // Перерисовываем линию, если доступен метод
    if (trajectoryLine.redraw) {
      trajectoryLine.redraw();
    }
  }
  
  // Масштабируем все частицы и эффекты, если они есть
  const particles = scene.children.list.filter((child: any) => 
    child.type === 'ParticleEmitter' || child.type === 'Particles'
  );
  particles.forEach((particle: any) => {
    if (particle.setScale) {
      particle.setScale(scaleX, scaleY);
    }
  });

  // Обновляем основной фон игры, если он есть
  const backgroundImage = scene.children.list.find((child: any) => 
    child.texture && child.texture.key === 'background'
  );
  if (backgroundImage) {
    backgroundImage.setPosition(gameWidth / 2, gameHeight / 2);
    backgroundImage.setDisplaySize(gameWidth, gameHeight);
    backgroundImage.setOrigin(0.5, 0.5);
    // Устанавливаем самый низкий z-index для основного фона
    backgroundImage.setDepth(-20);
  }
}; 