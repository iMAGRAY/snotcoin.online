/**
 * Интерфейс для контейнера
 */
export interface Container {
  /** Уровень контейнера */
  level: number;
  /** Вместимость контейнера */
  capacity: number;
  /** Текущее количество */
  currentAmount: number;
  /** Скорость заполнения */
  fillRate: number;
  /** Текущее заполнение (альтернативное имя для currentAmount) */
  filled?: number;
  /** Скорость заполнения (альтернативное имя для fillRate) */
  fillingSpeed?: number;
  /** Тип контейнера */
  type?: string;
  /** Последнее время обновления */
  lastUpdate?: number;
  /** Другие свойства контейнера */
  [key: string]: any;
} 