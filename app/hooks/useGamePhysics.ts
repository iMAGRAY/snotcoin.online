import { useCallback } from 'react';
import { Ball, GAME_CONSTANTS } from '../types/fusion-game';

export const useGamePhysics = () => {
  const updateBallPhysics = useCallback((ball: Ball): Ball => {
    const newBall = { ...ball };

    if (newBall.sleeping) {
      return newBall;
    }

    // Apply gravity and air resistance
    newBall.vy += GAME_CONSTANTS.GRAVITY;
    newBall.vx *= GAME_CONSTANTS.AIR_RESISTANCE;
    newBall.vy *= GAME_CONSTANTS.AIR_RESISTANCE;

    // Check if the ball's movement is below the minimum threshold
    if (Math.abs(newBall.vx) < GAME_CONSTANTS.MINIMUM_MOVEMENT_THRESHOLD) {
      newBall.vx = 0;
    }
    if (Math.abs(newBall.vy) < GAME_CONSTANTS.MINIMUM_MOVEMENT_THRESHOLD) {
      newBall.vy = 0;
    }

    // Update position only if the velocity is above the minimum threshold
    if (Math.abs(newBall.vx) >= GAME_CONSTANTS.MINIMUM_MOVEMENT_THRESHOLD) {
      newBall.x += newBall.vx;
    }
    if (Math.abs(newBall.vy) >= GAME_CONSTANTS.MINIMUM_MOVEMENT_THRESHOLD) {
      newBall.y += newBall.vy;
    }

    // Wall collisions with position correction
    if (newBall.x - newBall.radius < GAME_CONSTANTS.WALL_WIDTH) {
      const penetration = GAME_CONSTANTS.WALL_WIDTH - (newBall.x - newBall.radius);
      if (penetration > GAME_CONSTANTS.POSITION_CORRECTION_FACTOR) {
        newBall.x += penetration * GAME_CONSTANTS.POSITION_CORRECTION_FACTOR;
      }
      newBall.vx = -newBall.vx * GAME_CONSTANTS.BOUNCE_FACTOR;
    } else if (newBall.x + newBall.radius > GAME_CONSTANTS.GAME_WIDTH - GAME_CONSTANTS.WALL_WIDTH) {
      const penetration = (newBall.x + newBall.radius) - (GAME_CONSTANTS.GAME_WIDTH - GAME_CONSTANTS.WALL_WIDTH);
      if (penetration > GAME_CONSTANTS.POSITION_CORRECTION_FACTOR) {
        newBall.x -= penetration * GAME_CONSTANTS.POSITION_CORRECTION_FACTOR;
      }
      newBall.vx = -newBall.vx * GAME_CONSTANTS.BOUNCE_FACTOR;
    }

    // Floor and ceiling collisions with position correction
    if (newBall.y + newBall.radius > GAME_CONSTANTS.GAME_HEIGHT) {
      const penetration = (newBall.y + newBall.radius) - GAME_CONSTANTS.GAME_HEIGHT;
      if (penetration > GAME_CONSTANTS.POSITION_CORRECTION_FACTOR) {
        newBall.y -= penetration * GAME_CONSTANTS.POSITION_CORRECTION_FACTOR;
      }
      newBall.vy = -newBall.vy * GAME_CONSTANTS.BOUNCE_FACTOR;
      newBall.vx *= 0.8; // Add some friction when hitting the floor
    } else if (newBall.y - newBall.radius < 0) {
      const penetration = -(newBall.y - newBall.radius);
      if (penetration > GAME_CONSTANTS.POSITION_CORRECTION_FACTOR) {
        newBall.y += penetration * GAME_CONSTANTS.POSITION_CORRECTION_FACTOR;
      }
      newBall.vy = -newBall.vy * GAME_CONSTANTS.BOUNCE_FACTOR;
    }

    // Check if the ball should go to sleep
    if (Math.abs(newBall.vx) < GAME_CONSTANTS.MINIMUM_MOVEMENT_THRESHOLD && 
        Math.abs(newBall.vy) < GAME_CONSTANTS.MINIMUM_MOVEMENT_THRESHOLD &&
        newBall.y + newBall.radius >= GAME_CONSTANTS.GAME_HEIGHT - 1) {
      newBall.sleeping = true;
      newBall.vx = 0;
      newBall.vy = 0;
    }

    return newBall;
  }, []);

  return { updateBallPhysics };
};

