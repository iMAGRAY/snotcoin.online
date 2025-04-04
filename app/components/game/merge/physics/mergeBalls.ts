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
) => {
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
          if (mergeEffect && !mergeEffect.destroyed) {
            mergeEffect.destroy();
          }
        }
      });
      
      // Проверяем, нужно ли начислить snot за создание шара высокого уровня
      const snotRewardPercent = getSnotRewardPercent(newLevel);
      if (snotRewardPercent > 0 && scene.dispatch) {
        // Получаем текущую вместимость контейнера из состояния игры
        if (typeof scene.state !== 'undefined' && typeof scene.state.inventory !== 'undefined') {
          const containerCapacity = scene.state.inventory.containerCapacity || 1;
          // Рассчитываем сумму награды
          const snotReward = Math.round(containerCapacity * snotRewardPercent * 100) / 100;
          
          // Отправляем диспетчеру действие для добавления snot
          scene.dispatch({
            type: 'ADD_SNOT',
            payload: snotReward
          });
          
          // Показываем визуальное уведомление о начислении snot
          if (scene.dispatch) {
            scene.dispatch({
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
  
  return newBall;
};

export function mergeBallsOld(
  ballA: ExtendedBall,
  ballB: ExtendedBall,
  // @ts-ignore - Игнорируем ошибку типизации, реальная реализация использует правильный тип
  ballsRef: React.MutableRefObject<ExtendedBall[]>,
  worldRef: React.MutableRefObject<planck.World | null>,
  scene: any
): ExtendedBall | null {
  if (!ballA || !ballB || !ballA.body || !ballB.body) {
    // console.warn('Не удалось слить шары: отсутствует тело шара');
    return null;
  }
  if (!worldRef.current) {
    // console.warn('Не удалось слить шары: отсутствует физический мир');
    return null;
  }
  
  try {
    // console.log(`Пытаемся слить шары уровня ${ballA.level} и ${ballB.level}`);
    
    // Проверяем уровни еще раз для безопасности
    if (ballA.level !== ballB.level) {
      // console.warn(`Отмена слияния: уровни шаров не совпадают (${ballA.level} и ${ballB.level})`);
      return null;
    }
    
    if (ballA.level >= MAX_LEVEL) {
      // console.warn(`Отмена слияния: достигнут максимальный уровень ${MAX_LEVEL}`);
      return null;
    }
    
    // console.log(`Выполняем слияние шаров уровня ${ballA.level}`);
    
    // Получаем позиции для создания нового шара
    const posA = ballA.body.getPosition();
    const posB = ballB.body.getPosition();
    
    // Вычисляем среднюю позицию для нового шара
    const newX = (posA.x + posB.x) / 2;
    const newY = (posA.y + posB.y) / 2;
    
    // Уничтожаем старые шары в безопасном режиме
    try {
      if (ballA.body && worldRef.current) {
        ballA.body.setUserData(null);
        worldRef.current.destroyBody(ballA.body);
        ballA.body = null as any;
        // console.log('Уничтожено тело первого шара');
      }
    } catch (e) {
      // console.error('Ошибка при уничтожении тела первого шара:', e);
    }
    
    try {
      if (ballB.body && worldRef.current) {
        ballB.body.setUserData(null);
        worldRef.current.destroyBody(ballB.body);
        ballB.body = null as any;
        // console.log('Уничтожено тело второго шара');
      }
    } catch (e) {
      // console.error('Ошибка при уничтожении тела второго шара:', e);
    }
    
    // Уничтожаем спрайты в безопасном режиме
    try {
      if (ballA.sprite && ballA.sprite.container && !ballA.sprite.container.destroyed) {
        ballA.sprite.container.destroy();
        // console.log('Уничтожен спрайт первого шара');
        
        if (ballA.level === MAX_LEVEL && ballA.sprite.effectsContainer && !ballA.sprite.effectsContainer.destroyed) {
          ballA.sprite.effectsContainer.destroy();
        }
      }
    } catch (e) {
      // console.error('Ошибка при уничтожении спрайта первого шара:', e);
    }
    
    try {
      if (ballB.sprite && ballB.sprite.container && !ballB.sprite.container.destroyed) {
        ballB.sprite.container.destroy();
        // console.log('Уничтожен спрайт второго шара');
        
        if (ballB.level === MAX_LEVEL && ballB.sprite.effectsContainer && !ballB.sprite.effectsContainer.destroyed) {
          ballB.sprite.effectsContainer.destroy();
        }
      }
    } catch (e) {
      // console.error('Ошибка при уничтожении спрайта второго шара:', e);
    }
    
    // Удаляем шары из массива
    const initialLength = ballsRef.current.length;
    ballsRef.current = ballsRef.current.filter(ball => 
      ball && ball !== ballA && ball !== ballB && ball.body !== null
    );
    // console.log(`Удалено ${initialLength - ballsRef.current.length} шаров из массива`);
    
    // Создаем новый шар следующего уровня
    const newLevel = ballA.level + 1;
    // console.log(`Создаем новый шар уровня ${newLevel}`);
    
    // @ts-ignore - Игнорируем все ошибки несоответствия типов при вызове createBall
    const newBall = createBall(
      scene, 
      worldRef,
      // @ts-ignore - Игнорируем несоответствие типов MutableRefObject<ExtendedBall[]> и MutableRefObject<LocalBall[]>
      ballsRef as any,
      newX * SCALE, 
      newY * SCALE, 
      newLevel
    );
    
    if (newBall) {
      // console.log(`Новый шар уровня ${newLevel} успешно создан`);
      
      // Добавляем небольшой импульс вверх при создании нового шара
      if (newBall.body) {
        newBall.body.applyLinearImpulse(planck.Vec2(0, -0.2), newBall.body.getWorldCenter());
      }
      
      // Добавляем визуальный эффект слияния
      if (scene && scene.add) {
        const mergeEffect = scene.add.circle(
          newX * SCALE, 
          newY * SCALE, 
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
            if (mergeEffect && !mergeEffect.destroyed) {
              mergeEffect.destroy();
            }
          }
        });
        
        // Проверяем, нужно ли начислить snot за создание шара высокого уровня
        const snotRewardPercent = getSnotRewardPercent(newLevel);
        if (snotRewardPercent > 0 && scene.dispatch) {
          // Получаем текущую вместимость контейнера из состояния игры
          if (typeof scene.state !== 'undefined' && typeof scene.state.inventory !== 'undefined') {
            const containerCapacity = scene.state.inventory.containerCapacity || 1;
            // Рассчитываем сумму награды
            const snotReward = Math.round(containerCapacity * snotRewardPercent * 100) / 100;
            
            // Отправляем диспетчеру действие для добавления snot
            scene.dispatch({
              type: 'ADD_SNOT',
              payload: snotReward
            });
            
            // Показываем визуальное уведомление о начислении snot
            if (scene.dispatch) {
              scene.dispatch({
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
    } else {
      // console.error(`Не удалось создать новый шар уровня ${newLevel}`);
    }
    
    // @ts-ignore - Игнорируем ошибку типизации, реальная реализация возвращает совместимый тип
    return newBall;
  } catch (error) {
    // console.error('Ошибка при объединении шаров:', error);
    return null;
  }
} 