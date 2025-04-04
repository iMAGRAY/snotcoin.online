'use client'

import { ExtendedBall, ExtendedNextBall } from '../types';
import * as planck from 'planck';
import { createNextBall } from '../physics/createNextBall';
import { FIXED_PLAYER_Y } from '../constants/gameConstants';

/**
 * Создает обработчик для шара типа "Bull"
 */
export const createBullBallHandler = (
  canUseSpecialFeature: (type: string) => boolean,
  deductResourceCost: (type: string) => void,
  setBullUsed: React.Dispatch<React.SetStateAction<boolean>>,
  setSpecialBallType: React.Dispatch<React.SetStateAction<string | null>>,
  currentBallRef: React.MutableRefObject<any>,
  dispatch: any,
  bullUsed: boolean
) => {
  return () => {
    const type = 'Bull';
    
    console.log('Bull handler called', {
      hasResources: canUseSpecialFeature(type),
      bullUsed,
      currentBallExists: !!currentBallRef.current,
      spriteExists: !!(currentBallRef.current?.sprite),
      containerExists: !!(currentBallRef.current?.sprite?.container)
    });
    
    // Проверяем, достаточно ли ресурсов
    if (!canUseSpecialFeature(type)) {
      console.log(`Недостаточно ресурсов для использования ${type}`);
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: 'Недостаточно SnotCoin для использования Bull',
          type: 'error',
          duration: 2000
        }
      });
      return;
    }
    
    // Проверяем, был ли уже использован Bull в этой игре
    if (bullUsed) {
      console.log('Bull уже был использован в этой игре');
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: 'Bull уже был использован в этой игре',
          type: 'warning',
          duration: 2000
        }
      });
      return;
    }
    
    // Списываем стоимость
    deductResourceCost(type);
    
    // Устанавливаем флаг использования Bull
    setBullUsed(true);
    
    // Устанавливаем тип специального шара
    setSpecialBallType(type);
    
    // Получаем текущую сцену из ссылки текущего шара
    if (currentBallRef.current && currentBallRef.current.sprite && currentBallRef.current.sprite.container) {
      try {
        // Получаем сцену
        const scene = currentBallRef.current.sprite.container.scene;
        console.log('Got scene object:', !!scene);
        const playerBodyRef = { current: scene.playerBodyRef?.current || null };
        
        // Уничтожаем текущий шар, если он есть
        if (currentBallRef.current.sprite.container && !currentBallRef.current.sprite.container.destroyed) {
          currentBallRef.current.sprite.container.destroy();
        }
        
        // Создаем новый шар Bull
        currentBallRef.current = createNextBall(scene, playerBodyRef, 1, 'Bull');
        console.log('Created Bull ball:', !!currentBallRef.current);
        
        dispatch({
          type: 'SHOW_NOTIFICATION',
          payload: {
            message: 'Bull активирован! Бросьте чтобы использовать',
            type: 'success',
            duration: 2000
          }
        });
        
        console.log(`Специальный шар ${type} активирован`, currentBallRef.current);
      } catch (error) {
        console.error('Ошибка при создании Bull шара:', error);
        dispatch({
          type: 'SHOW_NOTIFICATION',
          payload: {
            message: 'Ошибка при активации Bull',
            type: 'error',
            duration: 2000
          }
        });
      }
    } else {
      console.error('Невозможно создать Bull: отсутствует контейнер сцены', {
        currentBallRef: currentBallRef.current,
        sprite: currentBallRef.current?.sprite,
        container: currentBallRef.current?.sprite?.container
      });
      
      // Попробуем получить сцену другим способом
      let alternativeScene = null;
      try {
        // Пытаемся получить сцену через gameInstance, если она доступна в глобальном контексте
        if (typeof window !== 'undefined' && (window as any).gameInstance && 
            (window as any).gameInstance.scene && (window as any).gameInstance.scene.scenes) {
          alternativeScene = (window as any).gameInstance.scene.scenes[0];
          console.log('Found alternative scene:', !!alternativeScene);
        }
      } catch (e) {
        console.error('Ошибка при поиске альтернативной сцены:', e);
      }
    }
  };
};

/**
 * Создает обработчик для шара типа "Bomb"
 */
