import { useRef, useEffect } from 'react';
import * as planck from 'planck';
import { PhysicsUserData } from '../types/index';
import { hasUserDataProperty } from '../utils/ballUtils';
import { 
  MAX_LEVEL, 
  BALL_RESTITUTION, 
  BALL_FRICTION, 
  GRAVITY_Y,
  SCALE,
  BASE_GAME_WIDTH,
  PLAYER_SIZE,
  PHYSICS_PLAYER_Y
} from '../constants/gameConstants';
import { createPhysicsWorld, resetAndCreateWorld } from '../physics/world';

// Переменная для ограничения проверок коллизий
const MAX_CONTACT_CHECKS = 10; // Оптимизировано для производительности

// Тип интерфейса для результата хука
export interface PhysicsRefs {
  worldRef: React.MutableRefObject<planck.World | null>;
  playerBodyRef: React.MutableRefObject<planck.Body | null>;
  leftWallRef: React.MutableRefObject<planck.Body | null>;
  rightWallRef: React.MutableRefObject<planck.Body | null>;
  topWallRef: React.MutableRefObject<planck.Body | null>;
  floorRef: React.MutableRefObject<planck.Body | null>;
  createWalls: (gameWidth: number, gameHeight: number) => void;
  resetWorld: () => void;
}

/**
 * Хук для создания и управления физическим миром planck.js
 * @returns Объект с ссылками на физический мир и тела
 */
