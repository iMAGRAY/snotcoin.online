"use client"

// Утилиты для игры Merge
import { SCALE } from './types';

export const GAME_CONFIG = {
  MAX_LEVEL: 12,        // Максимальный уровень шара
  MAX_RANDOM_LEVEL: 6,  // Максимальный уровень для случайных шаров
  BASE_RADIUS: 0.8,     // Базовый радиус для шара 1 уровня
  SHOOT_DELAY: 500,     // Задержка между выстрелами в миллисекундах 
  NEW_BALL_GRACE_PERIOD: 320, // Период игнорирования для новых шаров (мс)
};

// Функция для получения радиуса шара по его уровню
export function getRadiusByLevel(level: number): number {
  return 0.8 + (level - 1) * 0.12; // Увеличение радиуса с каждым уровнем
}

// Функция для получения цвета шара по его уровню
export function getColorByLevel(level: number): number {
  const colors = [
    0xFFFFFF, // белый (уровень 1)
    0x00FF00, // зеленый (уровень 2)
    0x0000FF, // синий (уровень 3)
    0xFF00FF, // розовый (уровень 4)
    0xFF0000, // красный (уровень 5)
    0xFFFF00, // желтый (уровень 6)
    0x00FFFF, // голубой (уровень 7)
    0xFF6600, // оранжевый (уровень 8)
    0x9900FF, // фиолетовый (уровень 9)
    0x009900, // темно-зеленый (уровень 10)
    0x990000, // бордовый (уровень 11)
    0xFFD700  // золотой (уровень 12)
  ];
  
  return colors[(level - 1) % colors.length];
}

// Определение, является ли устройство мобильным
export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
} 