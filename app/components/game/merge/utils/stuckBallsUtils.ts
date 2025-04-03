'use client'

import planck from 'planck';
import { ExtendedBall } from '../types/index';

/**
 * Проверяет, считается ли шар "зависшим" по скорости и времени нахождения в таком состоянии
 * @param ball Шар для проверки
 * @param stuckThresholdVelocity Пороговое значение скорости
 * @param currentTime Текущее время
 * @param potentiallyStuckBalls Карта потенциально зависших шаров
 * @param stuckTimeMs Время, после которого шар считается зависшим
 * @returns true, если шар считается зависшим
 */
export const isBallStuck = (
  ball: ExtendedBall,
  stuckThresholdVelocity: number,
  currentTime: number,
  potentiallyStuckBalls: Map<ExtendedBall, number>,
  stuckTimeMs: number
): boolean => {
  // Проверяем физические свойства шара
  if (!ball.body || ball.markedForRemoval || ball.isMerging) {
    // Шар уже отмечен для удаления, участвует в слиянии или не имеет физического тела
    return false;
  }

  // Получаем вектор скорости
  const velocity = ball.body.getLinearVelocity();
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  
  // Если скорость ниже порогового значения, шар может быть зависшим
  if (speed < stuckThresholdVelocity) {
    // Если шар уже был в списке потенциально зависших
    if (potentiallyStuckBalls.has(ball)) {
      const stuckSince = potentiallyStuckBalls.get(ball) || 0;
      // Проверяем, достаточно ли времени прошло, чтобы считать шар действительно зависшим
      if (currentTime - stuckSince > stuckTimeMs) {
        return true;
      }
    } else {
      // Добавляем шар в список потенциально зависших
      potentiallyStuckBalls.set(ball, currentTime);
    }
  } else {
    // Если скорость выше порога, удаляем шар из списка потенциально зависших
    potentiallyStuckBalls.delete(ball);
  }
  
  return false;
};

/**
 * Находит и обрабатывает зависшие шары
 * @param balls Массив шаров для проверки
 * @param potentiallyStuckBalls Карта потенциально зависших шаров
 * @param stuckThresholdVelocity Пороговое значение скорости
 * @param stuckTimeMs Время, после которого шар считается зависшим
 * @param onRemoveBall Функция для удаления шара
 */
export const checkAndHandleStuckBalls = (
  balls: ExtendedBall[],
  potentiallyStuckBalls: Map<ExtendedBall, number>,
  stuckThresholdVelocity: number,
  stuckTimeMs: number,
  onRemoveBall: (ball: ExtendedBall) => void
): void => {
  const currentTime = Date.now();
  let stuckBallsFound = false;
  
  // Проверяем каждый шар на "зависание"
  balls.forEach(ball => {
    if (isBallStuck(ball, stuckThresholdVelocity, currentTime, potentiallyStuckBalls, stuckTimeMs)) {
      // Отмечаем шар для удаления
      if (!ball.markedForRemoval) {
        ball.markedForRemoval = true;
        onRemoveBall(ball);
        stuckBallsFound = true;
      }
    }
  });
  
  if (stuckBallsFound) {
    console.log("Обнаружены и удалены зависшие шары");
  }
}; 