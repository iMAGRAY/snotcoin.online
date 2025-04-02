import * as planck from 'planck';
import { PhysicsWorldProps } from '../types';
import { PLAYER_SIZE, PHYSICS_PLAYER_Y, FIXED_PLAYER_Y, SCALE, FOOTER_HEIGHT, FOOTER_HEIGHT_MOBILE, PHYSICAL_FLOOR_HEIGHT, BASE_GAME_WIDTH } from '../constants/gameConstants';
import { toPhysics } from '../utils/coordinates';

// Функция для создания физического мира и его границ
export const createPhysicsWorld = (
  gameWidth: number,
  gameHeight: number,
  physicsRefs: any
) => {
  // Деструктурируем ссылки на физические объекты
  const { worldRef, playerBodyRef, leftWallRef, rightWallRef, topWallRef, floorRef } = physicsRefs;
  
  if (!worldRef.current) {
    console.error('Физический мир не инициализирован');
    return;
  }
  
  try {
    const world = worldRef.current;
    
    // Коэффициент масштабирования относительно базового размера
    const scaleFactor = gameWidth / BASE_GAME_WIDTH;
    
    // Конвертируем размеры игры из пикселей в физические единицы
    const worldWidth = gameWidth / SCALE;
    const worldHeight = gameHeight / SCALE;
    
    // Толщина стен и пола (масштабируем относительно размера игры)
    const wallThickness = 1.0 * scaleFactor; // Физическая единица, масштабируемая
    const floorThickness = 0.05; // Сверхтонкий пол (практически незаметный)
    
    // Высота физического пола
    const physicalFloorHeight = PHYSICAL_FLOOR_HEIGHT / SCALE;
    
    // Создаем пол (нижнюю границу) в точном соответствии с визуальным полом
    const floor = world.createBody({
      type: 'static',
      position: planck.Vec2(worldWidth / 2, worldHeight - physicalFloorHeight / 2),
    });
    
    floor.createFixture({
      shape: planck.Box(worldWidth / 2, floorThickness / 2),
      friction: 0.3,
      restitution: 0.4,
    });
    
    // Настраиваем пользовательские данные пола
    floor.setUserData({ isStatic: true, isFloor: true });
    floorRef.current = floor;
    
    // Создаем левую стену
    const leftWall = world.createBody({
      type: 'static',
      position: planck.Vec2(wallThickness / 2, worldHeight / 2),
    });
    
    leftWall.createFixture({
      shape: planck.Box(wallThickness / 2, worldHeight / 2),
      friction: 0.3,
      restitution: 0.4,
    });
    
    // Настраиваем пользовательские данные левой стены
    leftWall.setUserData({ isStatic: true, isWall: true, side: 'left' });
    leftWallRef.current = leftWall;
    
    // Создаем правую стену
    const rightWall = world.createBody({
      type: 'static',
      position: planck.Vec2(worldWidth - wallThickness / 2, worldHeight / 2),
    });
    
    rightWall.createFixture({
      shape: planck.Box(wallThickness / 2, worldHeight / 2),
      friction: 0.3,
      restitution: 0.4,
    });
    
    // Настраиваем пользовательские данные правой стены
    rightWall.setUserData({ isStatic: true, isWall: true, side: 'right' });
    rightWallRef.current = rightWall;
    
    // Создаем верхнюю границу (невидимую, но физическую)
    const topWall = world.createBody({
      type: 'static',
      position: planck.Vec2(worldWidth / 2, wallThickness / 2),
    });
    
    topWall.createFixture({
      shape: planck.Box(worldWidth / 2, wallThickness / 2),
      friction: 0.3,
      restitution: 0.4,
    });
    
    // Настраиваем пользовательские данные верхней стены
    topWall.setUserData({ isStatic: true, isWall: true, side: 'top' });
    topWallRef.current = topWall;
    
    // Масштабируем размер игрока в зависимости от размера игры
    const playerSize = (PLAYER_SIZE * scaleFactor) / SCALE;
    
    // Создаем тело игрока (пусковой механизм)
    const player = world.createBody({
      type: 'kinematic',
      position: planck.Vec2(worldWidth / 2, 2),
      fixedRotation: true, // Запрещаем вращение
    });
    
    player.createFixture({
      shape: planck.Circle(playerSize / 30), // Размер игрока, масштабированный
      density: 1.0,
      friction: 0.3,
      restitution: 0.4,
    });
    
    // Настраиваем пользовательские данные игрока
    player.setUserData({ isPlayer: true });
    playerBodyRef.current = player;
    
    // Настройка CCD (Continuous Collision Detection)
    world.setContinuousPhysics(true);
    
    console.log('Физический мир успешно создан');
  } catch (error) {
    console.error('Ошибка при создании физического мира:', error);
  }
}; 