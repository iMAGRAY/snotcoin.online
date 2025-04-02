import * as planck from 'planck';
import { Ball } from '../types';
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
  if (!ballA || !ballB || !ballA.body || !ballB.body) return null;
  if (!worldRef.current) return null;
  
  try {
    // Проверяем уровни еще раз для безопасности
    if (ballA.level !== ballB.level || ballA.level >= MAX_LEVEL) return null;
    
    // Получаем позиции для создания нового шара
    const posA = ballA.body.getPosition();
    const posB = ballB.body.getPosition();
    
    // Вычисляем среднюю позицию для нового шара
    const newX = (posA.x + posB.x) / 2;
    const newY = (posA.y + posB.y) / 2;
    
    // Уничтожаем старые шары в безопасном режиме
    if (ballA.body && worldRef.current) {
      ballA.body.setUserData(null);
      worldRef.current.destroyBody(ballA.body);
      ballA.body = null as any;
    }
    
    if (ballB.body && worldRef.current) {
      ballB.body.setUserData(null);
      worldRef.current.destroyBody(ballB.body);
      ballB.body = null as any;
    }
    
    // Уничтожаем спрайты в безопасном режиме
    if (ballA.sprite && ballA.sprite.container && !ballA.sprite.container.destroyed) {
      ballA.sprite.container.destroy();
      
      if (ballA.level === MAX_LEVEL && ballA.sprite.effectsContainer && !ballA.sprite.effectsContainer.destroyed) {
        ballA.sprite.effectsContainer.destroy();
      }
    }
    
    if (ballB.sprite && ballB.sprite.container && !ballB.sprite.container.destroyed) {
      ballB.sprite.container.destroy();
      
      if (ballB.level === MAX_LEVEL && ballB.sprite.effectsContainer && !ballB.sprite.effectsContainer.destroyed) {
        ballB.sprite.effectsContainer.destroy();
      }
    }
    
    // Удаляем шары из массива
    ballsRef.current = ballsRef.current.filter(ball => 
      ball && ball !== ballA && ball !== ballB && ball.body !== null
    );
    
    // Создаем новый шар следующего уровня
    const newBall = createBall(
      scene, 
      worldRef,
      ballsRef,
      newX * SCALE, 
      newY * SCALE, 
      ballA.level + 1
    );
    
    // Добавляем небольшой импульс вверх при создании нового шара
    if (newBall && newBall.body) {
      newBall.body.applyLinearImpulse(planck.Vec2(0, -0.2), newBall.body.getWorldCenter());
    }
    
    // Добавляем визуальный эффект слияния
    if (scene && scene.add) {
      const mergeEffect = scene.add.circle(
        newX * SCALE, 
        newY * SCALE, 
        getBallSize(ballA.level + 1) * 1.5, 
        BALL_COLORS[(ballA.level) % BALL_COLORS.length], 
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
    
    return newBall;
  } catch (error) {
    console.error('Ошибка при объединении шаров:', error);
    return null;
  }
}; 