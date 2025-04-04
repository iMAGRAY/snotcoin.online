'use client';

import { BASE_BALL_SIZE, SCALE, BASE_GAME_WIDTH, BALL_DENSITY, BALL_FRICTION, BALL_RESTITUTION } from '../constants/gameConstants';
import * as planck from 'planck';
import { ExtendedBall, ExtendedNextBall } from '../types';

// Минимальный размер шара для физики
const MIN_BALL_RADIUS = 0.45;

/**
 * Получает размер шара в пикселях для определенного уровня шара с учетом размера игры
 * @param level - Уровень шара
 * @param gameWidth - Текущая ширина игровой зоны
 * @returns Радиус шара в пикселях
 */
export const getBallSize = (level: number, gameWidth: number = BASE_GAME_WIDTH): number => {
  // Базовый радиус для шаров относительно ширины игры
  // Размер шара 1 уровня (маленький)
  const minSizeRatio = 0.05; // 5% от ширины игры для шара 1 уровня
  
  // Размер шара 12 уровня (максимально большой - примерно половина ширины)
  const maxSizeRatio = 0.24; // 24% от ширины игры для шара 12 уровня
  
  // Вычисляем шаг увеличения размера для каждого уровня
  const levelStep = (maxSizeRatio - minSizeRatio) / (12 - 1);
  
  // Определяем коэффициент размера для текущего уровня
  const sizeRatio = minSizeRatio + (level - 1) * levelStep;
  
  // Вычисляем итоговый размер в пикселях
  return Math.round(gameWidth * sizeRatio);
};

/**
 * Получает физический размер шара для коллизий
 * @param level - Уровень шара
 * @param gameWidth - Текущая ширина игровой зоны
 * @param specialType - Опциональный тип специального шара
 * @returns Физический радиус шара в единицах физического мира
 */
export const getBallPhysicsSize = (level: number, gameWidth: number = BASE_GAME_WIDTH, specialType?: string): number => {
  // Получаем визуальный размер в пикселях
  const visualSize = getBallSize(level, gameWidth);
  
  // Для физики используем немного меньший размер (85% от визуального)
  // чтобы предотвратить слишком раннее обнаружение коллизий
  let physicsSize = visualSize * 0.85 / SCALE;
  
  // Для больших шаров (уровень > 8) физическая модель должна быть еще меньше визуальной,
  // чтобы избежать проблем с застреванием
  if (level > 8) {
    physicsSize *= 0.95 - (level - 8) * 0.01; // Уменьшаем физический размер на 1% за каждый уровень выше 8
  }
  
  // Для специальных шаров делаем соответствующие корректировки
  if (specialType === 'Bull') {
    // Бык имеет немного больший физический объем для лучшего эффекта "тарана"
    physicsSize *= 1.1;
  } else if (specialType === 'Bomb') {
    // У бомбы физический размер чуть меньше визуального
    physicsSize *= 0.95;
  }
  
  // Убедимся, что физический размер не меньше минимально допустимого
  return Math.max(physicsSize, MIN_BALL_RADIUS);
};

/**
 * Проверяет наличие свойства в userData объекта
 * @param obj - объект с потенциальным свойством userData
 * @param property - название свойства для проверки
 * @returns {boolean} - true если свойство существует в userData
 */
export const hasUserDataProperty = (obj: any, property: string): boolean => {
  if (!obj || !obj.userData) return false;
  return Object.prototype.hasOwnProperty.call(obj.userData, property);
};

/**
 * Обновляет позиции шаров при изменении размера игры
 * @param ballsRef - ссылка на массив шаров
 * @param currentBallRef - ссылка на текущий шар
 * @param worldRef - ссылка на физический мир
 * @param newWidth - новая ширина игры
 * @param oldWidth - старая ширина игры
 */
export const updateBallsOnResize = (
  ballsRef: React.MutableRefObject<ExtendedBall[]>,
  currentBallRef: React.MutableRefObject<ExtendedNextBall | null>,
  worldRef: React.MutableRefObject<planck.World | null>,
  newWidth: number,
  oldWidth: number
): void => {
  if (!worldRef.current) return;

  // Коэффициент масштабирования
  const scaleRatio = newWidth / oldWidth;

  // Обновляем все шары в игре
  ballsRef.current.forEach(ball => {
    if (ball && ball.body && ball.sprite && ball.sprite.container) {
      try {
        // Получаем текущую позицию шара
        const position = ball.body.getPosition();
        
        // Масштабируем только X-координату (горизонтальную позицию)
        const newX = position.x * scaleRatio;
        
        // Устанавливаем новую позицию
        ball.body.setPosition(planck.Vec2(newX, position.y));
        
        // Обновляем физический размер шара, если необходимо
        const fixtures = ball.body.getFixtureList();
        if (fixtures) {
          // Масштабируем размер шара, если это круг
          const shape = fixtures.getShape();
          if (shape.getType() === 'circle') {
            // Используем безопасное приведение типа через as unknown
            const circleShape = shape as any;
            const newRadius = circleShape.getRadius() * scaleRatio;
            circleShape.m_radius = newRadius;
          }
        }

        // Обновляем спрайт
        const spriteScale = 1 * scaleRatio;
        ball.sprite.container.setScale(spriteScale);
      } catch (error) {
        console.error('Ошибка при обновлении шара:', error);
      }
    }
  });

  // Обновляем текущий шар для броска, если он существует
  if (currentBallRef.current) {
    try {
      const currentBall = currentBallRef.current;
      if (currentBall.sprite && currentBall.sprite.container) {
        const spriteScale = 1 * scaleRatio;
        currentBall.sprite.container.setScale(spriteScale);
      }
    } catch (error) {
      console.error('Ошибка при обновлении текущего шара:', error);
    }
  }
}; 