/**
 * Вспомогательные функции для игровой механики
 */
import { GameState } from "../types/gameTypes";
import { formatTime as formatTimeFromFormatters } from "./formatters";
import { FILL_RATES } from "../constants/gameConstants";

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
 * Рассчитывает время заполнения контейнера в секундах (перегрузка для отдельных параметров)
 * @param containerSnot - Текущее количество SNOT в контейнере
 * @param containerCapacity - Вместимость контейнера
 * @param fillingSpeed - Скорость заполнения
 * @returns Время заполнения в секундах
 */
export const calculateFillingTime = (
  containerSnot: number, 
  containerCapacity: number,
  fillingSpeed: number
): number => {
  // Добавляем логирование входных данных
  console.log("calculateFillingTime inputs:", { containerSnot, containerCapacity, fillingSpeed });
  
  // Проверка входных данных на корректность
  if (isNaN(containerSnot) || isNaN(containerCapacity) || isNaN(fillingSpeed)) {
    console.log("calculateFillingTime: invalid inputs, returning Infinity");
    return Infinity;
  }
  
  // Проверка на деление на ноль
  if (fillingSpeed <= 0) {
    console.log("calculateFillingTime: fillingSpeed <= 0, returning Infinity");
    return Infinity;
  }
  
  // Проверка на некорректные входные данные
  if (containerCapacity <= 0) {
    console.log("calculateFillingTime: containerCapacity <= 0, returning Infinity");
    return Infinity;
  }
  
  // Если контейнер полон или переполнен, время заполнения = 0
  if (containerSnot >= containerCapacity) {
    console.log("calculateFillingTime: container is full, returning 0");
    return 0;
  }
  
  // Безопасные значения с обработкой отрицательных чисел
  const safeContainerSnot = Math.max(0, containerSnot);
  const safeContainerCapacity = Math.max(1, containerCapacity);
  
  // Используем константу из gameConstants для базовой скорости заполнения
  const baseIncreasePerSecond = FILL_RATES.BASE_CONTAINER_FILL_RATE;
  const safeFillingSpeed = Math.max(0.000001, fillingSpeed);
  
  const remainingCapacity = safeContainerCapacity - safeContainerSnot;
  const timeToFill = remainingCapacity / (baseIncreasePerSecond * safeFillingSpeed);
  
  console.log("calculateFillingTime results:", { 
    safeContainerSnot, 
    safeContainerCapacity, 
    safeFillingSpeed,
    baseIncreasePerSecond,
    remainingCapacity, 
    timeToFill,
    timeInDays: timeToFill / FILL_RATES.SECONDS_PER_DAY 
  });
  
  return timeToFill;
};

/**
 * Рассчитывает время заполнения контейнера на основе текущего состояния игры
 * @param state - Состояние игры
 * @returns Время заполнения в секундах
 */
export const calculateFillingTimeFromState = (state: GameState): number => {
  if (!state || !state.inventory || !state.container) {
    return Infinity;
  }
  
  const { containerSnot, fillingSpeed, containerCapacity } = state.inventory;
  
  return calculateFillingTime(containerSnot, containerCapacity, fillingSpeed);
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