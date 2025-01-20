import { Ball, BALL_LEVELS, GAME_CONSTANTS } from '../types/fusion-game';

export const mergeBalls = (ball1: Ball, ball2: Ball, nextBallId: React.MutableRefObject<number>): { mergedBall: Ball | null; scoreIncrease: number; snotReward: number } => {
  if (ball1.level === ball2.level && ball1.level < 10) {
    const newLevel = Math.min(ball1.level + 1, 10);
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
      throwTime: Date.now(),
      sleeping: false
    };
    const scoreIncrease = Math.pow(2, newLevel);
    let snotReward = newLevel === 10 ? 1 : 0;

    return { mergedBall, scoreIncrease, snotReward };
  }
  return { mergedBall: null, scoreIncrease: 0, snotReward: 0 };
};

