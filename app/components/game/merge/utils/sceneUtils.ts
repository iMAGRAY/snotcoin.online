'use client'

import { generateColorTexture } from './textureUtils';

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