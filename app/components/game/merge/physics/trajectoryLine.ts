import { TrajectoryRef } from '../types';

// Функция для создания пунктирной линии, показывающей траекторию
export const createTrajectoryLine = (
  scene: any,
  trajectoryLineRef: React.MutableRefObject<TrajectoryRef | null>,
  x: number,
  y: number
) => {
  try {
    // Проверяем, инициализирована ли игра
    if (!scene) return;
    
    // Сначала удаляем старую линию, если она существует
    if (trajectoryLineRef.current) {
      trajectoryLineRef.current.destroy();
      trajectoryLineRef.current = null;
    }
    
    // Получаем высоту игровой области
    const gameHeight = scene.sys.game.config.height;
    
    // Создаем графический объект для пунктирной линии
    const graphics = scene.add.graphics();
    graphics.lineStyle(2, 0xffffff, 0.5); // Белая полупрозрачная линия
    
    // Рисуем пунктирную линию от шара до пола
    graphics.beginPath();
    
    // Начальная точка - позиция шара
    graphics.moveTo(x, y); // Начинаем от центра шара
    
    // Конечная точка - пол (с небольшим отступом)
    graphics.lineTo(x, gameHeight - 32); // 32 - высота пола
    
    // Завершаем рисование линии
    graphics.strokePath();
    
    // Делаем линию пунктирной с помощью маски
    const mask = scene.add.graphics();
    mask.fillStyle(0xffffff);
    
    // Создаем пунктирный эффект, рисуя небольшие прямоугольники вдоль линии
    const lineLength = gameHeight - y - 32;
    const segmentLength = 5; // Длина сегмента пунктира
    const gap = 5; // Длина пробела между сегментами
    
    // Рисуем сегменты только в видимой области - оптимизация
    let i = 0;
    while (i < lineLength && i < 1000) { // Ограничиваем количество сегментов для безопасности
      mask.fillRect(x - 1, y + i, 2, segmentLength);
      i += segmentLength + gap;
    }
    
    // Применяем маску к линии
    graphics.setMask(new Phaser.Display.Masks.GeometryMask(scene, mask));
    
    // Устанавливаем высокую глубину отображения
    graphics.setDepth(20);
    
    // Сохраняем ссылку на линию для последующего обновления
    trajectoryLineRef.current = {
      destroy: () => {
        if (graphics && !graphics.destroyed) {
          graphics.destroy();
        }
        if (mask && !mask.destroyed) {
          mask.destroy();
        }
      }
    };
  } catch (error) {
    console.error('Ошибка при создании пунктирной линии:', error);
  }
};

// Функция для обновления положения пунктирной линии
export const updateTrajectoryLine = (
  scene: any,
  trajectoryLineRef: React.MutableRefObject<TrajectoryRef | null>,
  x: number,
  y: number,
  isPaused: boolean
) => {
  try {
    // Проверяем, инициализирована ли игра и не находится ли она в паузе
    if (!scene || isPaused) return;
    
    // Просто пересоздаем линию в новой позиции - более эффективно для этого случая
    createTrajectoryLine(scene, trajectoryLineRef, x, y);
  } catch (error) {
    console.error('Ошибка при обновлении пунктирной линии:', error);
  }
}; 