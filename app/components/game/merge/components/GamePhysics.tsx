'use client'

import React, { useEffect, useRef } from 'react';
import * as planck from 'planck';
import { isBodyDestroyed } from '../utils/bodyUtils';
import { checkAndMergeBalls, hasBallsMarkedForMerge } from '../physics/checkAndMergeBalls';
import { checkAndHandleStuckBalls } from '../utils/stuckBallsUtils';
import { removeBall } from '../utils/ballsUtils';
import { ExtendedBall } from '../types';
import { TIME_STEP, VELOCITY_ITERATIONS, POSITION_ITERATIONS, CHECK_MERGE_FREQUENCY, SCALE, STUCK_THRESHOLD_VELOCITY, STUCK_TIME_MS } from '../constants/gameConstants';

interface GamePhysicsProps {
  isPaused: boolean;
  worldRef: React.MutableRefObject<planck.World | null>;
  ballsRef: React.MutableRefObject<ExtendedBall[]>;
  gameInstanceRef: React.MutableRefObject<any>;
  potentiallyStuckBallsRef: React.MutableRefObject<Map<ExtendedBall, number>>;
}

const STUCK_CHECK_INTERVAL = 30;

const GamePhysics: React.FC<GamePhysicsProps> = ({
  isPaused,
  worldRef,
  ballsRef,
  gameInstanceRef,
  potentiallyStuckBallsRef
}) => {
  const frameCounterRef = useRef<number>(0);
  const stuckCheckCounterRef = useRef<number>(0);

  // Функция для проверки и обработки зависших шаров
  const checkStuckBalls = () => {
    if (!worldRef.current || !gameInstanceRef.current) return;
    
    // Фильтруем массив шаров, оставляя только валидные
    // Используем более эффективный способ с обходом массива с конца
    for (let i = ballsRef.current.length - 1; i >= 0; i--) {
      const ball = ballsRef.current[i];
      if (!ball || !ball.body || !ball.sprite || !ball.sprite.container || ball.sprite.container.destroyed) {
        // Удаляем некорректные элементы
        ballsRef.current.splice(i, 1);
        continue;
      }
      
      // Чистим физические ресурсы мертвых шаров, которые не были правильно удалены
      if (ball.body && !ball.body.isActive()) {
        if (worldRef.current) {
          ball.body.setUserData(null);
          try {
            worldRef.current.destroyBody(ball.body);
          } catch (e) {
            console.warn("Ошибка при удалении неактивного тела:", e);
          }
        }
        ballsRef.current.splice(i, 1);
        continue;
      }
    }
    
    // Проверяем зависшие шары с помощью утилиты
    checkAndHandleStuckBalls(
      ballsRef.current,
      potentiallyStuckBallsRef.current,
      STUCK_THRESHOLD_VELOCITY,
      STUCK_TIME_MS,
      removeBallHandler
    );
  };
  
  // Функция для удаления одного шара
  const removeBallHandler = (ball: ExtendedBall) => {
    removeBall(ball, ballsRef, worldRef);
  };

  // Эффект для обновления физики на каждом кадре
  useEffect(() => {
    // Функция обновления физики на каждом кадре
    const updatePhysics = () => {
      try {
        if (isPaused || !worldRef.current) return;
        
        // Инкрементируем счетчик кадров
        frameCounterRef.current++;
        
        // Увеличиваем счетчик для проверки зависших шаров
        stuckCheckCounterRef.current++;
        
        // Проверяем на потенциально "зависшие" шары каждые N кадров
        if (stuckCheckCounterRef.current >= STUCK_CHECK_INTERVAL) {
          stuckCheckCounterRef.current = 0;
          checkStuckBalls();
        }
        
        // Обновляем физический мир с правильными параметрами
        worldRef.current.step(TIME_STEP, VELOCITY_ITERATIONS, POSITION_ITERATIONS);
        
        // Обновляем визуальное положение всех шаров
        for (let i = 0; i < ballsRef.current.length; i++) {
          const ball = ballsRef.current[i];
          
          // Пропускаем недействительные шары или шары без тела
          if (!ball || !ball.body || isBodyDestroyed(ball.body)) {
            continue;
          }
          
          // Обновляем визуальное представление шара
          try {
            const pos = ball.body.getPosition();
            if (ball.sprite && ball.sprite.container && !ball.sprite.container.destroyed) {
              ball.sprite.container.x = pos.x * SCALE;
              ball.sprite.container.y = pos.y * SCALE;
            }
            
            // Обновляем вращение, если это необходимо
            if (ball.sprite.circle) {
              const angle = ball.body.getAngle() * (180 / Math.PI); // Переводим радианы в градусы
              ball.sprite.circle.angle = angle;
            }
          } catch (error) {
            console.warn('Ошибка при обновлении позиции шара:', error);
          }
        }
        
        // Проверяем на слияния каждые N кадров
        if (frameCounterRef.current % CHECK_MERGE_FREQUENCY === 0) {
          if (hasBallsMarkedForMerge(worldRef)) {
            // Вызываем checkAndMergeBalls с правильными аргументами
            checkAndMergeBalls(
              gameInstanceRef.current?.scene?.scenes[0],
              worldRef,
              ballsRef,
              frameCounterRef.current
            );
          }
        }
      } catch (error) {
        console.error('Ошибка при обновлении физики:', error);
      }
    };

    // Регистрируем функцию обновления на анимационный кадр
    let animationFrameId: number;
    
    const animate = () => {
      updatePhysics();
      animationFrameId = requestAnimationFrame(animate);
    };
    
    // Запускаем анимационный цикл
    animationFrameId = requestAnimationFrame(animate);
    
    // Очистка при размонтировании компонента
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPaused, worldRef, ballsRef, gameInstanceRef, potentiallyStuckBallsRef]);

  // Компонент не рендерит никакого UI
  return null;
};

export default GamePhysics; 