import { SCALE } from '../constants/gameConstants';

// Вспомогательные функции для конвертации координат между Phaser и Planck
export const toPhysics = (x: number): number => x / SCALE;
export const toPixels = (x: number): number => x * SCALE; 