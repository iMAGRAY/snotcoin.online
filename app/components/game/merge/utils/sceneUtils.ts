'use client'

import { generateColorTexture } from './textureUtils';
import { BASE_GAME_WIDTH, BASE_BALL_SIZE, PLAYER_SIZE } from '../constants/gameConstants';
import { getBallSize } from './ballUtils';

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
    // Ошибка в preloadScene:
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
 * Обновляет элементы сцены при изменении размера окна
 * 
 * @param scene Сцена Phaser
 * @param gameWidth Новая ширина игры
 * @param gameHeight Новая высота игры
 * @param baseScaleFactor Коэффициент масштабирования относительно базовой ширины
 */
export const updateSceneElements = (
  scene: any,
  gameWidth: number,
  gameHeight: number,
  baseScaleFactor?: number
) => {
  if (!scene || !scene.children || !scene.children.list) {
    return;
  }

  // Если baseScaleFactor не передан, вычисляем его
  const scaleFactor = baseScaleFactor || (gameWidth / BASE_GAME_WIDTH);
  console.log(`Обновление элементов сцены: ${gameWidth}x${gameHeight}, scaleFactor=${scaleFactor.toFixed(3)}`);
  
  // Рассчитываем относительные размеры элементов
  const relativeFloorHeight = Math.round(30 * scaleFactor); // 30px базовая высота пола
  const relativeInstructionsY = Math.round(64 * scaleFactor); // 64px базовая позиция инструкций
  const relativeFreezeTextY = Math.round(80 * scaleFactor); // 80px базовая позиция текста заморозки
  
  // Обновляем фон с деревьями
  const treesImage = scene.children.list.find((child: any) => 
    child.texture && child.texture.key === 'trees'
  );
  if (treesImage) {
    treesImage.setPosition(gameWidth / 2, 0);
    treesImage.setDisplaySize(gameWidth, gameHeight);
    treesImage.setOrigin(0.5, 0);
  }
  
  // Обновляем пол
  const floorImage = scene.children.list.find((child: any) => 
    child.texture && child.texture.key === 'floor'
  );
  if (floorImage) {
    floorImage.setPosition(gameWidth / 2, gameHeight - relativeFloorHeight / 2);
    floorImage.setDisplaySize(gameWidth, relativeFloorHeight);
    floorImage.setOrigin(0.5, 0.5);
  }
  
  // Обновляем позицию игрока
  const playerSprite = scene.children.list.find((child: any) => 
    child.type === 'Arc' && child.fillColor === 0x00ff00
  );
  if (playerSprite) {
    // Только центрируем игрока по горизонтали, сохраняя Y-координату
    playerSprite.setPosition(gameWidth / 2, playerSprite.y);
    // Масштабируем размер игрока
    const playerSize = Math.round(PLAYER_SIZE * scaleFactor);
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
    instructionsText.setPosition(gameWidth / 2, relativeInstructionsY);
    // Обновляем размер шрифта в зависимости от масштаба
    const fontSize = Math.max(16 * scaleFactor, 10);
    instructionsText.setFontSize(`${fontSize}px`);
    instructionsText.setOrigin(0.5, 0.5);
    // Обновляем толщину обводки
    if (instructionsText.style && instructionsText.style.strokeThickness) {
      instructionsText.style.strokeThickness = Math.max(3 * scaleFactor, 1);
    }
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
    freezeText.setPosition(gameWidth / 2, relativeFreezeTextY);
    // Обновляем размер шрифта в зависимости от масштаба
    const fontSize = Math.max(20 * scaleFactor, 12);
    freezeText.setFontSize(`${fontSize}px`);
    // Обновляем толщину обводки
    if (freezeText.style && freezeText.style.strokeThickness) {
      freezeText.style.strokeThickness = Math.max(4 * scaleFactor, 2);
    }
  }
  
  // Обновляем линию траектории, если она есть
  const trajectoryLine = scene.children.list.find((child: any) => 
    child.type === 'Graphics' && child._lineStyle && child._lineStyle.width
  );
  if (trajectoryLine) {
    // Обновляем толщину линии
    const lineWidth = Math.max(2 * scaleFactor, 1);
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
      particle.setScale(scaleFactor, scaleFactor);
    }
  });
  
  // Обновляем все контейнеры шаров
  const containers = scene.children.list.filter((child: any) => 
    child.type === 'Container' && !child.destroyed
  );
  
  containers.forEach((container: any) => {
    // Проверяем, что это контейнер шара
    const circle = container.list?.find((item: any) => 
      item.type === 'Image' || item.type === 'Sprite' || item.type === 'Arc'
    );
    
    if (circle) {
      // Обновляем масштаб шара, если это возможно
      const level = container.userData?.level || 1;
      
      // Получаем новый относительный размер для шара
      const ballSize = getBallSize(level, gameWidth);
      
      // Применяем масштабирование ко всему контейнеру
      if (container.setScale) {
        // Используем единый коэффициент масштабирования
        const containerScale = ballSize / (BASE_BALL_SIZE + (level - 1) * 5);
        container.setScale(containerScale);
      }
      
      // Обновляем любой текст внутри контейнера
      const textElement = container.list?.find((item: any) => item.type === 'Text');
      if (textElement) {
        // Масштабируем текст пропорционально с учетом уровня шара
        const fontSize = Math.max(Math.min(16, 12 + level) * scaleFactor, 10);
        textElement.setFontSize(`${fontSize}px`);
        textElement.setOrigin(0.5, 0.5);
      }
    }
  });
}; 