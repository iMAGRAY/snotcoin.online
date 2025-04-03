import * as planck from 'planck';
import { PhysicsWorldProps, PhysicsRefs } from '../types/index';
import { PLAYER_SIZE, PHYSICS_PLAYER_Y, FIXED_PLAYER_Y, SCALE, FOOTER_HEIGHT, FOOTER_HEIGHT_MOBILE, PHYSICAL_FLOOR_HEIGHT, BASE_GAME_WIDTH, GRAVITY_Y } from '../constants/gameConstants';
import { toPhysics } from '../utils/coordinates';

// Функция для создания физического мира и его границ
export const createPhysicsWorld = (
  gameWidth: number,
  gameHeight: number,
  physicsRefs: PhysicsRefs
) => {
  // Создаем новый физический мир с гравитацией
  const world = planck.World({
    gravity: planck.Vec2(0, GRAVITY_Y)
  });

  // Устанавливаем ссылку на мир
  physicsRefs.worldRef.current = world;

  // Создаем статические тела для границ мира
  const floorHeight = 30;
  const wallWidth = 32;

  // Создаем пол
  const floorBody = world.createBody();
  const floorShape = planck.Box(gameWidth / SCALE / 2, floorHeight / SCALE / 2);
  floorBody.createFixture({
    shape: floorShape,
    friction: 0.3,
    restitution: 0.4
  });
  floorBody.setPosition(planck.Vec2(gameWidth / SCALE / 2, (gameHeight - floorHeight / 2) / SCALE));
  physicsRefs.floorRef.current = floorBody;

  // Создаем левую стену
  const leftWallBody = world.createBody();
  const leftWallShape = planck.Box(wallWidth / SCALE / 2, gameHeight / SCALE / 2);
  leftWallBody.createFixture({
    shape: leftWallShape,
    friction: 0.3,
    restitution: 0.4
  });
  leftWallBody.setPosition(planck.Vec2(wallWidth / SCALE / 2, gameHeight / SCALE / 2));
  physicsRefs.leftWallRef.current = leftWallBody;

  // Создаем правую стену
  const rightWallBody = world.createBody();
  const rightWallShape = planck.Box(wallWidth / SCALE / 2, gameHeight / SCALE / 2);
  rightWallBody.createFixture({
    shape: rightWallShape,
    friction: 0.3,
    restitution: 0.4
  });
  rightWallBody.setPosition(planck.Vec2((gameWidth - wallWidth / 2) / SCALE, gameHeight / SCALE / 2));
  physicsRefs.rightWallRef.current = rightWallBody;

  // Создаем верхнюю стену (невидимую, для предотвращения вылета шаров за пределы)
  const topWallBody = world.createBody();
  const topWallShape = planck.Box(gameWidth / SCALE / 2, 1 / SCALE);
  topWallBody.createFixture({
    shape: topWallShape,
    friction: 0.3,
    restitution: 0.4
  });
  topWallBody.setPosition(planck.Vec2(gameWidth / SCALE / 2, 0));
  physicsRefs.topWallRef.current = topWallBody;

  // Создаем тело для игрока (контроллера) - маленький круг
  const playerBody = world.createDynamicBody();
  playerBody.setFixedRotation(true); // Запрещаем вращение
  physicsRefs.playerBodyRef.current = playerBody;

  return world;
}; 