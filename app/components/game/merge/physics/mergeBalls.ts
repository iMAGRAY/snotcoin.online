import * as planck from 'planck';
import { Ball } from '../types/index';
import { getBallSize } from '../utils/ballUtils';
import { BALL_COLORS, MAX_LEVEL, SCALE } from '../constants/gameConstants';
import { createBall } from './createBall';

// Единая функция для слияния шаров
export const mergeBalls = (
  scene: any, 
  ballA: Ball, 
  ballB: Ball,
  worldRef: React.MutableRefObject<planck.World | null>,
  ballsRef: React.MutableRefObject<Ball[]>
): Ball | null => {
  if (!ballA || !ballB || !ballA.body || !ballB.body) {
    console.warn('Не удалось слить шары: отсутствует тело шара');
    return null;
  }
  if (!worldRef.current) {
    console.warn('Не удалось слить шары: отсутствует физический мир');
    return null;
  }
  
  try {
    console.log(`Пытаемся слить шары уровня ${ballA.level} и ${ballB.level}`);
    
    // Проверяем уровни еще раз для безопасности
    if (ballA.level !== ballB.level) {
      console.warn(`Отмена слияния: уровни шаров не совпадают (${ballA.level} и ${ballB.level})`);
      return null;
    }
    
    if (ballA.level >= MAX_LEVEL) {
      console.warn(`Отмена слияния: достигнут максимальный уровень ${MAX_LEVEL}`);
      return null;
    }
    
    console.log(`Выполняем слияние шаров уровня ${ballA.level}`);
    
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
        console.log('Уничтожено тело первого шара');
      }
    } catch (e) {
      console.error('Ошибка при уничтожении тела первого шара:', e);
    }
    
    try {
      if (ballB.body && worldRef.current) {
        ballB.body.setUserData(null);
        worldRef.current.destroyBody(ballB.body);
        ballB.body = null as any;
        console.log('Уничтожено тело второго шара');
      }
    } catch (e) {
      console.error('Ошибка при уничтожении тела второго шара:', e);
    }
    
    // Уничтожаем спрайты в безопасном режиме
    try {
      if (ballA.sprite && ballA.sprite.container && !ballA.sprite.container.destroyed) {
        ballA.sprite.container.destroy();
        console.log('Уничтожен спрайт первого шара');
        
        if (ballA.level === MAX_LEVEL && ballA.sprite.effectsContainer && !ballA.sprite.effectsContainer.destroyed) {
          ballA.sprite.effectsContainer.destroy();
        }
      }
    } catch (e) {
      console.error('Ошибка при уничтожении спрайта первого шара:', e);
    }
    
    try {
      if (ballB.sprite && ballB.sprite.container && !ballB.sprite.container.destroyed) {
        ballB.sprite.container.destroy();
        console.log('Уничтожен спрайт второго шара');
        
        if (ballB.level === MAX_LEVEL && ballB.sprite.effectsContainer && !ballB.sprite.effectsContainer.destroyed) {
          ballB.sprite.effectsContainer.destroy();
        }
      }
    } catch (e) {
      console.error('Ошибка при уничтожении спрайта второго шара:', e);
    }
    
    // Удаляем шары из массива
    const initialLength = ballsRef.current.length;
    ballsRef.current = ballsRef.current.filter(ball => 
      ball && ball !== ballA && ball !== ballB && ball.body !== null
    );
    console.log(`Удалено ${initialLength - ballsRef.current.length} шаров из массива`);
    
    // Создаем новый шар следующего уровня
    const newLevel = ballA.level + 1;
    console.log(`Создаем новый шар уровня ${newLevel}`);
    
    const newBall = createBall(
      scene, 
      worldRef,
      ballsRef,
      newX * SCALE, 
      newY * SCALE, 
      newLevel
    );
    
    if (newBall) {
      console.log(`Новый шар уровня ${newLevel} успешно создан`);
      
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
      }
    } else {
      console.error(`Не удалось создать новый шар уровня ${newLevel}`);
    }
    
    return newBall;
  } catch (error) {
    console.error('Ошибка при объединении шаров:', error);
    return null;
  }
}; 