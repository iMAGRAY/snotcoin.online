/**
 * Утилиты для работы с ресурсами и инвентарем
 */
import { ExtendedGameState, Inventory } from "../types/gameTypes";
import { RESOURCES } from "../constants/uiConstants";
import { initialState } from "../constants/gameConstants";

/**
 * Безопасно получает объект инвентаря из состояния игры с проверкой корректности полей
 * @param state Состояние игры или объект с инвентарем
 * @returns Объект инвентаря с безопасными значениями полей
 */
export function getSafeInventory(state: any): any {
  const inventory = state.inventory || {};
  const defaultValues = {
    snot: 0,
    snotCoins: 0,
    containerSnot: 0,
    containerCapacity: 1, // Устанавливаем containerCapacity по умолчанию
    containerCapacityLevel: 1,
    fillingSpeed: 1,
    fillingSpeedLevel: 1,
    collectionEfficiency: 1,
    lastUpdateTimestamp: Date.now()
  };
  
  // Безопасно получаем значения или используем значения по умолчанию
  return {
    snot: typeof inventory.snot === 'number' ? inventory.snot : defaultValues.snot,
    snotCoins: typeof inventory.snotCoins === 'number' ? inventory.snotCoins : defaultValues.snotCoins,
    containerSnot: typeof inventory.containerSnot === 'number' ? inventory.containerSnot : defaultValues.containerSnot,
    containerCapacity: typeof inventory.containerCapacity === 'number' ? inventory.containerCapacity : defaultValues.containerCapacity,
    containerCapacityLevel: typeof inventory.containerCapacityLevel === 'number' ? inventory.containerCapacityLevel : defaultValues.containerCapacityLevel,
    fillingSpeed: typeof inventory.fillingSpeed === 'number' ? inventory.fillingSpeed : defaultValues.fillingSpeed,
    fillingSpeedLevel: typeof inventory.fillingSpeedLevel === 'number' ? inventory.fillingSpeedLevel : defaultValues.fillingSpeedLevel,
    collectionEfficiency: typeof inventory.collectionEfficiency === 'number' ? inventory.collectionEfficiency : defaultValues.collectionEfficiency,
    lastUpdateTimestamp: typeof inventory.lastUpdateTimestamp === 'number' ? inventory.lastUpdateTimestamp : defaultValues.lastUpdateTimestamp
  };
}

/**
 * Проверяет, можно ли собрать ресурсы из контейнера
 * @param containerSnot Количество ресурса в контейнере
 * @returns true, если можно собрать ресурсы
 */
export function canCollectResources(containerSnot: number): boolean {
  return containerSnot > 0;
}

/**
 * Вычисляет доступное количество ресурса для сбора
 * @param containerSnot Текущее количество ресурса в контейнере
 * @param maxAmount Максимальное количество для сбора
 * @returns Количество ресурса для сбора
 */
export function calculateCollectionAmount(containerSnot: number, maxAmount: number): number {
  return Math.min(containerSnot, maxAmount);
}

/**
 * Валидирует параметры для отображения статуса контейнера
 * @param params Параметры контейнера
 * @returns Валидированные параметры
 */
export function validateContainerParams({
  containerCapacity,
  containerLevel,
  containerSnot,
  containerFillingSpeed,
  fillingSpeedLevel
}: {
  containerCapacity: number;
  containerLevel: number;
  containerSnot: number;
  containerFillingSpeed: number;
  fillingSpeedLevel: number;
}) {
  const { MIN_CAPACITY, MIN_LEVEL, MIN_FILLING_SPEED } = RESOURCES.DEFAULTS;
  
  const validatedCapacity = Math.max(MIN_CAPACITY, containerCapacity);
  const validatedContainerLevel = Math.max(MIN_LEVEL, containerLevel);
  const validatedContainerSnot = Math.max(0, Math.min(validatedCapacity, containerSnot));
  const validatedFillingSpeed = Math.max(MIN_FILLING_SPEED, containerFillingSpeed);
  const validatedFillingSpeedLevel = Math.max(MIN_LEVEL, fillingSpeedLevel);
  
  return {
    containerCapacity: validatedCapacity,
    containerLevel: validatedContainerLevel,
    containerSnot: validatedContainerSnot,
    containerFillingSpeed: validatedFillingSpeed,
    fillingSpeedLevel: validatedFillingSpeedLevel
  };
}

