import * as planck from 'planck';
import { Ball, PhysicsUserData } from '../types';
import { getBallPhysicsSize } from '../utils/ballUtils';
import { MAX_LEVEL, MAX_BALLS_COUNT, SCALE } from '../constants/gameConstants';
import { mergeBalls } from './mergeBalls';
import { createBall } from './createBall';
import { hasUserDataProperty } from '../utils/ballUtils';

// Функция для проверки, есть ли шары, помеченные для слияния
export const hasBallsMarkedForMerge = (worldRef: React.MutableRefObject<planck.World | null>): boolean => {
  if (!worldRef.current) return false;
  
  let hasMarkedBalls = false;
  let body = worldRef.current.getBodyList();
  
  while (body) {
    const userData = body.getUserData() as PhysicsUserData | null;
    
    if (userData && hasUserDataProperty(userData, 'shouldMerge') && 
        hasUserDataProperty(userData, 'mergeWith')) {
      hasMarkedBalls = true;
      break;
    }
    
    body = body.getNext();
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
  
  // Всегда проверяем, есть ли помеченные для слияния шары
  if (!hasBallsMarkedForMerge(worldRef)) return;
  
  // Создаем Map для шаров, которые уже были обработаны для слияния
  const processedBodies = new Map<planck.Body, boolean>();
  
  // Итерируемся по всем телам в мире
  let body = worldRef.current.getBodyList();
  
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
      
      // Выполняем слияние шаров
      mergeBalls(scene, ballA, ballB, worldRef, ballsRef);
      
      // Помечаем оба тела как обработанные
      processedBodies.set(body, true);
      processedBodies.set(mergeWithBody, true);
    }
    
    body = body.getNext();
  }
}; 