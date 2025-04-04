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
export function throwBall(
  scene: any,
  currentBallRef: React.MutableRefObject<NextBall | null>,
  playerBodyRef: React.MutableRefObject<planck.Body | null>,
  worldRef: React.MutableRefObject<planck.World | null>,
  ballsRef: React.MutableRefObject<Ball[]>,
  nextBallLevelRef: React.MutableRefObject<number>,
  trajectoryLineRef: React.MutableRefObject<TrajectoryRef | null>,
  isPaused: boolean,
  setFutureNextBallLevel: (level: number) => void
): Ball | null {
  // Если игра на паузе или нет игрока/шара - просто выходим
  if (isPaused) {
    // Игра на паузе, бросок отменен
    return null;
  }
  
  if (!playerBodyRef.current) {
    // Отсутствует тело игрока
    return null;
  }
  
  if (!currentBallRef.current) {
    // Отсутствует текущий шар для броска
    // Попытка восстановить шар
    try {
      const newLevel = generateBallLevel();
      currentBallRef.current = createNextBall(scene, playerBodyRef, newLevel);
      if (!currentBallRef.current) {
        return null;
      }
    } catch (e) {
      // Не удалось создать шар для броска
      return null;
    }
  }
  
  if (!worldRef.current) {
    // Отсутствует физический мир
    return null;
  }
  
  // Очищаем массив от null-шаров до броска - это поможет точнее определить реальное количество
  cleanupBallsArray(ballsRef);
  
  // Проверяем интервал между бросками (защита от спама)
  const now = Date.now();
  if (now - lastThrowTime < THROW_COOLDOWN) {
    // Слишком короткий интервал между бросками
    return null; // Слишком частые броски
  }
  
  // Проверяем максимальное количество шаров
  if (ballsRef.current.length >= MAX_BALLS_COUNT) {
    // Достигнуто максимальное количество шаров
    return null;
  }
  
  // Увеличиваем счетчик последовательных бросков
  consecutiveThrowsCount++;
  
  // Если было слишком много бросков подряд, добавляем большую задержку
  if (consecutiveThrowsCount > MAX_CONSECUTIVE_THROWS) {
    // Сбрасываем счетчик и добавляем дополнительную задержку
    consecutiveThrowsCount = 0;
    lastThrowTime = now + 300; // Дополнительная задержка
    // Слишком много бросков подряд, небольшая пауза для стабильности
    return null;
  }
  
  lastThrowTime = now;
  
  try {
    // Проверяем валидность текущего шара для броска
    if (!currentBallRef.current.sprite || !currentBallRef.current.sprite.container) {
      // Невалидный шар для броска (отсутствуют sprite или container)
      
      // Пытаемся пересоздать шар
      const newLevel = generateBallLevel();
      currentBallRef.current = createNextBall(scene, playerBodyRef, newLevel);
      
      // Если не удалось создать новый шар, выходим
      if (!currentBallRef.current || !currentBallRef.current.sprite || !currentBallRef.current.sprite.container) {
        // Не удалось создать новый шар после обнаружения проблемы
        return null;
      }
    }
    
    // Получаем точные координаты текущего шара для броска
    const x = currentBallRef.current.sprite.container.x;
    const y = currentBallRef.current.sprite.container.y;
    const level = currentBallRef.current.level;
    const specialType = currentBallRef.current.specialType; // Получаем тип специального шара (например, Bull)
    
    // Создаем физический шар: x, y, level, type
    
    // Безопасное создание шара - единая точка для создания физического шара
    // @ts-ignore - Игнорируем ошибку несоответствия типов Ball и LocalBall
    const ball = createBall(scene, worldRef, ballsRef, x, y, level, specialType);
    
    if (!ball || !ball.body) {
      // Не удалось создать физический шар
      return null;
    }
    
    // Применяем физические параметры к новому шару с более стабильной скоростью
    const randomXOffset = (Math.random() * 2 - 1) * THROW_X_VARIATION;
    
    // Разные скорости для разных типов шаров
    let throwVelocityY = THROW_VELOCITY_Y * 2.0; // Увеличиваем базовую скорость на 100%
    
    // Для Bull шара увеличиваем скорость и делаем более прямую траекторию
    if (specialType === 'Bull') {
      throwVelocityY = THROW_VELOCITY_Y * 2.5; // На 150% быстрее
      ball.body.setLinearVelocity(planck.Vec2(randomXOffset * 0.5, throwVelocityY)); // Более прямая траектория
    }
    // Для бомбы немного уменьшаем скорость
    else if (specialType === 'Bomb') {
      throwVelocityY = THROW_VELOCITY_Y * 1.8; // Увеличиваем скорость
      ball.body.setLinearVelocity(planck.Vec2(randomXOffset, throwVelocityY));
    }
    else {
      // Обычный шар
      ball.body.setLinearVelocity(planck.Vec2(randomXOffset, throwVelocityY));
    }
    
    // Шару придана скорость
    
    // Безопасное уничтожение текущего шара
    try {
      if (currentBallRef.current.sprite && 
          currentBallRef.current.sprite.container && 
          !currentBallRef.current.sprite.container.destroyed) {
        currentBallRef.current.sprite.container.destroy();
      }
    } catch (e) {
      // Проблема при уничтожении старого шара
      // Продолжаем выполнение, так как это некритическая ошибка
    }
    
    // Безопасное уничтожение пунктирной линии
    try {
      if (trajectoryLineRef.current) {
        trajectoryLineRef.current.destroy();
        trajectoryLineRef.current = null;
      }
    } catch (e) {
      // Проблема при уничтожении траектории
      // Продолжаем выполнение, так как это некритическая ошибка
    }
    
    // Создаем новый шар для следующего броска
    const nextBallLevel = nextBallLevelRef.current;
    
    // Если текущий шар был Bull или Bomb, для следующего шара не используем специальный тип
    const nextSpecialType = specialType === 'Bull' || specialType === 'Bomb' ? undefined : specialType;
    
    try {
      // Получаем текущую ширину игры для правильного масштабирования
      const gameWidth = scene.sys.game?.config?.width;
      
      // Создаем новый шар для броска с учетом текущего размера игры
      currentBallRef.current = createNextBall(scene, playerBodyRef, nextBallLevel, nextSpecialType);
      
      // Создан новый шар для следующего броска
      
      // Создаем новую пунктирную линию для нового шара
      if (currentBallRef.current && currentBallRef.current.sprite) {
        createTrajectoryLine(
          scene,
          trajectoryLineRef,
          currentBallRef.current.sprite.container.x,
          currentBallRef.current.sprite.container.y
        );
      }
      
      // Генерируем уровень для следующего шара
      const futureBallLevel = generateBallLevel();
      nextBallLevelRef.current = futureBallLevel;
      
      // Уведомляем интерфейс о новом будущем шаре
      setFutureNextBallLevel(futureBallLevel);
    } catch (error) {
      // Ошибка при создании следующего шара
      console.error('Ошибка при создании следующего шара:', error);
    }
    
    // Добавляем брошенный шар в список для анимаций и эффектов
    // @ts-ignore - Игнорируем ошибку несоответствия типов LocalBall и Ball
    return ball;
  } catch (error) {
    // Ошибка при броске шара
    console.error('Ошибка при броске шара:', error);
    return null;
  }
}

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

// Функция для позиционирования и задания скорости шару
// @ts-ignore - Игнорируем проблемы с совместимостью типов
export function setInitialBallPosition(
  ball: any,
  initialX: number,
  initialY: number,
  velocityX: number,
  velocityY: number
) {
  if (!ball || !ball.body) {
    console.error('Ball or ball.body is undefined');
    return;
  }

  // @ts-ignore - Игнорируем проблемы с типами для доступа к методам планка
  ball.body.setPosition(initialX, initialY);

  // @ts-ignore - Игнорируем проблемы с типами для доступа к методам планка
  ball.body.setLinearVelocity(velocityX, velocityY);

  // @ts-ignore - Игнорируем проблемы с типами для доступа к методам планка
  ball.body.setAwake(true);
}