/**
 * Проверяет возможность добавления ресурса в контейнер
 * @param containerSnot Текущее количество ресурса
 * @param containerCapacity Вместимость контейнера
 * @returns Максимальное количество, которое можно добавить (0 если контейнер полон)
 */
export function getAvailableContainerSpace(containerSnot: number, containerCapacity: number): number {
  return Math.max(0, containerCapacity - containerSnot);
}

/**
 * Вычисляет процент заполнения контейнера снотом
 * @param state - Состояние игры или объект инвентаря
 * @returns Процент заполнения от 0 до 100
 */
export const calculateFillingPercentage = (state?: ExtendedGameState | any): number => {
  if (!state) return 0;
  
  // Проверяем, получили ли мы инвентарь напрямую или состояние игры
  const inventory = state.inventory || state;
  
  const containerSnot = inventory.containerSnot;
  const containerCapacity = inventory.containerCapacity;
  
  // Проверяем наличие и корректность данных
  if (typeof containerSnot !== 'number' || 
      typeof containerCapacity !== 'number' || 
      containerCapacity <= 0 || 
      isNaN(containerSnot) || 
      isNaN(containerCapacity)) {
    return 0;
  }
  
  // Убеждаемся, что containerSnot не отрицательный
  const safeContainerSnot = Math.max(0, containerSnot);
  
  // Вычисляем процент заполнения и ограничиваем его от 0 до 100
  const percentage = (safeContainerSnot / containerCapacity) * 100;
  return Math.min(Math.max(percentage, 0), 100);
};

/**
 * Вычисляет процент заполнения контейнера
 * @param current Текущее количество снота
 * @param max Максимальная ёмкость контейнера
 * @returns Процент заполнения от 0 до 100
 */
export const calculateFillPercentage = (current: number, max: number): number => {
  // Валидация входных данных
  if (typeof current !== 'number' || isNaN(current)) current = 0;
  if (typeof max !== 'number' || isNaN(max) || max <= 0) max = 1;
  
  // Ограничиваем текущее значение снизу нулем
  current = Math.max(0, current);
  
  // Если контейнер полон или переполнен
  if (current >= max) return 100;
  
  // Вычисляем процент заполнения
  const percentage = (current / max) * 100;
  
  // Ограничиваем результат диапазоном от 0 до 100
  return Math.min(Math.max(percentage, 0), 100);
};

/**
 * Обрабатывает ресурсы и инвентарь для отображения в интерфейсе
 */
export function processResources(gameState: any): any {
  if (!gameState) return null;
  
  let inventory = getSafeInventory(gameState);
  const containerObj = gameState.container || {};
  
  // Получаем из настроек или устанавливаем минимальные значения
  const containerLevel = typeof inventory.containerCapacityLevel === 'number' 
    ? inventory.containerCapacityLevel 
    : RESOURCES.DEFAULTS.MIN_LEVEL;
    
  // Capacity вычисляется из containerCapacityLevel
  const containerCapacity = inventory.containerCapacity !== undefined
    ? inventory.containerCapacity
    : RESOURCES.DEFAULTS.MIN_CAPACITY;

  return {
    ...gameState,
    inventory: {
      ...inventory,
      containerCapacity // Убеждаемся, что containerCapacity всегда определено
    }, 
    container: { 
      level: containerObj.level || RESOURCES.DEFAULTS.MIN_LEVEL,
      currentAmount: containerObj.currentAmount || 0,
      fillRate: containerObj.fillRate || 1,
      currentFill: containerObj.currentFill || 0
    } 
  };
}

/**
 * Вычисляет максимальную емкость контейнера
 * @param inventory Инвентарь
 * @returns Максимальная емкость контейнера
 */
export function getContainerCapacity(inventory: Inventory): number {
  return inventory.containerCapacity;
} 