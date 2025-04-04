'use client'

import { Ball, ExtendedBall } from '../types/index';
import planck from 'planck';

/**
 * Удаляет один шар из игры
 * @param ball Шар для удаления
 * @param ballsRef Ссылка на массив шаров
 * @param worldRef Ссылка на физический мир planck
 */
export const removeBall = (
  ball: ExtendedBall,
  ballsRef: React.MutableRefObject<ExtendedBall[]>,
  worldRef: React.MutableRefObject<planck.World | null>,
) => {
  if (!ball) {
    // Шар не существует, возвращаем исходный массив
    return;
  }
  
  // Очищаем ресурсы шара перед удалением
  cleanupBall(ball, worldRef.current);
  
  // Возвращаем новый массив без удаленного шара
  ballsRef.current = ballsRef.current.filter((b) => b !== ball);
  
  // Проверяем и удаляем все "мёртвые" шары без физических тел
  const invalidBalls = ballsRef.current.filter(b => !b || !b.body);
  if (invalidBalls.length > 0) {
    // Найдено несколько шаров без физических тел, очищаем...
    ballsRef.current = ballsRef.current.filter(b => b && b.body);
  }
  
  // Пробуем явно вызвать сборщик мусора (если доступен)
  if (typeof global !== 'undefined' && global.gc) {
    try {
      global.gc();
    } catch (e) {
      // Не удалось запустить сборщик мусора:
    }
  }
};

/**
 * Находит шары с самыми нижними позициями
 * @param ballsRef Ссылка на массив шаров
 * @param count Количество шаров для поиска
 * @returns Массив найденных шаров
 */
export const findBottomBalls = (
  ballsRef: React.MutableRefObject<ExtendedBall[]>,
  count: number
): ExtendedBall[] => {
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

/**
 * Удаляет указанные шары из игры
 * @param balls Массив шаров для удаления
 * @param ballsRef Ссылка на массив всех шаров
 * @param worldRef Ссылка на физический мир planck
 * @param potentiallyStuckBallsRef Ссылка на карту потенциально зависших шаров
 */
export const removeMultipleBalls = (
  balls: Ball[],
  ballsRef: React.MutableRefObject<ExtendedBall[]>,
  worldRef: React.MutableRefObject<planck.World | null>,
  potentiallyStuckBallsRef: React.MutableRefObject<Map<ExtendedBall, number>>
) => {
  if (!balls.length) return;
  
  for (const ball of balls) {
    if (!ball) continue;
    
    // Используем функцию removeBall для единообразного удаления
    removeBall(ball as ExtendedBall, ballsRef, worldRef);
    
    // Удаляем шар из списка потенциально зависших
    potentiallyStuckBallsRef.current.delete(ball as ExtendedBall);
  }
  
  // Обновляем массив шаров - удаляем все удаленные шары
  ballsRef.current = ballsRef.current.filter(ball => 
    ball && balls.indexOf(ball as Ball) === -1
  );
  
  // Запускаем явную очистку мусора
  if (typeof global !== 'undefined' && global.gc) {
    try {
      global.gc();
    } catch (e) {
      // Не удалось запустить сборщик мусора:
    }
  }
};

// Удаляет объект шара и связанные с ним ресурсы
export const cleanupBall = (ball: ExtendedBall | null, world: planck.World | null): void => {
  if (!ball) {
    // Шар не существует
    return;
  }

  try {
    // Удаляем физическое тело шара, если оно существует
    if (ball.body && world) {
      try {
        world.destroyBody(ball.body);
        ball.body = null as any;
        // Физическое тело шара уничтожено
      } catch (e) {
        // Ошибка при уничтожении физического тела шара
      }
    }

    // Удаляем спрайт шара и связанные с ним объекты
    if (ball.sprite && ball.sprite.container && !ball.sprite.container.destroyed) {
      try {
        ball.sprite.container.destroy();
        // Контейнер спрайта шара уничтожен
      } catch (e) {
        // Ошибка при уничтожении контейнера спрайта
      }
    }

    // Удаляем контейнер эффектов, если он существует
    if (ball.sprite && ball.sprite.effectsContainer && !ball.sprite.effectsContainer.destroyed) {
      try {
        ball.sprite.effectsContainer.destroy();
        // Контейнер эффектов шара уничтожен
      } catch (e) {
        // Ошибка при уничтожении контейнера эффектов
      }
    }
  } catch (e) {
    // Критическая ошибка при очистке ресурсов шара
  }
}; 