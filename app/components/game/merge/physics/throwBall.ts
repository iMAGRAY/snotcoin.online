import * as planck from 'planck';
import { Ball, NextBall, TrajectoryRef } from '../types/index';
import { createBall } from './createBall';
import { createNextBall } from './createNextBall';
import { THROW_X_VARIATION, MAX_BALLS_COUNT, THROW_VELOCITY_Y } from '../constants/gameConstants';
import { createTrajectoryLine } from '../physics/trajectoryLine';

// Время последнего броска для ограничения частоты бросков
let lastThrowTime = 0;
const THROW_COOLDOWN = 400; // Для стабильности физики

// Счетчик последовательных бросков
let consecutiveThrowsCount = 0;
const MAX_CONSECUTIVE_THROWS = 10; // Ограничение на количество бросков без задержки

// Функция для генерации уровня шара с нужными вероятностями
export const generateBallLevel = (): number => {
  const randomValue = Math.random();
  // Вероятности: 50% для уровня 1, 25% для уровня 2, 13% для уровня 3, 7% для уровня 4, 5% для уровня 5
  if (randomValue < 0.5) {
    return 1;
  } else if (randomValue < 0.75) {
    return 2;
  } else if (randomValue < 0.88) {
    return 3;
  } else if (randomValue < 0.95) {
    return 4;
  } else {
    return 5;
  }
};