export const createBombBallHandler = (
  currentBallRef: React.MutableRefObject<ExtendedNextBall | null>,
  canUseSpecialFeature: (type: string) => boolean,
  deductResourceCost: (type: string) => void,
  setSpecialBallType: React.Dispatch<React.SetStateAction<string | null>>,
  dispatch: any
): (() => void) => {
  return () => {
    console.log('Вызван обработчик Bomb шара');
    const type = 'Bomb';
    
    // Проверяем, достаточно ли ресурсов
    if (!canUseSpecialFeature(type)) {
      console.log('Недостаточно ресурсов для использования Bomb');
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: {
          type: 'error',
          message: 'Недостаточно SnotCoins для использования Bomb'
        }
      });
      return;
    }
    
    // Вычитаем стоимость
    deductResourceCost(type);
    
    // Устанавливаем специальный тип шара
    setSpecialBallType(type);
    
    // Получаем доступ к сцене и текущему шару
    try {
      // Проверяем, есть ли текущий шар
      if (!currentBallRef.current) {
        console.error('Нет текущего шара для замены на Bomb');
        return;
      }
      
      // Получаем сцену из текущего шара
      const scene = currentBallRef.current.sprite?.container?.scene;
      
      if (!scene) {
        console.error('Не удалось получить сцену');
        return;
      }
      
      // Удаляем старый шар
      if (currentBallRef.current.sprite && 
          currentBallRef.current.sprite.container && 
          !currentBallRef.current.sprite.container.destroyed) {
        currentBallRef.current.sprite.container.destroy();
      }
      
      console.log('Создаем новый шар Bomb');
      
      // Создаем новый шар с типом Bomb
      const newBall = createNextBall(scene, {
        current: {
          getPosition: () => ({ 
            x: currentBallRef.current?.body ? 
               currentBallRef.current.body.getPosition().x : 
               scene.sys.game.config.width / 2 / 30, 
            y: currentBallRef.current?.body ? 
               currentBallRef.current.body.getPosition().y : 
               FIXED_PLAYER_Y / 30
          })
        }
      }, currentBallRef.current.level, type);
      
      // Обновляем текущий шар
      currentBallRef.current = newBall;
      
      // Устанавливаем exploded = false явно, чтобы убедиться, что флаг существует
      if (currentBallRef.current) {
        currentBallRef.current.userData = {
          ...currentBallRef.current.userData,
          specialType: type,
          exploded: false
        };
        console.log('Бомба создана с userData:', currentBallRef.current.userData);
      }
      
      // Показываем уведомление
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: {
          type: 'success',
          message: 'Bomb активирована!'
        }
      });
    } catch (error) {
      console.error('Ошибка при создании Bomb шара:', error);
    }
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
    
    // Проверяем наличие шаров и мира физики
    if (ballsRef.current.length === 0 || !worldRef.current) {
      console.log('Нет шаров или физического мира для применения эффекта Joy');
      return;
    }
    
    // Списываем стоимость
    deductResourceCost(type);
    
    console.log('Применяем эффект Joy ко всем шарам');
    
    // Добавляем эффект встряски всех шаров
    const shakeBalls = () => {
      // Применяем случайный импульс ко всем шарам
      ballsRef.current.forEach(ball => {
        if (ball && ball.body && ball.body.isActive()) {
          try {
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
            
            // Если у шара есть спрайт, добавляем анимацию подсветки
            if (ball.sprite && ball.sprite.container && !ball.sprite.container.destroyed) {
              const scene = ball.sprite.container.scene;
              
              // Определяем размер сияния на основе размера спрайта или по умолчанию
              const glowSize = (ball.sprite.circle && ball.sprite.circle.width) 
                ? ball.sprite.circle.width * 0.6  // Используем размер спрайта
                : 20; // Значение по умолчанию
              
              // Создаем эффект вспышки
              const glow = scene.add.circle(
                ball.sprite.container.x,
                ball.sprite.container.y,
                glowSize,
                0x00ffff,
                0.7
              );
              
              // Анимируем исчезновение вспышки
              scene.tweens.add({
                targets: glow,
                alpha: 0,
                scale: 1.5,
                duration: 300,
                onComplete: () => {
                  glow.destroy();
                }
              });
            }
          } catch (error) {
            console.error('Ошибка при применении импульса к шару:', error);
          }
        }
      });
    };
    
    // Применяем эффект в три волны для более интересного визуального эффекта
    shakeBalls();
    setTimeout(shakeBalls, 200);
    setTimeout(shakeBalls, 400);
  };
}; 