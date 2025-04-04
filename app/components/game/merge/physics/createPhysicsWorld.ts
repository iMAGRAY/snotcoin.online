import * as planck from 'planck';
import { PhysicsWorldProps } from '../types/index';
import { PLAYER_SIZE, PHYSICS_PLAYER_Y, FIXED_PLAYER_Y, SCALE, FOOTER_HEIGHT, FOOTER_HEIGHT_MOBILE, PHYSICAL_FLOOR_HEIGHT, BASE_GAME_WIDTH, GRAVITY_Y } from '../constants/gameConstants';
import { toPhysics } from '../utils/coordinates';

// Функция для создания физического мира и его границ
export const createPhysicsWorld = (gravityY: number) => {
  // Создаем новый физический мир с гравитацией
  const world = planck.World({
    gravity: planck.Vec2(0, gravityY)
  });

  return world;
}; 