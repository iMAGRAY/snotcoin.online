/**
 * Вспомогательные функции для игровой механики
 */
import { GameState } from "../types/gameTypes";
import { formatTime as formatTimeFromFormatters } from "./formatters";
import { FILL_RATES, UPGRADE_VALUES } from "../constants/gameConstants";

/**
 * Вычисляет скорость заполнения на основе уровня
 * @param level - Уровень скорости заполнения
 * @returns Скорость заполнения
 */
export function getFillingSpeedByLevel(level: number): number {
  const safeLevel = Math.max(1, Math.min(level, UPGRADE_VALUES.fillingSpeed.length));
  
  // Получаем значение из константы
  const speed = UPGRADE_VALUES.fillingSpeed[safeLevel - 1];
  
  // Возвращаем значение скорости заполнения
  return typeof speed === 'number' ? speed : 1;
}

/**
 * Форматирует значение SNOT для отображения в интерфейсе
 * @param value - Значение для форматирования
 * @param decimals - Количество знаков после запятой (опционально)
 * @returns Отформатированная строка
 */
export const formatSnotValue = (value: number, decimals = 0): string => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(decimals)}M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(decimals)}K`;
  } else {
    return `${decimals ? value.toFixed(decimals) : Math.floor(value)}`;
  }
};

/**
 * Результат расчета времени заполнения контейнера
 */
export interface FillingTimeResult {
  safeContainerSnot: number;
  safeContainerCapacity: number;
  safeFillingSpeed: number;
  baseIncreasePerSecond: number;
  remainingCapacity: number;
  timeInSeconds: number;
  fillPercentage: number;
  fillPerMinute: number;
  fillPerHour: number;
  hoursToFill: number;
}

/**
 * Рассчитывает время до полного заполнения контейнера
 * @param containerSnot текущий snot в контейнере
 * @param containerCapacity максимальная вместимость контейнера
 * @param fillingSpeed скорость заполнения
 * @returns время в секундах
 */
export function calculateFillingTime({
  containerSnot,
  containerCapacity,
  fillingSpeed
}: {
  containerSnot: number;
  containerCapacity: number;
  fillingSpeed: number;
}): FillingTimeResult {
  // Безопасные значения в случае передачи невалидных параметров
  const safeContainerSnot = typeof containerSnot === 'number' && !isNaN(containerSnot) 
    ? Math.max(0, containerSnot) 
    : 0;
    
  const safeContainerCapacity = typeof containerCapacity === 'number' && !isNaN(containerCapacity) && containerCapacity > 0
    ? containerCapacity
    : 1;
    
  const safeFillingSpeed = typeof fillingSpeed === 'number' && !isNaN(fillingSpeed) && fillingSpeed > 0
    ? fillingSpeed
    : 1;

  // Базовая скорость заполнения в секунду
  // При скорости 1 контейнер заполняется за 12 часов
  const baseIncreasePerSecond = FILL_RATES.BASE_CONTAINER_FILL_RATE;
  
  // Сколько ещё осталось до полного заполнения
  const remainingCapacity = Math.max(0, safeContainerCapacity - safeContainerSnot);
  
  // Сколько ресурса добавляется в час при данной скорости заполнения
  // При fillingSpeed = 1 добавляется 0.08333 в час (1/12 от полного контейнера)
  const fillPerHour = safeFillingSpeed / 12;
  
  // Рассчитываем заполнение за минуту
  const fillPerMinute = fillPerHour / 60;
  
  // Сколько часов потребуется для заполнения оставшейся емкости
  const hoursToFill = fillPerHour > 0 ? remainingCapacity / fillPerHour : 0;
  
  // Переводим часы в секунды для отображения
  const timeInSeconds = hoursToFill * 3600;
  
  // Вычисляем процент заполнения
  const fillPercentage = Math.min(100, (safeContainerSnot / safeContainerCapacity) * 100);
  
  return {
    timeInSeconds,
    safeContainerSnot,
    safeContainerCapacity,
    safeFillingSpeed,
    baseIncreasePerSecond,
    remainingCapacity,
    fillPercentage,
    fillPerMinute,
    fillPerHour,
    hoursToFill
  };
}

/**
 * Рассчитывает время заполнения контейнера на основе текущего состояния игры
 * @param state - Состояние игры
 * @returns Результат расчета времени заполнения
 */
export const calculateFillingTimeFromState = (state: GameState): FillingTimeResult => {
  if (!state || !state.inventory || !state.container) {
    return {
      safeContainerSnot: 0,
      safeContainerCapacity: 1,
      safeFillingSpeed: 0.001,
      baseIncreasePerSecond: 0,
      remainingCapacity: 1,
      timeInSeconds: Number.MAX_SAFE_INTEGER,
      fillPercentage: 0,
      fillPerMinute: 0,
      fillPerHour: 0,
      hoursToFill: 0
    };
  }
  
  const { containerSnot, fillingSpeed, containerCapacity } = state.inventory;
  
  return calculateFillingTime({ containerSnot, containerCapacity, fillingSpeed });
};

/**
 * Рассчитывает стоимость улучшения контейнера
 * @param currentLevel - Текущий уровень контейнера
 * @returns Стоимость улучшения
 */
export const calculateContainerUpgradeCost = (currentLevel: number): number => {
  // Базовая стоимость улучшения
  return Math.floor(100 * Math.pow(1.5, currentLevel - 1));
};

/**
 * Рассчитывает стоимость улучшения скорости заполнения
 * @param currentLevel - Текущий уровень скорости
 * @returns Стоимость улучшения
 */
export const calculateFillingSpeedUpgradeCost = (currentLevel: number): number => {
  // Базовая стоимость улучшения 
  return Math.floor(150 * Math.pow(1.5, currentLevel - 1));
};

/**
 * Форматирует время в формат с единицами измерения (ч, м, с)
 * @param seconds - Время в секундах
 * @returns Отформатированная строка времени
 */
export const formatTime = (seconds: number): string => {
  return formatTimeFromFormatters(seconds);
}; 