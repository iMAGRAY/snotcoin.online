import { Ball, GAME_CONSTANTS, BALL_LEVELS } from '../types/fusion-game';

export const getRandomBallLevel = (): number => {
  // Weights for levels 1 to 5, with decreasing probability
  const weights = [45, 30, 15, 7, 3]; // Total 100
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const randomNum = Math.random() * totalWeight;

  let cumulativeWeight = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulativeWeight += weights[i];
    if (randomNum < cumulativeWeight) {
      return i + 1; // Return level (1-5)
    }
  }

  return 1; // Fallback to level 1 if something goes wrong
};

export const mergeBalls = (ball1: Ball, ball2: Ball, nextBallId: React.MutableRefObject<number>, containerCap: number): { mergedBall: Ball | null; scoreIncrease: number; snotReward: number } => {
  if (ball1.level === ball2.level && ball1.level < 12) {
    const newLevel = Math.min(ball1.level + 1, 11);
    const newBall = BALL_LEVELS[newLevel - 1];
    const totalMomentum = {
      x: ball1.mass * ball1.vx + ball2.mass * ball2.vx,
      y: ball1.mass * ball1.vy + ball2.mass * ball2.vy
    };
    const mergedBall = {
      id: nextBallId.current++,
      x: (ball1.x + ball2.x) / 2,
      y: (ball1.y + ball2.y) / 2,
      level: newLevel,
      vx: totalMomentum.x / (2 * GAME_CONSTANTS.UNIFORM_BALL_MASS),
      vy: totalMomentum.y / (2 * GAME_CONSTANTS.UNIFORM_BALL_MASS),
      radius: newBall.size / 2,
      mass: GAME_CONSTANTS.UNIFORM_BALL_MASS,
      sleeping: false,
      throwTime: Date.now()
    };
    const scoreIncrease = Math.pow(2, newLevel);
    let snotReward = 0;

    // Award SNOT when merging two level 10 balls or level 11 balls
    if ((ball1.level === 10 && ball2.level === 10) || (ball1.level === 11 && ball2.level === 11)) {
      snotReward = Math.floor(containerCap * (ball1.level === 11 ? 1.0 : 1.0)); // 100% of capacity for both level 10 and level 11
    }

    return { mergedBall, scoreIncrease, snotReward };
  }
  return { mergedBall: null, scoreIncrease: 0, snotReward: 0 };
};

export const resolveCollision = (ball1: Ball, ball2: Ball, nextBallId: React.MutableRefObject<number>, containerCap: number): { resolvedBall1: Ball, resolvedBall2: Ball, mergedBall: Ball | null, scoreIncrease: number, snotReward: number } => {
  const dx = ball2.x - ball1.x;
  const dy = ball2.y - ball1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const minDistance = ball1.radius + ball2.radius;

  if (distance < minDistance) {
    // Wake up sleeping balls if they're involved in a collision
    if (ball1.sleeping || ball2.sleeping) {
      ball1.sleeping = false;
      ball2.sleeping = false;
    }

    if (ball1.level === ball2.level) {
      const { mergedBall, scoreIncrease, snotReward } = mergeBalls(ball1, ball2, nextBallId, containerCap);
      if (mergedBall) {
        return { resolvedBall1: ball1, resolvedBall2: ball2, mergedBall, scoreIncrease, snotReward };
      }
    }

    const nx = dx / distance;
    const ny = dy / distance;

    const relativeVelocityX = ball2.vx - ball1.vx;
    const relativeVelocityY = ball2.vy - ball1.vy;
    const velocityAlongNormal = relativeVelocityX * nx + relativeVelocityY * ny;

    if (velocityAlongNormal > 0) {
      return { resolvedBall1: ball1, resolvedBall2: ball2, mergedBall: null, scoreIncrease: 0, snotReward: 0 };
    }

    const restitution = GAME_CONSTANTS.RESTITUTION;
    const invMass1 = 1 / ball1.mass;
    const invMass2 = 1 / ball2.mass;
    const impulse = (-(1 + restitution) * velocityAlongNormal) / (invMass1 + invMass2);

    const impulseX = impulse * nx;
    const impulseY = impulse * ny;

    const newBall1 = { ...ball1 };
    const newBall2 = { ...ball2 };

    newBall1.vx -= impulseX * invMass1 * GAME_CONSTANTS.COLLISION_DAMPING;
    newBall1.vy -= impulseY * invMass1 * GAME_CONSTANTS.COLLISION_DAMPING;
    newBall2.vx += impulseX * invMass2 * GAME_CONSTANTS.COLLISION_DAMPING;
    newBall2.vy += impulseY * invMass2 * GAME_CONSTANTS.COLLISION_DAMPING;

    // Position correction to prevent sinking
    const percent = 0.2; // Penetration percentage to correct
    const slop = 0.01; // Penetration allowance
    const penetration = minDistance - distance;

    if (penetration > slop) {
      const correction = (penetration / (invMass1 + invMass2)) * percent;
      const correctionX = correction * nx;
      const correctionY = correction * ny;

      newBall1.x -= correctionX * invMass1;
      newBall1.y -= correctionY * invMass1;
      newBall2.x += correctionX * invMass2;
      newBall2.y += correctionY * invMass2;
    }

    // Apply additional damping to reduce overall energy
    newBall1.vx *= GAME_CONSTANTS.COLLISION_DAMPING;
    newBall1.vy *= GAME_CONSTANTS.COLLISION_DAMPING;
    newBall2.vx *= GAME_CONSTANTS.COLLISION_DAMPING;
    newBall2.vy *= GAME_CONSTANTS.COLLISION_DAMPING;

    // Wake up balls if their velocity after collision is above the wake threshold
    if (Math.abs(newBall1.vx) > GAME_CONSTANTS.MINIMUM_MOVEMENT_THRESHOLD || Math.abs(newBall1.vy) > GAME_CONSTANTS.MINIMUM_MOVEMENT_THRESHOLD) {
      newBall1.sleeping = false;
    }
    if (Math.abs(newBall2.vx) > GAME_CONSTANTS.MINIMUM_MOVEMENT_THRESHOLD || Math.abs(newBall2.vy) > GAME_CONSTANTS.MINIMUM_MOVEMENT_THRESHOLD) {
      newBall2.sleeping = false;
    }

    return { resolvedBall1: newBall1, resolvedBall2: newBall2, mergedBall: null, scoreIncrease: 0, snotReward: 0 };
  }

  return { resolvedBall1: ball1, resolvedBall2: ball2, mergedBall: null, scoreIncrease: 0, snotReward: 0 };
};

