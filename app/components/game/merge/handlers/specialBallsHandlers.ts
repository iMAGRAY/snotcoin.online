'use client'

import planck from 'planck';
import { ExtendedBall, ExtendedNextBall } from '../types/index';

/**
 * Создает обработчик для применения Bull шара
 */
export const createBullBallHandler = (
  canUseSpecialFeature: (type: string) => boolean,
  deductResourceCost: (type: string) => void,
  setBullUsed: (state: boolean) => void,
  setSpecialBallType: (type: string | null) => void,
  currentBallRef: React.MutableRefObject<ExtendedNextBall | null>,
  dispatch: any
) => {
  return () => {
    // Проверяем, можно ли использовать способность
    if (!canUseSpecialFeature('Bull')) {
      console.log('Недостаточно ресурсов для использования способности Bull');
      return;
    }
    
    // Списываем стоимость
    deductResourceCost('Bull');
    
    // Отмечаем Bull как использованный (до следующего перезапуска игры)
    setBullUsed(true);
    
    // Устанавливаем тип специального шара
    setSpecialBallType('Bull');
    
    // Если шар уже создан, устанавливаем его тип как Bull
    if (currentBallRef.current) {
      // Сохраняем уровень текущего шара, который меняем на Bull
      dispatch({
        type: 'LOG_SPECIAL_BALL_USE',
        payload: {
          тип: 'Bull',
          уровень: currentBallRef.current.level
        }
      });
    } else {
      console.error('Ошибка: currentBallRef.current is null после создания шара Bull');
    }
  };
};

/**
 * Создает обработчик для применения Bomb шара
 */
export const createBombBallHandler = (
  canUseSpecialFeature: (type: string) => boolean,
  deductResourceCost: (type: string) => void,
  setSpecialBallType: (type: string | null) => void,
  currentBallRef: React.MutableRefObject<ExtendedNextBall | null>,
  dispatch: any
) => {
  return () => {
    // Проверяем, можно ли использовать способность
    if (!canUseSpecialFeature('Bomb')) {
      console.log('Недостаточно ресурсов для использования способности Bomb');
      return;
    }
    
    // Списываем стоимость
    deductResourceCost('Bomb');
    
    // Устанавливаем тип специального шара
    setSpecialBallType('Bomb');
    
    // Если шар уже создан, устанавливаем его тип как Bomb
    if (currentBallRef.current) {
      // Сохраняем уровень текущего шара, который меняем на Bomb
      dispatch({
        type: 'LOG_SPECIAL_BALL_USE',
        payload: {
          тип: 'Bomb',
          уровень: currentBallRef.current.level
        }
      });
    } else {
      console.error('Ошибка: currentBallRef.current is null после создания шара Bomb');
    }
  };
};

/**
 * Создает обработчик для применения эффекта Joy (радости)
 */
export const createJoyEffectHandler = (
  canUseSpecialFeature: (type: string) => boolean,
  deductResourceCost: (type: string) => void,
  findBottomBalls: (count: number) => ExtendedBall[],
  removeBottomBalls: (balls: ExtendedBall[]) => void,
  dispatch: any
) => {
  return () => {
    // Проверяем, можно ли использовать способность
    if (!canUseSpecialFeature('Joy')) {
      console.log('Недостаточно ресурсов для использования способности Joy');
      return;
    }
    
    // Списываем стоимость
    deductResourceCost('Joy');
    
    // Находим нижние шары (до 3) для удаления
    const ballsToRemove = findBottomBalls(3);
    
    // Если найдены шары для удаления
    if (ballsToRemove.length > 0) {
      // Сохраняем уровни удаляемых шаров
      const removedLevels = ballsToRemove.map(ball => 
        ball.level || 0
      ).filter(level => level > 0);
      
      // Логируем информацию об использовании Joy
      dispatch({
        type: 'LOG_SPECIAL_BALL_USE',
        payload: {
          тип: 'Joy',
          удалено: removedLevels.length,
          уровни: removedLevels
        }
      });
      
      // Удаляем эти шары
      removeBottomBalls(ballsToRemove);
    } else {
      console.log('Не найдены шары для удаления с помощью Joy');
    }
  };
};

/**
 * Создает обработчик для применения эффекта Joy через импульсы
 */
export const createImpulseJoyEffectHandler = (
  canUseSpecialFeature: (type: string) => boolean,
  deductResourceCost: (type: string) => void,
  ballsRef: React.MutableRefObject<ExtendedBall[]>,
  worldRef: React.MutableRefObject<planck.World | null>,
  containerCapacity: number,
  specialCosts: { [key: string]: number }
) => {
  return () => {
    // Проверяем, достаточно ли ресурсов для использования Joy
    if (!canUseSpecialFeature('Joy')) {
      const joyPercentage = specialCosts.Joy || 0;
      const actualCost = (joyPercentage / 100) * containerCapacity;
      console.log(`Недостаточно SnotCoin для использования Joy. Требуется ${actualCost.toFixed(4)}`);
      return; // Выходим, если ресурсов недостаточно
    }
    
    // Списываем стоимость использования Joy
    deductResourceCost('Joy');
    
    if (!worldRef.current) return;
    
    // Применяем случайный импульс к каждому шару
    ballsRef.current.forEach(ball => {
      if (ball && ball.body) {
        // Генерируем случайный вектор силы
        const forceX = (Math.random() * 2 - 1) * 0.5; // от -0.5 до 0.5
        const forceY = (Math.random() * 2 - 1) * 0.5; // от -0.5 до 0.5
        
        // Применяем импульс к шару
        ball.body.applyLinearImpulse(planck.Vec2(forceX, forceY), ball.body.getPosition());
        ball.body.setAwake(true); // Убеждаемся, что шар активен
      }
    });
  };
}; 