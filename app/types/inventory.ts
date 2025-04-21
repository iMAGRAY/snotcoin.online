/**
 * Интерфейс для типа инвентаря игрока
 */
export interface Inventory {
  /** Количество соплей */
  snot: number;
  /** Количество монет */
  kingCoins: number;
  /** Текущая вместимость контейнера */
  containerCapacity: number;
  /** Текущее количество соплей в контейнере */
  containerSnot: number;
  /** Текущая скорость наполнения контейнера */
  fillingSpeed: number;
  /** Уровень вместимости контейнера */
  containerCapacityLevel: number;
  /** Уровень скорости наполнения */
  fillingSpeedLevel: number;
  /** Эффективность сбора (множитель для наград) */
  collectionEfficiency: number;
  /** Временная метка последнего обновления */
  lastUpdateTimestamp: number;
  /** Максимальный уровень монеты */
  maxCoinLevel?: number;
  /** Другие свойства инвентаря */
  [key: string]: any;
} 