'use client'

import { generateColorTexture } from './textureUtils';

/**
 * Функция для предзагрузки ресурсов игры
 * @param scene Сцена Phaser
 */
export const preloadScene = (scene: any) => {
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

// Реэкспортируем функции связанные с сценой из разных модулей
export { createTrajectoryLine, updateTrajectoryLine } from '../physics/trajectoryLine'; 