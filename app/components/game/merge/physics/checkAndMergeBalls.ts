import * as planck from 'planck';
import { Ball, PhysicsUserData } from '../types/index';
import { getBallPhysicsSize, hasUserDataProperty } from './createBall';
import { MAX_LEVEL, MAX_BALLS_COUNT, SCALE } from '../constants/gameConstants';
import { mergeBalls } from './mergeBalls';
import { createBall } from './createBall';

// Функция для проверки, есть ли шары, помеченные для слияния
export const hasBallsMarkedForMerge = (worldRef: React.MutableRefObject<planck.World | null>): boolean => {
  if (!worldRef.current) return false;
  
  let hasMarkedBalls = false;
  let markedCount = 0;
  let body = worldRef.current.getBodyList();
  
  while (body) {
    const userData = body.getUserData() as PhysicsUserData | null;
    
    if (userData && 
        hasUserDataProperty(userData, 'shouldMerge') && 
        userData.shouldMerge === true && 
        hasUserDataProperty(userData, 'mergeWith')) {
      
      hasMarkedBalls = true;
      markedCount++;
      
      // Найден шар, помеченный для слияния
      
      if (markedCount >= 10) {
        // Найдено 10+ шаров, прекращаем поиск
        break;
      }
    }
    
    body = body.getNext();
  }
  
  if (markedCount > 0) {
    // Всего найдено {markedCount} шаров, помеченных для слияния
  }
  
  return hasMarkedBalls;
};

// Функция для проверки и объединения шаров
export const checkAndMergeBalls = (
  scene: any,
  worldRef: React.MutableRefObject<planck.World | null>,
  ballsRef: React.MutableRefObject<Ball[]>,
  frameCount: number
) => {
  if (!worldRef.current) return;
  
  // Проверяем, есть ли помеченные для слияния шары
  const hasMarked = hasBallsMarkedForMerge(worldRef);
  if (!hasMarked) {
    return;
  }
  
  // Запускаем процесс слияния помеченных шаров
  
  // Принудительная проверка всех пар шаров в мире каждые 30 кадров (около 0.5 секунды)
  const forceFullCheck = frameCount % 30 === 0;
  if (forceFullCheck) {
    // Выполняем принудительную проверку всех шаров в мире
    forceCheckAllBalls(scene, worldRef, ballsRef);
  }
  
  // Дополнительно, каждые 5 кадров проверяем шары, которые были помечены давно, но не слились
  if (frameCount % 5 === 0) {
    checkStaleMergeMarks(worldRef);
  }
  
  // Создаем Map для шаров, которые уже были обработаны для слияния
  const processedBodies = new Map<planck.Body, boolean>();
  
  // Итерируемся по всем телам в мире
  let body = worldRef.current.getBodyList();
  let mergeCounter = 0;
  
  while (body) {
    // Пропускаем уже обработанные тела
    if (processedBodies.has(body)) {
      body = body.getNext();
      continue;
    }
    
    const userData = body.getUserData() as PhysicsUserData | null;
    
    // Проверяем, помечен ли шар для слияния
    if (userData && 
        hasUserDataProperty(userData, 'shouldMerge') && 
        userData.shouldMerge === true &&
        hasUserDataProperty(userData, 'mergeWith') &&
        hasUserDataProperty(userData, 'level') &&
        userData.level !== undefined && 
        userData.level < MAX_LEVEL) {
      
      // Получаем тело, с которым нужно слиться
      const mergeWithBody = userData.mergeWith as planck.Body;
      
      // Проверяем валидность тела для слияния
      if (!mergeWithBody || !mergeWithBody.isActive() || processedBodies.has(mergeWithBody)) {
        // Убираем метку слияния, если тело для слияния не валидно или уже обработано
        body.setUserData({ ...userData, shouldMerge: false, mergeWith: null });
        body = body.getNext();
        continue;
      }
      
      // Получаем данные второго тела
      const mergeWithUserData = mergeWithBody.getUserData() as PhysicsUserData | null;
      
      // Проверяем, что уровни шаров совпадают
      if (!mergeWithUserData || 
          !hasUserDataProperty(mergeWithUserData, 'level') ||
          mergeWithUserData.level === undefined ||
          mergeWithUserData.level !== userData.level) {
        
        // Если что-то не так, убираем метку слияния
        body.setUserData({ ...userData, shouldMerge: false, mergeWith: null });
        
        if (mergeWithUserData) {
          mergeWithBody.setUserData({ ...mergeWithUserData, shouldMerge: false, mergeWith: null });
        }
        
        body = body.getNext();
        continue;
      }
      
      // Ищем шары в массиве
      const ballA = ballsRef.current.find(ball => ball && ball.body === body);
      const ballB = ballsRef.current.find(ball => ball && ball.body === mergeWithBody);
      
      // Если не нашли шары в массиве или они не подходят для слияния, пропускаем
      if (!ballA || !ballB || ballA.level !== ballB.level || ballA.level >= MAX_LEVEL) {
        body = body.getNext();
        continue;
      }
      
      // Сливаем шары уровня [ballA.level]
      
      // Выполняем слияние шаров
      const newBall = mergeBalls(scene, ballA, ballB, worldRef, ballsRef);
      
      // Если слияние было успешным, увеличиваем счетчик
      if (newBall) {
        mergeCounter++;
      }
      
      // Помечаем оба тела как обработанные
      processedBodies.set(body, true);
      processedBodies.set(mergeWithBody, true);
      
      // Если обработано больше 5 слияний за один вызов, завершаем
      if (mergeCounter >= 5) {
        // Обработано максимальное количество слияний (mergeCounter), завершаем
        break;
      }
    }
    
    body = body.getNext();
  }
  
  if (mergeCounter > 0) {
    // Выполнено [mergeCounter] слияний шаров
  }
};

