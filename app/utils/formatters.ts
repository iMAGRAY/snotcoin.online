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
  /** Показывать в краткой форме */
  shortFormat?: boolean;
  /** Максимальное количество единиц времени */
  maxUnits?: number;
}

/**
 * Форматирует время в секундах в удобочитаемую строку
 * @param seconds Время в секундах или объект конфигурации
 * @param options Опции форматирования
 * @returns Отформатированная строка времени
 */
export function formatTime(
  secondsOrConfig: number | { seconds: number; options?: TimeFormatOptions },
  optionsParam?: TimeFormatOptions
): string {
  // Получаем параметры из разных источников
  const seconds = typeof secondsOrConfig === 'number' 
    ? secondsOrConfig 
    : secondsOrConfig?.seconds;
    
  const options = typeof secondsOrConfig === 'object' && secondsOrConfig?.options
    ? secondsOrConfig.options
    : optionsParam;
    
  // Базовые проверки
  if (isNaN(seconds) || seconds === undefined || seconds === null) {
    return '0 с';
  }
  
  if (seconds < 0) {
    return '0 с';
  }
  
  // Максимальное отображаемое время - 30 дней для подробного отображения
  const MAX_TIME = 30 * 24 * 60 * 60; // 30 дней в секундах
  
  if (seconds > MAX_TIME) {
    // Для очень больших значений (больше 100 дней) показываем в месяцах
    if (seconds > 100 * 24 * 3600) {
      const months = Math.floor(seconds / (30 * 24 * 3600));
      return `≈ ${months} мес`;
    }
    
    // Для значений от 30 до 100 дней показываем в днях
    const days = Math.floor(seconds / (24 * 3600));
    return `${days} д`;
  }
  
  // Разбиваем время на компоненты
  const secValue = Math.round(seconds);
  const days = Math.floor(secValue / (24 * 3600));
  const hours = Math.floor((secValue % (24 * 3600)) / 3600);
  const minutes = Math.floor((secValue % 3600) / 60);
  const secs = Math.floor(secValue % 60);
  
  // Формируем строку, пропуская нулевые значения для компактности
  const parts = [];
  
  if (days > 0) {
    parts.push(`${days} д`);
  }
  
  if (hours > 0 || days > 0) {
    parts.push(`${hours} ч`);
  }
  
  // Всегда показываем минуты, даже если они равны нулю
  parts.push(`${minutes} м`);
  
  return parts.join(' ');
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