export const usePhysicsWorld = (): PhysicsRefs => {
  // Создаем ссылки на физический мир и тела
  const worldRef = useRef<planck.World | null>(null);
  const playerBodyRef = useRef<planck.Body | null>(null);
  const leftWallRef = useRef<planck.Body | null>(null);
  const rightWallRef = useRef<planck.Body | null>(null);
  const topWallRef = useRef<planck.Body | null>(null);
  const floorRef = useRef<planck.Body | null>(null);
  
  // Счетчик проверок коллизий для ограничения вычислений
  const contactCountRef = useRef<number>(0);
  
  // Время последней проверки коллизий
  const lastContactCheckRef = useRef<number>(0);

  // Размеры игры по умолчанию
  const defaultWidth = BASE_GAME_WIDTH;
  const defaultHeight = defaultWidth * 1.335; // соотношение сторон 2:2.67
  
  /**
   * Создает границы игрового мира (стены и пол)
   * @param gameWidth Ширина игрового мира в пикселях
   * @param gameHeight Высота игрового мира в пикселях
   */
  const createWalls = (gameWidth: number = defaultWidth, gameHeight: number = defaultHeight) => {
    if (!worldRef.current) return;
    
    console.log(`Создание физических границ для размера: ${gameWidth}x${gameHeight}`);
    
    const world = worldRef.current;
    
    // Удаляем старые стены, если они существуют
    if (leftWallRef.current) {
      try {
        world.destroyBody(leftWallRef.current);
      } catch (e) {
        // Ошибка при удалении тела
      }
    }
    
    if (rightWallRef.current) {
      try {
        world.destroyBody(rightWallRef.current);
      } catch (e) {
        // Ошибка при удалении тела
      }
    }
    
    if (topWallRef.current) {
      try {
        world.destroyBody(topWallRef.current);
      } catch (e) {
        // Ошибка при удалении тела
      }
    }
    
    if (floorRef.current) {
      try {
        world.destroyBody(floorRef.current);
      } catch (e) {
        // Ошибка при удалении тела
      }
    }
      
    // Конвертируем размеры из пикселей в физические единицы
    const width = gameWidth / SCALE;
    const height = gameHeight / SCALE;
    
    // Толщина стенок - масштабируем в зависимости от размера игры
    const wallThickness = Math.max(10 / SCALE, 0.2);
        
    // Создаем левую стену
    leftWallRef.current = world.createBody({
      type: 'static',
      position: planck.Vec2(-wallThickness / 2, height / 2),
      userData: { type: 'wall', isWall: true }
          });
          
    // Создаем форму для левой стены
    const leftWallShape = planck.Box(wallThickness / 2, height / 2);
    
    // Добавляем фикстуру к телу левой стены
    leftWallRef.current.createFixture({
      shape: leftWallShape,
      friction: 0.3,
      restitution: 0.4
    });
          
    // Создаем правую стену
    rightWallRef.current = world.createBody({
      type: 'static',
      position: planck.Vec2(width + wallThickness / 2, height / 2),
      userData: { type: 'wall', isWall: true }
    });
    
    // Создаем форму для правой стены
    const rightWallShape = planck.Box(wallThickness / 2, height / 2);
    
    // Добавляем фикстуру к телу правой стены
    rightWallRef.current.createFixture({
      shape: rightWallShape,
      friction: 0.3,
      restitution: 0.4
    });
    
    // Создаем верхнюю стену
    topWallRef.current = world.createBody({
      type: 'static',
      position: planck.Vec2(width / 2, -wallThickness / 2),
      userData: { type: 'top_wall', isWall: true }
    });
    
    // Создаем форму для верхней стены
    const topWallShape = planck.Box(width / 2, wallThickness / 2);
    
    // Добавляем фикстуру к телу верхней стены
    topWallRef.current.createFixture({
      shape: topWallShape,
      friction: 0.1,
      restitution: 0.8
    });
      
    // Создаем пол
    floorRef.current = world.createBody({
      type: 'static',
      position: planck.Vec2(width / 2, height + wallThickness / 2),
      userData: { type: 'floor', isFloor: true }
    });
      
    // Создаем форму для пола
    const floorShape = planck.Box(width / 2, wallThickness / 2);
    
    // Добавляем фикстуру к телу пола
    floorRef.current.createFixture({
      shape: floorShape,
      friction: 0.5,
      restitution: 0.2
    });
        
    // Создаем тело игрока (для броска шаров)
    const playerSize = PLAYER_SIZE / SCALE;
    
    // Если тело игрока уже существует, удаляем его
    if (playerBodyRef.current) {
      try {
        world.destroyBody(playerBodyRef.current);
      } catch (e) {
        // Ошибка при удалении тела игрока
      }
    }
    
    // Создаем новое тело игрока с правильной позицией
    playerBodyRef.current = world.createBody({
      type: 'static',
      position: planck.Vec2(width / 2, PHYSICS_PLAYER_Y),
      userData: { type: 'player', isPlayer: true }
    });
    
    // Создаем форму для тела игрока
    const playerShape = planck.Circle(playerSize / 2);
    
    // Добавляем фикстуру к телу игрока
    playerBodyRef.current.createFixture({
      shape: playerShape,
      friction: 0.3,
      restitution: 0.5
    });
    
    console.log(`Физические границы созданы успешно: ${width}x${height} (в физических единицах)`);
  };
  
  /**
   * Сбрасывает физический мир, удаляя все тела и пересоздавая мир
   */
  const resetWorld = () => {
        try {
      // Очищаем все тела
      if (worldRef.current) {
        let body = worldRef.current.getBodyList();
        while (body) {
          const next = body.getNext();
          try {
            worldRef.current.destroyBody(body);
        } catch (e) {
            // Ошибка при удалении тела
        }
          body = next;
      }
      }
      
      // Пересоздаем мир
      worldRef.current = createPhysicsWorld(GRAVITY_Y);
    
      // Создаем стены для нового мира
      createWalls();
    } catch (e) {
      // Ошибка при очистке физического мира
    }
  };
  
  // Инициализируем физический мир при монтировании компонента
  useEffect(() => {
    // Создаем физический мир
    worldRef.current = createPhysicsWorld(GRAVITY_Y);
    
    // Создаем стены для мира по умолчанию
    createWalls();
    
    // Очищаем ресурсы при размонтировании компонента
    return () => {
      if (worldRef.current) {
        let body = worldRef.current.getBodyList();
          
        // Удаляем все тела из мира
          while (body) {
          const next = body.getNext();
            try {
              worldRef.current.destroyBody(body);
            } catch (e) {
            // Ошибка при удалении тела во время размонтирования
            }
          body = next;
          }
          
        // Освобождаем ссылку на мир
          worldRef.current = null;
      }
    };
  }, []);

  // Возвращаем объект с ссылками на физический мир и тела
  return {
    worldRef,
    playerBodyRef,
    leftWallRef,
    rightWallRef,
    topWallRef,
    floorRef,
    createWalls,
    resetWorld
  };
}; 