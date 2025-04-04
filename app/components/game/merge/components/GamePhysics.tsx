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
  // Референс для хранения предыдущих позиций шаров для плавной интерполяции
  const prevPositionsRef = useRef<Map<string, {x: number, y: number, angle: number}>>(new Map());
  // Скорость интерполяции (меньшее значение = более плавное движение)
  const INTERPOLATION_SPEED = 0.7;

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
            // Ошибка при удалении неактивного тела
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
        
        // ВАЖНО: Проверяем валидность контактов перед обновлением физики
        try {
          // Получаем первый контакт в мире
          let contact = worldRef.current.getContactList();
          
          // Перебираем все контакты, проверяя их на валидность
          while (contact) {
            const nextContact = contact.getNext(); // Сохраняем ссылку на следующий контакт
            
            // Получаем фикстуры и тела для проверки
            const fixtureA = contact.getFixtureA();
            const fixtureB = contact.getFixtureB();
            
            // Проверка на null или разрушенные тела
            if (!fixtureA || !fixtureB) {
              // Пропускаем невалидный контакт
              contact = nextContact;
              continue;
            }
            
            const bodyA = fixtureA.getBody();
            const bodyB = fixtureB.getBody();
            
            if (!bodyA || !bodyB || !bodyA.isActive() || !bodyB.isActive()) {
              // Если одно из тел не существует или неактивно, уничтожаем контакт
              // Для этого отключаем его, чтобы физический движок его пропустил
              contact.setEnabled(false);
            }
            
            // Переходим к следующему контакту
            contact = nextContact;
          }
        } catch (contactError) {
          // Пытаемся сбросить все контакты для предотвращения дальнейших проблем
          worldRef.current.clearForces();
        }
        
        // Теперь выполняем обновление физического мира с проверкой на ошибки
        try {
          worldRef.current.step(TIME_STEP, VELOCITY_ITERATIONS, POSITION_ITERATIONS);
        } catch (stepError) {
          // В случае ошибки пытаемся восстановить состояние мира
          // Сначала пробуем полностью очистить все контакты
          worldRef.current.clearForces();
          
          // Попытка перезапустить мир с минимальным шагом
          try {
            worldRef.current.step(0.001, 1, 1);
          } catch (recoverError) {
            // Не удалось восстановить мир
          }
        }
        
        // Кэшируем текущие позиции всех шаров перед обновлением визуальных позиций
        const currentFramePositions = new Map<string, {x: number, y: number, angle: number}>();
        
        // Обновляем визуальное положение всех шаров
        for (let i = 0; i < ballsRef.current.length; i++) {
          const ball = ballsRef.current[i];
          
          // Пропускаем недействительные шары или шары без тела
          if (!ball || !ball.body || isBodyDestroyed(ball.body)) {
            continue;
          }
          
          // Получаем физические данные шара
          const pos = ball.body.getPosition();
          const userData = ball.body.getUserData() as any;
          const ballId = userData?.createdAt || `ball_${i}`;
          const angle = ball.body.getAngle();
          
          // Создаем уникальный идентификатор для шара
          const ballKey = `${ballId}_${ball.level}`;
          
          // Запоминаем текущую физическую позицию
          currentFramePositions.set(ballKey, {
            x: pos.x * SCALE, 
            y: pos.y * SCALE,
            angle: angle * (180 / Math.PI)
          });
          
          // Обновляем визуальное представление шара с плавной интерполяцией
          if (ball.sprite && ball.sprite.container && !ball.sprite.container.destroyed) {
            // Получаем текущие координаты спрайта
            const currentX = ball.sprite.container.x;
            const currentY = ball.sprite.container.y;
            
            // Получаем предыдущую позицию или используем текущую, если предыдущей нет
            const prevPos = prevPositionsRef.current.get(ballKey) || {
              x: currentX,
              y: currentY,
              angle: ball.sprite.circle?.angle || 0
            };
            
            // Вычисляем целевые координаты по физическому телу
            const targetX = pos.x * SCALE;
            const targetY = pos.y * SCALE;
            
            // Проверяем, насколько большое изменение позиции произошло
            const diffX = Math.abs(targetX - prevPos.x);
            const diffY = Math.abs(targetY - prevPos.y);
            
            // Если изменение слишком большое (телепортация), сразу переместить к новой позиции
            const teleportThreshold = 20; // Уменьшаем порог для более быстрых переходов
            const isTeleport = diffX > teleportThreshold || diffY > teleportThreshold;
            
            if (isTeleport) {
              // При телепортации сразу устанавливаем новое положение
              ball.sprite.container.x = targetX;
              ball.sprite.container.y = targetY;
            } else {
              // Для небольших изменений применяем плавную интерполяцию
              // Используем адаптивную интерполяцию - быстрее для быстро движущихся объектов
              const velocity = ball.body.getLinearVelocity();
              const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
              
              // Адаптивный коэффициент интерполяции (быстрее для более быстрых объектов)
              // Увеличиваем базовый коэффициент для более быстрого движения
              const adaptiveFactor = Math.min(0.7 + speed * 0.08, 0.95);
              
              // Минимальный порог для обновления позиции (чтобы избежать микро-колебаний)
              const movementThreshold = 0.01; // Уменьшаем для более частого обновления
              
              if (diffX > movementThreshold || diffY > movementThreshold) {
                ball.sprite.container.x = prevPos.x + (targetX - prevPos.x) * adaptiveFactor;
                ball.sprite.container.y = prevPos.y + (targetY - prevPos.y) * adaptiveFactor;
              }
              
              // Обновляем вращение с той же логикой интерполяции
              if (ball.sprite.circle) {
                const targetAngle = angle * (180 / Math.PI);
                const currentAngle = ball.sprite.circle.angle || 0;
                const diffAngle = Math.abs(targetAngle - currentAngle);
                
                if (diffAngle > 0.3) { // Уменьшаем порог для более частого обновления угла
                  ball.sprite.circle.angle = prevPos.angle + (targetAngle - prevPos.angle) * adaptiveFactor;
                }
              }
            }
            
            // Обновляем z-index только при существенных изменениях позиции Y
            // или периодически для синхронизации
            if (Math.abs(ball.sprite.container.y - prevPos.y) > 1 || frameCounterRef.current % 30 === 0) {
              // Установка z-index (depth) на основе позиции Y
              // Чем больше Y (ниже на экране), тем выше z-index (отображается поверх других)
              // Добавляем уровень шара как малую компоненту для стабильного порядка отрисовки
              const depth = ball.sprite.container.y + (ball.level * 0.01);
              ball.sprite.container.setDepth(depth);
            }
          }
        }
        
        // Запоминаем позиции этого кадра для использования в следующем
        prevPositionsRef.current = currentFramePositions;
        
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
        // Ошибка при обновлении физики
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