// Функция для броска шара
export const throwBall = (
  scene: any,
  currentBallRef: React.MutableRefObject<NextBall | null>,
  playerBodyRef: React.MutableRefObject<planck.Body | null>,
  worldRef: React.MutableRefObject<planck.World | null>,
  ballsRef: React.MutableRefObject<Ball[]>,
  nextBallLevelRef: React.MutableRefObject<number>,
  trajectoryLineRef: React.MutableRefObject<TrajectoryRef | null>,
  isPaused: boolean,
  setFutureNextBallLevel: (level: number) => void
) => {
  // Если игра на паузе или нет игрока/шара - просто выходим
  if (isPaused) {
    console.log('Игра на паузе, бросок отменен');
    return null;
  }
  
  if (!playerBodyRef.current) {
    console.error('Отсутствует тело игрока');
    return null;
  }
  
  if (!currentBallRef.current) {
    console.error('Отсутствует текущий шар для броска');
    // Попытка восстановить шар
    try {
      const newLevel = generateBallLevel();
      currentBallRef.current = createNextBall(scene, playerBodyRef, newLevel);
      if (!currentBallRef.current) {
        return null;
      }
    } catch (e) {
      console.error('Не удалось создать шар для броска:', e);
      return null;
    }
  }
  
  if (!worldRef.current) {
    console.error('Отсутствует физический мир');
    return null;
  }
  
  // Очищаем массив от null-шаров до броска - это поможет точнее определить реальное количество
  cleanupBallsArray(ballsRef);
  
  // Проверяем интервал между бросками (защита от спама)
  const now = Date.now();
  if (now - lastThrowTime < THROW_COOLDOWN) {
    console.log(`Слишком короткий интервал между бросками (${now - lastThrowTime}ms < ${THROW_COOLDOWN}ms)`);
    return null; // Слишком частые броски
  }
  
  // Проверяем максимальное количество шаров
  if (ballsRef.current.length >= MAX_BALLS_COUNT) {
    console.log(`Достигнуто максимальное количество шаров (${MAX_BALLS_COUNT}). Дождитесь слияния.`);
    return null;
  }
  
  // Увеличиваем счетчик последовательных бросков
  consecutiveThrowsCount++;
  
  // Если было слишком много бросков подряд, добавляем большую задержку
  if (consecutiveThrowsCount > MAX_CONSECUTIVE_THROWS) {
    // Сбрасываем счетчик и добавляем дополнительную задержку
    consecutiveThrowsCount = 0;
    lastThrowTime = now + 300; // Дополнительная задержка
    console.log("Слишком много бросков подряд, небольшая пауза для стабильности");
    return null;
  }
  
  // Обновляем время последнего броска
  lastThrowTime = now;
  
  try {
    // Проверяем валидность текущего шара для броска
    if (!currentBallRef.current.sprite || !currentBallRef.current.sprite.container) {
      console.error('Невалидный шар для броска (отсутствуют sprite или container)');
      
      // Пытаемся пересоздать шар
      const newLevel = generateBallLevel();
      currentBallRef.current = createNextBall(scene, playerBodyRef, newLevel);
      
      // Если не удалось создать новый шар, выходим
      if (!currentBallRef.current || !currentBallRef.current.sprite || !currentBallRef.current.sprite.container) {
        console.error('Не удалось создать новый шар после обнаружения проблемы');
        return null;
      }
    }
    
    // Получаем точные координаты текущего шара для броска
    const x = currentBallRef.current.sprite.container.x;
    const y = currentBallRef.current.sprite.container.y;
    const level = currentBallRef.current.level;
    const specialType = currentBallRef.current.specialType; // Получаем тип специального шара (например, Bull)
    
    console.log(`Создаем физический шар: x=${x}, y=${y}, level=${level}, type=${specialType || 'обычный'}`);
    
    // Безопасное создание шара - единая точка для создания физического шара
    const ball = createBall(scene, worldRef, ballsRef, x, y, level, specialType);
    
    if (!ball || !ball.body) {
      console.error('Не удалось создать физический шар');
      return null;
    }
    
    // Применяем физические параметры к новому шару с более стабильной скоростью
    const randomXOffset = (Math.random() * 2 - 1) * THROW_X_VARIATION;
    ball.body.setLinearVelocity(planck.Vec2(randomXOffset, THROW_VELOCITY_Y)); // Используем константу THROW_VELOCITY_Y
    
    console.log(`Шару придана скорость: x=${randomXOffset}, y=${THROW_VELOCITY_Y}`);
    
    // Безопасное уничтожение текущего шара
    try {
      if (currentBallRef.current.sprite && 
          currentBallRef.current.sprite.container && 
          !currentBallRef.current.sprite.container.destroyed) {
        currentBallRef.current.sprite.container.destroy();
      }
    } catch (e) {
      console.warn('Проблема при уничтожении старого шара:', e);
      // Продолжаем выполнение, так как это некритическая ошибка
    }
    
    // Безопасное уничтожение пунктирной линии
    try {
      if (trajectoryLineRef.current) {
        trajectoryLineRef.current.destroy();
        trajectoryLineRef.current = null;
      }
    } catch (e) {
      console.warn('Проблема при уничтожении траектории:', e);
      // Продолжаем выполнение, так как это некритическая ошибка
    }
    
    // Создаем новый шар для следующего броска
    const nextBallLevel = nextBallLevelRef.current;
    
    // Если текущий шар был Bull, для следующего шара не используем специальный тип
    const nextSpecialType = specialType === 'Bull' ? undefined : specialType;
    
    try {
      currentBallRef.current = createNextBall(scene, playerBodyRef, nextBallLevel, nextSpecialType);
      console.log(`Создан новый шар для следующего броска: level=${nextBallLevel}, type=${nextSpecialType || 'обычный'}`);
      
      // Создаем новую пунктирную линию для нового шара
      if (currentBallRef.current && currentBallRef.current.sprite) {
        createTrajectoryLine(
          scene, 
          trajectoryLineRef,
          currentBallRef.current.sprite.container.x, 
          currentBallRef.current.sprite.container.y
        );
      }
    } catch (e) {
      console.error('Ошибка при создании нового шара для броска:', e);
      // Даже если не удалось создать новый шар, мы возвращаем текущий брошенный шар
    }
    
    // Генерируем новый будущий шар с вероятностями для уровней от 1 до 5
    const futureBallLevel = generateBallLevel();
    nextBallLevelRef.current = futureBallLevel;
    setFutureNextBallLevel(futureBallLevel);
    
    // Примечание: После этого вызова необходимо обновить индикатор следующего шара в GameInitializer
    // через функцию updateNextBallIndicator(futureBallLevel)
    
    console.log('Шар успешно брошен');
    // Сбрасываем счетчик последовательных бросков при успешном броске,
    // чтобы избежать ненужных задержек при нормальной игре
    consecutiveThrowsCount = 0;
    
    return ball;
  } catch (error) {
    console.error('Ошибка в функции throwBall:', error);
    
    // Восстановление после ошибки - создаем новый шар в любом случае
    try {
      // Сбрасываем счетчик бросков при ошибке
      consecutiveThrowsCount = 0;
      
      // Создаем новый шар с вероятностями для уровней от 1 до 5
      const newLevel = generateBallLevel();
      currentBallRef.current = createNextBall(scene, playerBodyRef, newLevel);
      
      // Также генерируем будущий шар с теми же вероятностями
      const futureLevel = generateBallLevel();
      nextBallLevelRef.current = futureLevel;
      setFutureNextBallLevel(futureLevel);
      
      // Пытаемся создать пунктирную линию
      if (currentBallRef.current && currentBallRef.current.sprite) {
        createTrajectoryLine(
          scene,
          trajectoryLineRef,
          currentBallRef.current.sprite.container.x, 
          currentBallRef.current.sprite.container.y
        );
      }
      
      console.log('Восстановление после ошибки успешно выполнено');
    } catch (e) {
      console.error('Не удалось восстановиться после ошибки:', e);
    }
    
    return null;
  }
};

// Вспомогательная функция для очистки массива шаров от некорректных ссылок
const cleanupBallsArray = (ballsRef: React.MutableRefObject<Ball[]>) => {
  if (ballsRef.current.length > 0) {
    // Начинаем с конца массива для более эффективного удаления
    for (let i = ballsRef.current.length - 1; i >= 0; i--) {
      const ball = ballsRef.current[i];
      if (!ball || !ball.body || !ball.sprite || !ball.sprite.container || ball.sprite.container.destroyed) {
        // Удаляем некорректные элементы
        ballsRef.current.splice(i, 1);
      }
    }
  }
};