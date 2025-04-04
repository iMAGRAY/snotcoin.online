'use client'

import { ExtendedBall } from '../types';
import * as planck from 'planck';

/**
 * Создает обработчик для шара типа "Bull"
 */
export const createBullBallHandler = (
  canUseSpecialFeature: (type: string) => boolean,
  deductResourceCost: (type: string) => void,
  setBullUsed: React.Dispatch<React.SetStateAction<boolean>>,
  setSpecialBallType: React.Dispatch<React.SetStateAction<string | null>>,
  currentBallRef: React.MutableRefObject<any>,
  dispatch: any
) => {
  return () => {
    const type = 'Bull';
    
    // Проверяем, достаточно ли ресурсов
    if (!canUseSpecialFeature(type)) {
      console.log(`Недостаточно ресурсов для использования ${type}`);
      return;
    }
    
    // Списываем стоимость
    deductResourceCost(type);
    
    // Устанавливаем флаг использования Bull
    setBullUsed(false);
    
    // Устанавливаем тип специального шара
    setSpecialBallType(type);
    
    console.log(`Специальный шар ${type} активирован`);
  };
};

/**
 * Создает обработчик для шара типа "Bomb"
 */
export const createBombBallHandler = (
  canUseSpecialFeature: (type: string) => boolean,
  deductResourceCost: (type: string) => void,
  setSpecialBallType: React.Dispatch<React.SetStateAction<string | null>>,
  currentBallRef: React.MutableRefObject<any>,
  dispatch: any
) => {
  return () => {
    const type = 'Bomb';
    
    // Проверяем, достаточно ли ресурсов
    if (!canUseSpecialFeature(type)) {
      console.log(`Недостаточно ресурсов для использования ${type}`);
      return;
    }
    
    // Списываем стоимость
    deductResourceCost(type);
    
    // Устанавливаем тип специального шара
    setSpecialBallType(type);
    
    console.log(`Специальный шар ${type} активирован`);
  };
};

/**
 * Создает обработчик для эффекта "Joy" (радость), который придает случайный импульс всем шарам
 */
export const createImpulseJoyEffectHandler = (
  canUseSpecialFeature: (type: string) => boolean,
  deductResourceCost: (type: string) => void,
  ballsRef: React.MutableRefObject<ExtendedBall[]>,
  worldRef: React.MutableRefObject<planck.World | null>,
  containerCapacity: number,
  specialCosts: Record<string, number>
) => {
  return () => {
    const type = 'Joy';
    
    // Проверяем, достаточно ли ресурсов
    if (!canUseSpecialFeature(type)) {
      console.log(`Недостаточно ресурсов для использования эффекта Joy`);
      return;
    }
    
    // Проверяем наличие шаров
    if (ballsRef.current.length === 0) {
      console.log('Нет шаров для применения эффекта Joy');
      return;
    }
    
    // Списываем стоимость
    deductResourceCost(type);
    
    console.log('Применяем эффект Joy ко всем шарам');
    
    // Применяем случайный импульс ко всем шарам
    ballsRef.current.forEach(ball => {
      if (ball && ball.body && ball.body.isActive()) {
        // Генерируем случайный импульс
        const randomAngle = Math.random() * Math.PI * 2; // Случайный угол в радианах
        const randomMagnitude = 0.5 + Math.random() * 1.5; // Случайная сила импульса
        
        const impulseX = Math.cos(randomAngle) * randomMagnitude;
        const impulseY = Math.sin(randomAngle) * randomMagnitude;
        
        // Применяем импульс к центру шара
        ball.body.applyLinearImpulse(
          planck.Vec2(impulseX, impulseY),
          ball.body.getWorldCenter()
        );
        
        // Пробуждаем тело, если оно спало
        ball.body.setAwake(true);
      }
    });
  };
}; 