import { BASE_BALL_SIZE, SCALE } from '../constants/gameConstants';

// Минимальный размер шара для физики
const MIN_BALL_RADIUS = 0.45;

// Функция для расчета размера шара на основе уровня
export const getBallSize = (level: number): number => {
  return BASE_BALL_SIZE + (level - 1) * 5; // увеличиваем размер на 5 пикселей для каждого уровня
};

// Функция для расчета физического размера шара
export const getBallPhysicsSize = (level: number): number => {
  // Использовать минимальный радиус, чтобы предотвратить проникновение шаров друг в друга
  return Math.max(getBallSize(level) / SCALE, MIN_BALL_RADIUS);
};

// Проверка наличия свойства в объекте userData
export const hasUserDataProperty = (userData: any, property: string): boolean => {
  return userData && userData[property] !== undefined;
}; 