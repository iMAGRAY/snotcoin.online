'use client'

import { Ball, ExtendedBall } from '../types/index';
import planck from 'planck';

/**
 * Удаляет один шар из игры
 * @param ball Шар для удаления
 * @param ballsRef Ссылка на массив шаров
 * @param worldRef Ссылка на физический мир planck
 */
export const removeBall = (
  ball: ExtendedBall,
  ballsRef: React.MutableRefObject<ExtendedBall[]>,
  worldRef: React.MutableRefObject<planck.World | null>,
) => {
  if (!ball) {
    console.warn("Попытка удаления несуществующего шара");
    return;
  }
  
  console.log(`🔥 УДАЛЕНИЕ ШАРА: уровень ${ball.level}, тип ${ball.specialType || 'обычный'}`);
  
  // Принудительно фильтруем массив, чтобы сразу исключить шар из будущих обработок
  ballsRef.current = ballsRef.current.filter(b => b !== ball);
  
  // 1. Сначала удаляем все визуальные компоненты шара НЕМЕДЛЕННО
  if (ball.sprite) {
    try {
      // Для шаров с эффектами
      if (ball.sprite.effectsContainer && !ball.sprite.effectsContainer.destroyed) {
        console.log(`Удаляем контейнер эффектов шара уровня ${ball.level}`);
        ball.sprite.effectsContainer.destroy();
      }
      
      // Удаляем основной контейнер
      if (ball.sprite.container && !ball.sprite.container.destroyed) {
        console.log(`Удаляем визуальный контейнер шара уровня ${ball.level}`);
        // Принудительно удаляем все дочерние элементы
        if (ball.sprite.container.list && Array.isArray(ball.sprite.container.list)) {
          ball.sprite.container.list.forEach((child: any) => {
            if (child && !child.destroyed) {
              child.destroy();
            }
          });
        }
        ball.sprite.container.destroy();
      }
      
      // Явно устанавливаем все спрайты в null
      ball.sprite.container = null;
      ball.sprite.circle = null;
      ball.sprite.text = null;
      if (ball.sprite.effectsContainer) ball.sprite.effectsContainer = null;
    } catch (e) {
      console.error(`Ошибка при удалении визуальных элементов шара уровня ${ball.level}:`, e);
    }
  }
  
  // 2. Затем удаляем физическое тело
  if (ball.body && worldRef.current) {
    try {
      // Проверяем, активно ли еще тело
      const isBodyActive = ball.body.isActive();
      
      // Очищаем пользовательские данные
      ball.body.setUserData(null);
      
      // Останавливаем тело
      ball.body.setLinearVelocity({ x: 0, y: 0 });
      ball.body.setAngularVelocity(0);
      
      // Отключаем физику
      ball.body.setActive(false);
      ball.body.setAwake(false);
      
      // Удаляем все фикстуры
      let fixture = ball.body.getFixtureList();
      while (fixture) {
        const nextFixture = fixture.getNext();
        ball.body.destroyFixture(fixture);
        fixture = nextFixture;
      }
      
      // Удаляем тело из мира, если оно еще активно
      if (isBodyActive) {
        console.log(`Удаляем физическое тело шара уровня ${ball.level}`);
        try {
          worldRef.current.destroyBody(ball.body);
        } catch (e) {
          console.error(`Ошибка при удалении физического тела: ${e}`);
        }
      }
      
      // Явное освобождение памяти
      ball.body = null as any;
    } catch (e) {
      console.error(`Ошибка при удалении физического тела шара уровня ${ball.level}:`, e);
    }
  }
  
  // 3. Очищаем все ссылки в объекте шара
  Object.keys(ball).forEach(key => {
    (ball as any)[key] = null;
  });
  
  // 4. Ещё раз убеждаемся, что шар удалён из массива
  const stillExists = ballsRef.current.some(b => b === ball);
  if (stillExists) {
    console.error(`⚠️ ШАР ВСЁ ЕЩЁ СУЩЕСТВУЕТ В МАССИВЕ! Принудительно очищаем...`);
    ballsRef.current = ballsRef.current.filter(b => b !== ball);
  }
  
  // 5. Проверяем и удаляем все "мёртвые" шары без физических тел
  const invalidBalls = ballsRef.current.filter(b => !b || !b.body);
  if (invalidBalls.length > 0) {
    console.warn(`Найдено ${invalidBalls.length} шаров без физических тел, очищаем...`);
    ballsRef.current = ballsRef.current.filter(b => b && b.body);
  }
  
  // Пробуем явно вызвать сборщик мусора (если доступен)
  if (typeof global !== 'undefined' && global.gc) {
    try {
      global.gc();
    } catch (e) {
      console.warn("Не удалось запустить сборщик мусора:", e);
    }
  }
};

/**
 * Находит шары с самыми нижними позициями
 * @param ballsRef Ссылка на массив шаров
 * @param count Количество шаров для поиска
 * @returns Массив найденных шаров
 */
export const findBottomBalls = (
  ballsRef: React.MutableRefObject<ExtendedBall[]>,
  count: number
): ExtendedBall[] => {
  if (!ballsRef.current.length) return [];
  
  // Создаем копию массива шаров и сортируем по Y-координате (самые нижние вначале)
  return [...ballsRef.current]
    .filter(ball => ball && ball.body)
    .sort((a, b) => {
      if (!a.body || !b.body) return 0;
      return b.body.getPosition().y - a.body.getPosition().y;
    })
    .slice(0, count);
};

/**
 * Удаляет указанные шары из игры
 * @param balls Массив шаров для удаления
 * @param ballsRef Ссылка на массив всех шаров
 * @param worldRef Ссылка на физический мир planck
 * @param potentiallyStuckBallsRef Ссылка на карту потенциально зависших шаров
 */
export const removeMultipleBalls = (
  balls: Ball[],
  ballsRef: React.MutableRefObject<ExtendedBall[]>,
  worldRef: React.MutableRefObject<planck.World | null>,
  potentiallyStuckBallsRef: React.MutableRefObject<Map<ExtendedBall, number>>
) => {
  if (!balls.length) return;
  
  for (const ball of balls) {
    if (!ball) continue;
    
    // Используем функцию removeBall для единообразного удаления
    removeBall(ball as ExtendedBall, ballsRef, worldRef);
    
    // Удаляем шар из списка потенциально зависших
    potentiallyStuckBallsRef.current.delete(ball as ExtendedBall);
  }
  
  // Обновляем массив шаров - удаляем все удаленные шары
  ballsRef.current = ballsRef.current.filter(ball => 
    ball && balls.indexOf(ball as Ball) === -1
  );
  
  // Запускаем явную очистку мусора
  if (typeof global !== 'undefined' && global.gc) {
    try {
      global.gc();
    } catch (e) {
      console.warn("Не удалось запустить сборщик мусора:", e);
    }
  }
}; 