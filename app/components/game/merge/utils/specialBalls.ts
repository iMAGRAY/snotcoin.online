'use client';

import * as planck from 'planck';
import { ExtendedNextBall } from '../types';
import React from 'react';

/**
 * Создает специальный шар выбранного типа
 */
export const createSpecialBall = (
  type: string,
  scene: any,
  currentBallRef: React.MutableRefObject<ExtendedNextBall | null>,
  trajectoryLineRef: React.MutableRefObject<any>,
  dispatch: any
): boolean => {
  try {
    const ballSize = 15;
    const playerX = scene.cameras.main.width / 2;
    const playerY = scene.cameras.main.height * 0.9; // Позиция игрока по Y

    // Создаем контейнер для шара
    const container = scene.add.container(playerX, playerY + 24);
    container.setDepth(30); // Высокий z-index для отображения поверх других элементов

    let specialImage;
    let outline;
    let text;

    // Проверяем существование текстуры
    // Сначала ищем в уже загруженных текстурах
    const textureKey = type.toLowerCase();
    if (scene.textures.exists(textureKey)) {
      // Используем существующую текстуру
      specialImage = scene.add.image(0, 0, textureKey);
      specialImage.setDisplaySize(ballSize * 2.2, ballSize * 2.2);

      // Добавляем свечение
      outline = scene.add.circle(0, 0, ballSize * 1.3, 0xff0000, 0.3);

      // Добавляем в контейнер
      container.add([outline, specialImage]);

      // Анимация пульсации
      scene.tweens.add({
        targets: outline,
        alpha: { from: 0.3, to: 0.7 },
        scale: { from: 1, to: 1.2 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      // Анимация вращения
      scene.tweens.add({
        targets: specialImage,
        angle: '+=10',
        duration: 2000,
        repeat: -1,
        ease: 'Linear'
      });
    } else {
      console.warn(`Текстура ${type} не найдена, пробуем загрузить и использовать fallback вариант`);
      
      // Загружаем текстуру из Balls директории (с правильным регистром)
      if (type === 'Bull') {
        scene.load.image(textureKey, `/images/merge/Balls/bull.webp`);
      } else if (type === 'Bomb') {
        scene.load.image(textureKey, `/images/merge/Balls/bomb.webp`);
      } else {
        // Или используем UI директорию в соответствии с регистром
        scene.load.image(textureKey, `/images/merge/Game/ui/${type.toLowerCase()}.webp`);
      }
      scene.load.start();

      // Если изображение не найдено, создаем круг с текстом
      specialImage = scene.add.circle(0, 0, ballSize, type === 'Bull' ? 0xff0000 : 0x000000);
      outline = scene.add.circle(0, 0, ballSize * 1.2, 0xff0000, 0.3);

      // Добавляем текст
      text = scene.add.text(0, 0, type.toUpperCase(), {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#ffffff'
      }).setOrigin(0.5);

      // Добавляем в контейнер
      container.add([outline, specialImage, text]);
    }

    // Сохраняем созданный шар в currentBallRef
    currentBallRef.current = {
      sprite: {
        container,
        circle: specialImage,
        text: text || undefined
      },
      level: 1,
      specialType: type
    };

    // Обновляем пунктирную линию для нового шара
    if (trajectoryLineRef.current && trajectoryLineRef.current.destroy) {
      trajectoryLineRef.current.destroy();
    }

    // Импортируем функцию создания траектории
    const { createTrajectoryLine } = require('../physics/trajectoryLine');
    createTrajectoryLine(scene, trajectoryLineRef, playerX, playerY + 24);

    dispatch({
      type: 'SHOW_NOTIFICATION',
      payload: {
        message: `${type} активирован! Бросьте чтобы использовать`,
        type: 'success',
        duration: 2000
      }
    });

    return true;
  } catch (error) {
    console.error(`Ошибка при создании ${type} шара:`, error);
    dispatch({
      type: 'SHOW_NOTIFICATION',
      payload: {
        message: `Ошибка при активации ${type}`,
        type: 'error',
        duration: 2000
      }
    });
    return false;
  }
};

/**
 * Функция для изменения типа шара для броска
 */
export const changeSpecialBall = (
  type: string,
  canUseSpecialFeature: (type: string) => boolean,
  deductResourceCost: (type: string) => void,
  setSpecialBallType: React.Dispatch<React.SetStateAction<string | null>>,
  setBullUsed: React.Dispatch<React.SetStateAction<boolean>> | null,
  bullUsed: boolean,
  currentBallRef: React.MutableRefObject<any>,
  gameInstanceRef: React.MutableRefObject<any>,
  trajectoryLineRef: React.MutableRefObject<any>,
  dispatch: any,
  containerCapacity: number,
  specialCosts: Record<string, number>
) => {
  // Проверяем, достаточно ли ресурсов для использования специальной возможности
  if (!canUseSpecialFeature(type)) {
    const cost = specialCosts[type as keyof typeof specialCosts] || 0;
    const actualCost = (cost / 100) * containerCapacity;
    
    dispatch({
      type: 'SHOW_NOTIFICATION',
      payload: {
        message: `Недостаточно SnotCoin для использования ${type}. Требуется ${actualCost.toFixed(2)}`,
        type: 'error',
        duration: 2000
      }
    });
    return false; // Выходим, если ресурсов недостаточно
  }

  // Для шара Bull проверяем, не был ли он уже использован
  if (type === 'Bull' && bullUsed) {
    dispatch({
      type: 'SHOW_NOTIFICATION',
      payload: {
        message: `Шар ${type} уже был использован. Перезарядите способность`,
        type: 'warning',
        duration: 2000
      }
    });

    // Добавляем визуальное уведомление о необходимости перезарядки
    if (gameInstanceRef.current && gameInstanceRef.current.scene && gameInstanceRef.current.scene.scenes[0]) {
      const scene = gameInstanceRef.current.scene.scenes[0];

      // Добавляем текст с предупреждением
      const rechargeText = scene.add.text(
        scene.cameras.main.width / 2,
        scene.cameras.main.height / 2,
        `Перезарядите ${type}`,
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

    return false; // Выходим, если Bull уже был использован
  }

  // Списываем стоимость использования
  deductResourceCost(type);

  setSpecialBallType(type);

  // Если выбран шар Bull, устанавливаем флаг, что он будет использован
  if (type === 'Bull' && setBullUsed) {
    setBullUsed(true);
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
      return createSpecialBall(type, scene, currentBallRef, trajectoryLineRef, dispatch);
    } catch (error) {
      console.error(`Ошибка при создании специального шара ${type}:`, error);
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: `Ошибка при создании специального шара ${type}`,
          type: 'error',
          duration: 2000
        }
      });
      return false;
    }
  } else {
    console.error(`Невозможно создать специальный шар ${type}: currentBallRef.current или gameInstanceRef.current не существует`);
    dispatch({
      type: 'SHOW_NOTIFICATION',
      payload: {
        message: `Ошибка при создании специального шара ${type}: сцена не найдена`,
        type: 'error',
        duration: 2000
      }
    });
    return false;
  }
}; 