import { Ball, GAME_CONSTANTS } from '../types/fusion-game';

export const detectCollision = (ball1: Ball, ball2: Ball): boolean => {
  const dx = ball2.x - ball1.x;
  const dy = ball2.y - ball1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < ball1.radius + ball2.radius;
};

export const resolveCollision = (ball1: Ball, ball2: Ball): [Ball, Ball] => {
  const dx = ball2.x - ball1.x;
  const dy = ball2.y - ball1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const nx = dx / distance;
  const ny = dy / distance;

  const relativeVelocityX = ball2.vx - ball1.vx;
  const relativeVelocityY = ball2.vy - ball1.vy;
  const velocityAlongNormal = relativeVelocityX * nx + relativeVelocityY * ny;

  if (velocityAlongNormal > 0) return [ball1, ball2];

  const restitution = GAME_CONSTANTS.BOUNCE_FACTOR;
  const impulse = (-(1 + restitution) * velocityAlongNormal) / (1 / ball1.mass + 1 / ball2.mass);

  const impulseX = impulse * nx;
  const impulseY = impulse * ny;

  const newBall1 = { ...ball1 };
  const newBall2 = { ...ball2 };

  newBall1.vx -= (impulseX / ball1.mass) * GAME_CONSTANTS.COLLISION_DAMPING;
  newBall1.vy -= (impulseY / ball1.mass) * GAME_CONSTANTS.COLLISION_DAMPING;

  newBall2.vx += (impulseX / ball2.mass) * GAME_CONSTANTS.COLLISION_DAMPING;
  newBall2.vy += (impulseY / ball2.mass) * GAME_CONSTANTS.COLLISION_DAMPING;

  return [newBall1, newBall2];
};

