/**
 * Утилиты для форматирования различных типов значений
 * 
 * Этот модуль содержит функции для форматирования:
 * - Числовых значений (включая форматирование SNOT)
 * - Значений времени
 * - Процентов
 * - Валюты
 */

/**
 * Форматирует число в формате SNOT (с суффиксами K, M, B)
 * @param value - Числовое значение для форматирования
 * @param decimalPlaces - Количество знаков после запятой (по умолчанию 0)
 * @returns Отформатированное значение в виде строки
 */
export function formatSnotValue(value: number, decimalPlaces = 0): string {
  // Проверка на NaN и защита от ошибок
  if (isNaN(value) || value === undefined || value === null) {
    return "0";
  }
  
  // Обеспечиваем, что значение неотрицательное
  const safeValue = Math.max(0, value);
  
  if (safeValue >= 1e9) {
    return (safeValue / 1e9).toFixed(1) + "B";
  } else if (safeValue >= 1e6) {
    return (safeValue / 1e6).toFixed(1) + "M";
  } else if (safeValue >= 1e3) {
    return (safeValue / 1e3).toFixed(1) + "K";
  } else {
    return safeValue.toFixed(decimalPlaces);
  }
}

/**
 * Тип для форматирования времени
 */
export type TimeFormatOptions = {
  /** Показывать секунды */
  showSeconds?: boolean;
  /** Показывать только наибольшую единицу */
  maxUnitOnly?: boolean;
}

/**
 * Форматирует время в секундах в читаемый формат (ч, м, с)
 * @param seconds - Количество секунд
 * @param options - Опции форматирования
 * @returns Отформатированное значение времени
 */
export function formatTime(seconds: number, options?: TimeFormatOptions): string {
  const { showSeconds = false, maxUnitOnly = false } = options || {};
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  if (maxUnitOnly) {
    if (hours > 0) return `${hours}h`
    if (minutes > 0) return `${minutes}m`
    return `${remainingSeconds}s`
  }

  if (hours > 0) {
    return showSeconds 
      ? `${hours}h ${minutes}m ${remainingSeconds}s`
      : `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return showSeconds 
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`
  } else {
    return `${remainingSeconds}s`
  }
}

/**
 * Опции форматирования процентов
 */
export type PercentageFormatOptions = {
  /** Количество знаков после запятой */
  decimalPlaces?: number;
  /** Добавлять символ процента */
  addPercentSign?: boolean;
  /** Округлять до целого числа */
  round?: boolean;
}

/**
 * Форматирует число как процент
 * @param value - Значение от 0 до 1
 * @param options - Опции форматирования
 * @returns Отформатированное процентное значение
 */
export function formatPercentage(
  value: number, 
  options?: PercentageFormatOptions
): string {
  const { 
    decimalPlaces = 1, 
    addPercentSign = true,
    round = false 
  } = options || {};
  
  const percentage = value * 100;
  const formatted = round 
    ? Math.round(percentage).toString()
    : percentage.toFixed(decimalPlaces);
    
  return addPercentSign ? `${formatted}%` : formatted;
}

/**
 * Тип валюты для форматирования
 */
export type CurrencyType = 'USD' | 'EUR' | 'GBP' | 'RUB';

/**
 * Опции форматирования валюты
 */
export type CurrencyFormatOptions = {
  /** Тип валюты */
  currency?: CurrencyType;
  /** Количество знаков после запятой */
  decimalPlaces?: number;
  /** Использовать локализованный формат */
  useLocale?: boolean;
}

/**
 * Форматирует число как валютное значение
 * @param value - Числовое значение
 * @param options - Опции форматирования
 * @returns Отформатированное валютное значение
 */
export function formatCurrency(
  value: number, 
  options?: CurrencyFormatOptions
): string {
  const { 
    currency = 'USD', 
    decimalPlaces = 2,
    useLocale = false
  } = options || {};
  
  // Символы валют
  const currencySymbols: Record<CurrencyType, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    RUB: '₽'
  };
  
  if (useLocale) {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency,
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces
    }).format(value);
  }
  
  return `${currencySymbols[currency]}${value.toFixed(decimalPlaces)}`;
}

/**
 * Опции форматирования чисел
 */
export type NumberFormatOptions = {
  /** Количество знаков после запятой */
  decimalPlaces?: number;
  /** Использовать разделители групп разрядов */
  useGrouping?: boolean;
  /** Показывать знак + для положительных чисел */
  showPositiveSign?: boolean;
}

/**
 * Форматирует число с заданной точностью и опциями
 * @param value - Числовое значение
 * @param options - Опции форматирования
 * @returns Отформатированное числовое значение
 */
export function formatNumber(
  value: number, 
  options?: NumberFormatOptions
): string {
  const { 
    decimalPlaces = 2,
    useGrouping = false,
    showPositiveSign = false
  } = options || {};
  
  let result = '';
  
  if (useGrouping) {
    result = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
      useGrouping: true
    }).format(value);
  } else {
    result = value.toFixed(decimalPlaces);
  }
  
  if (showPositiveSign && value > 0) {
    result = '+' + result;
  }
  
  return result;
}

/**
 * Рассчитывает время заполнения контейнера
 * @param containerSnot - Текущее количество SNOT в контейнере
 * @param containerCapacity - Вместимость контейнера
 * @param fillingSpeed - Скорость заполнения
 * @returns Время заполнения в секундах
 */
export function calculateFillingTime(
  containerSnot: number, 
  containerCapacity: number,
  fillingSpeed: number
): number {
  // Проверка входных данных на корректность
  if (isNaN(containerSnot) || isNaN(containerCapacity) || isNaN(fillingSpeed)) {
    return Infinity;
  }
  
  // Проверка на деление на ноль
  if (fillingSpeed <= 0) return Infinity;
  
  // Проверка на некорректные входные данные
  if (containerCapacity <= 0) return Infinity;
  
  // Если контейнер полон или переполнен, время заполнения = 0
  if (containerSnot >= containerCapacity) return 0;
  
  // Безопасные значения с обработкой отрицательных чисел
  const safeContainerSnot = Math.max(0, containerSnot);
  const safeContainerCapacity = Math.max(1, containerCapacity);
  const safeFillingSpeed = Math.max(0.000001, fillingSpeed);
  
  const remainingCapacity = safeContainerCapacity - safeContainerSnot;
  return remainingCapacity / safeFillingSpeed;
}

/**
 * Рассчитывает стоимость улучшения контейнера
 * @param currentLevel - Текущий уровень контейнера
 * @returns Стоимость улучшения
 */
export function calculateContainerUpgradeCost(currentLevel: number): number {
  // Базовая стоимость улучшения
  return Math.floor(100 * Math.pow(1.5, currentLevel - 1));
}

/**
 * Рассчитывает стоимость улучшения скорости заполнения
 * @param currentLevel - Текущий уровень скорости
 * @returns Стоимость улучшения
 */
export function calculateFillingSpeedUpgradeCost(currentLevel: number): number {
  // Базовая стоимость улучшения 
  return Math.floor(150 * Math.pow(1.5, currentLevel - 1));
}