// Функция для принудительной проверки всех шаров в мире
const forceCheckAllBalls = (
  scene: any,
  worldRef: React.MutableRefObject<planck.World | null>,
  ballsRef: React.MutableRefObject<Ball[]>
) => {
  if (!worldRef.current) return;
  
  const balls = ballsRef.current.filter(ball => ball && ball.body);
  // Проверяем [balls.length] шаров на возможные слияния (force check)
  
  // Проверяем каждую пару шаров
  for (let i = 0; i < balls.length; i++) {
    const ballA = balls[i];
    if (!ballA || !ballA.body) continue;
    
    for (let j = i + 1; j < balls.length; j++) {
      const ballB = balls[j];
      if (!ballB || !ballB.body) continue;
      
      // Если шары одинакового уровня и не максимального, проверяем расстояние между ними
      if (ballA.level === ballB.level && ballA.level < MAX_LEVEL) {
        const posA = ballA.body.getPosition();
        const posB = ballB.body.getPosition();
        
        // Рассчитываем расстояние между центрами шаров
        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Используем простую формулу для проверки близости шаров
        // Берем физические размеры напрямую из тел шаров
        let radiusSum = 0;
        try {
          const fixtureA = ballA.body.getFixtureList();
          const fixtureB = ballB.body.getFixtureList();
          
          if (fixtureA && fixtureB) {
            const shapeA = fixtureA.getShape();
            const shapeB = fixtureB.getShape();
            
            if (shapeA.getType() === 'circle' && shapeB.getType() === 'circle') {
              // @ts-ignore - игнорируем проверку типов здесь
              radiusSum = shapeA.getRadius() + shapeB.getRadius();
            }
          }
        } catch (e) {
          // Ошибка при получении размеров шаров
          // Используем резервное значение
          radiusSum = 2.0;
        }
        
        // Если не удалось получить радиусы, используем значение по умолчанию
        if (radiusSum <= 0) {
          radiusSum = 2.0; // Значение по умолчанию
        }
        
        // Добавляем запас к сумме радиусов
        const mergeDistance = radiusSum * 1.2;
        
        if (distance < mergeDistance) {
          // Force-check: Шары уровня [ballA.level] находятся близко, помечаем для слияния
          
          // Получаем данные шаров
          const dataA = ballA.body.getUserData() as PhysicsUserData | null;
          const dataB = ballB.body.getUserData() as PhysicsUserData | null;
          
          // Помечаем оба шара для слияния
          if (dataA) {
            ballA.body.setUserData({ 
              ...dataA, 
              shouldMerge: true, 
              mergeWith: ballB.body,
              mergeTime: Date.now()
            });
          }
          
          if (dataB) {
            ballB.body.setUserData({ 
              ...dataB, 
              shouldMerge: true, 
              mergeWith: ballA.body,
              mergeTime: Date.now()
            });
          }
          
          // Пробуждаем оба тела
          ballA.body.setAwake(true);
          ballB.body.setAwake(true);
          
          // Притягиваем шары друг к другу
          const forceMagnitude = 0.1;
          const forceX = dx > 0 ? -forceMagnitude : forceMagnitude;
          const forceY = dy > 0 ? -forceMagnitude : forceMagnitude;
          
          // Применяем силы для сближения шаров
          ballA.body.applyForceToCenter(planck.Vec2(forceX, forceY));
          ballB.body.applyForceToCenter(planck.Vec2(-forceX, -forceY));
        }
      }
    }
  }
};

// Функция для проверки шаров, которые были помечены для слияния, но не слились
const checkStaleMergeMarks = (worldRef: React.MutableRefObject<planck.World | null>) => {
  if (!worldRef.current) return;
  
  // Текущее время
  const now = Date.now();
  
  // Максимальное время ожидания слияния
  const MERGE_TIMEOUT = 3000; // 3 секунды
  
  let body = worldRef.current.getBodyList();
  let staleCount = 0;
  
  while (body) {
    const userData = body.getUserData() as PhysicsUserData | null;
    
    if (userData && 
        hasUserDataProperty(userData, 'shouldMerge') && 
        userData.shouldMerge === true && 
        hasUserDataProperty(userData, 'mergeWith') &&
        hasUserDataProperty(userData, 'mergeTime')) {
      
      // Проверяем, сколько времени прошло с момента пометки для слияния
      const timeSinceMark = now - (userData.mergeTime || 0);
      
      if (timeSinceMark > MERGE_TIMEOUT) {
        // Если прошло больше времени чем таймаут, убираем метку
        body.setUserData({ 
          ...userData, 
          shouldMerge: false, 
          mergeWith: null,
          mergeTime: undefined
        });
        
        staleCount++;
        
        // Найден старый шар, помеченный для слияния
        
        if (staleCount >= 10) {
          // Найдено 10+ старых шаров, прекращаем поиск
          break;
        }
      }
    }
    
    body = body.getNext();
  }
  
  if (staleCount > 0) {
    // Всего найдено [staleCount] старых шаров, помеченных для слияния
  }
}; 