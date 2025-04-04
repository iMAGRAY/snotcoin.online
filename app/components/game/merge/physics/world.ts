import * as planck from 'planck';
import { GRAVITY_Y } from '../constants/gameConstants';

/**
 * Инициализирует физический мир planck.js
 * @returns {planck.World} - созданный физический мир
 */
export const initWorld = (): planck.World => {
  const world = planck.World({
    gravity: planck.Vec2(0, GRAVITY_Y),
    allowSleep: true,
  });

  return world;
}; 