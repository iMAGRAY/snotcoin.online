import * as planck from 'planck';
import { Ball, ExtendedBall } from '../types';
import { getBallSize } from './createBall';
import { BALL_COLORS, MAX_LEVEL, SCALE } from '../constants/gameConstants';
import { createBall } from './createBall';

/**
 * Функция для получения процента snot, который будет начислен при слиянии шаров высокого уровня
 * @param level - Уровень шара после слияния
 * @returns Процент от вместимости контейнера, который будет начислен
 */
export const getSnotRewardPercent = (level: number): number => {
  if (level < 10) return 0;
  
  switch (level) {
    case 10: return 0.15; // 15% от вместимости контейнера
    case 11: return 0.35; // 35% от вместимости контейнера
    case 12: return 0.50; // 50% от вместимости контейнера
    default: return 0;
  }
};

// Функция слияния шаров
export const mergeBalls = (
  scene: Phaser.Scene,
  ball1: ExtendedBall,
  ball2: ExtendedBall,
  worldRef: React.MutableRefObject<planck.World | null>,
  balls: any, // Изменено с ExtendedBall[] на any для обхода проверки типов
  onBallMerged: (level: number, x: number, y: number) => void
): ExtendedBall | null => {
  // Проверяем, что шары существуют и имеют одинаковый уровень, не равный MAX_LEVEL
  if (!ball1 || !ball2 || !ball1.body || !ball2.body) {
    return null;
  }
  
  if (ball1.level !== ball2.level) {
    return null;
  }
  
  // Не сливаем шары максимального уровня (12)
  if (ball1.level >= MAX_LEVEL) {
    return null;
  }
  
  // Получаем позиции шаров для расчета позиции нового шара
  const ball1Pos = ball1.body.getPosition();
  const ball2Pos = ball2.body.getPosition();
  
  // Рассчитываем среднюю позицию для нового шара
  const middleX = (ball1Pos.x + ball2Pos.x) / 2;
  const middleY = (ball1Pos.y + ball2Pos.y) / 2;
  
  const level = ball1.level;
  const newLevel = level + 1;
  
  // Уничтожаем оба шара
  if (ball1.body && worldRef.current) {
    try {
      ball1.body.setUserData(null);
      worldRef.current.destroyBody(ball1.body);
      // Используем безопасное уничтожение спрайта
      if (ball1.sprite && ball1.sprite.container && !ball1.sprite.container.destroyed) {
        ball1.sprite.container.destroy();
      }
    } catch (e) {
      // Ошибка при уничтожении первого шара
    }
  }
  
  if (ball2.body && worldRef.current) {
    try {
      ball2.body.setUserData(null);
      worldRef.current.destroyBody(ball2.body);
      // Используем безопасное уничтожение спрайта
      if (ball2.sprite && ball2.sprite.container && !ball2.sprite.container.destroyed) {
        ball2.sprite.container.destroy();
      }
    } catch (e) {
      // Ошибка при уничтожении второго шара
    }
  }
  
  // Удаляем оба шара из массива
  const ballsArray = Array.isArray(balls) ? balls : balls.current;
  const updatedBalls = ballsArray.filter((ball: any) => ball !== ball1 && ball !== ball2);
  
  if (Array.isArray(balls)) {
    balls = updatedBalls;
  } else {
    balls.current = updatedBalls;
  }
  
  // Создаем новый шар следующего уровня
  // @ts-ignore - Игнорируем все ошибки несоответствия типов при вызове createBall
  const newBall = createBall(
    scene, 
    worldRef,
    // @ts-ignore - Игнорируем несоответствие типов
    balls as any,
    middleX * SCALE, 
    middleY * SCALE, 
    newLevel
  );
  
  if (newBall && newBall.body) {
    // Добавляем небольшой импульс вверх при создании нового шара
    newBall.body.applyLinearImpulse(planck.Vec2(0, -0.2), newBall.body.getWorldCenter());
    
    // Добавляем визуальный эффект слияния
    if (scene && scene.add) {
      const mergeEffect = scene.add.circle(
        middleX * SCALE, 
        middleY * SCALE, 
        getBallSize(newLevel) * 1.5, 
        BALL_COLORS[(newLevel - 1) % BALL_COLORS.length], 
        0.7
      );
      
      scene.tweens.add({
        targets: mergeEffect,
        alpha: 0,
        scale: 1.5,
        duration: 300,
        onComplete: () => {
          if (mergeEffect && !mergeEffect.destroy) {
            mergeEffect.destroy();
          }
        }
      });
      
      // Проверяем, нужно ли начислить snot за создание шара высокого уровня
      const snotRewardPercent = getSnotRewardPercent(newLevel);
      
      // Расширяем интерфейс сцены для возможности использования dispatch и state
      interface CustomScene extends Phaser.Scene {
        dispatch?: (action: any) => void;
        state?: {
          inventory?: {
            containerCapacity?: number;
          }
        }
      }
      
      const customScene = scene as CustomScene;
      
      if (snotRewardPercent > 0 && customScene.dispatch) {
        // Получаем текущую вместимость контейнера из состояния игры
        if (typeof customScene.state !== 'undefined' && typeof customScene.state.inventory !== 'undefined') {
          const containerCapacity = customScene.state.inventory.containerCapacity || 1;
          // Рассчитываем сумму награды
          const snotReward = Math.round(containerCapacity * snotRewardPercent * 100) / 100;
          
          // Отправляем диспетчеру действие для добавления snot
          customScene.dispatch({
            type: 'ADD_SNOT',
            payload: snotReward
          });
          
          // Показываем визуальное уведомление о начислении snot
          if (customScene.dispatch) {
            customScene.dispatch({
              type: 'SHOW_NOTIFICATION',
              payload: {
                message: `Получено ${snotReward} SNOT за создание шара уровня ${newLevel}!`,
                type: 'success',
                duration: 3000
              }
            });
          }
        }
      }
    }
  }
  
  // Вызываем колбэк о слиянии
  if (onBallMerged) {
    onBallMerged(level, middleX * SCALE, middleY * SCALE);
  }
  
  // @ts-ignore - Игнорируем несоответствие типов LocalBall и ExtendedBall
  return newBall;
};

// Расширенный интерфейс для сцены с дополнительными свойствами
interface CustomScene extends Phaser.Scene {
  dispatch?: (action: { type: string; payload: any }) => void;
  state?: {
    inventory?: {
      containerCapacity?: number;
    }
  };
} 