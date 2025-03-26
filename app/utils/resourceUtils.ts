/**
 * Утилиты для работы с ресурсами и инвентарем
 */
import { ExtendedGameState } from "../types/gameTypes";
import { RESOURCES } from "../constants/uiConstants";
import { initialState } from "../constants/gameConstants";
import { Inventory } from "../types/gameTypes";

/**
 * Безопасно получает инвентарь из состояния
 * @param gameState Состояние игры или объект инвентаря
 * @returns Безопасный объект инвентаря с дефолтными значениями
 */
export function getSafeInventory(gameState: ExtendedGameState | undefined): Inventory;
export function getSafeInventory(inventory: Inventory | undefined): Inventory;
export function getSafeInventory(input: ExtendedGameState | Inventory | undefined): Inventory {
  // Если передан ExtendedGameState
  if (input && 'inventory' in input) {
    const inventory = (input.inventory as any) || {};
    
    return {
      snot: inventory.snot ?? 0,
      snotCoins: inventory.snotCoins ?? 0,
      containerSnot: inventory.containerSnot ?? 0,
      containerCapacity: inventory.containerCapacity ?? RESOURCES.DEFAULTS.MIN_CAPACITY,
      Cap: inventory.Cap ?? RESOURCES.DEFAULTS.MIN_CAPACITY, // Добавляем Cap для совместимости
      containerCapacityLevel: inventory.containerCapacityLevel ?? RESOURCES.DEFAULTS.MIN_LEVEL,
      fillingSpeed: inventory.fillingSpeed ?? RESOURCES.DEFAULTS.MIN_FILLING_SPEED,
      fillingSpeedLevel: inventory.fillingSpeedLevel ?? RESOURCES.DEFAULTS.MIN_LEVEL,
      collectionEfficiency: inventory.collectionEfficiency ?? 1, // Добавляем значение по умолчанию
    };
  }
  
  // Если передан Inventory или undefined
  const inventory = input as Inventory | undefined;
  if (!inventory) {
    return initialState.inventory;
  }
  
  // Используем деструктуризацию с значениями по умолчанию
  const {
    snot = 0,
    snotCoins = 0,
    containerCapacity = initialState.inventory.containerCapacity,
    Cap = containerCapacity, // По умолчанию Cap равен containerCapacity
    containerSnot = 0,
    fillingSpeed = initialState.inventory.fillingSpeed,
    containerCapacityLevel = 1,
    fillingSpeedLevel = 1,
    collectionEfficiency = 1,
  } = inventory;
  
  // Убеждаемся, что все значения - корректные числа
  const validCapacity = isNaN(containerCapacity) || containerCapacity <= 0 ? 
    initialState.inventory.containerCapacity : containerCapacity;
    
  return {
    ...inventory,
    snot: isNaN(snot) ? 0 : snot,
    snotCoins: isNaN(snotCoins) ? 0 : snotCoins,
    containerCapacity: validCapacity,
    Cap: validCapacity, // Синхронизируем Cap с containerCapacity
    containerSnot: isNaN(containerSnot) || containerSnot < 0 ? 0 : 
      Math.min(containerSnot, validCapacity), // Убеждаемся, что контейнер не переполнен
    fillingSpeed: isNaN(fillingSpeed) || fillingSpeed <= 0 ? 
      initialState.inventory.fillingSpeed : fillingSpeed,
    containerCapacityLevel: isNaN(containerCapacityLevel) || containerCapacityLevel < 1 ? 1 : containerCapacityLevel,
    fillingSpeedLevel: isNaN(fillingSpeedLevel) || fillingSpeedLevel < 1 ? 1 : fillingSpeedLevel,
    collectionEfficiency: isNaN(collectionEfficiency) || collectionEfficiency < 0 ? 1 : collectionEfficiency,
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
 * @param inventory - Объект инвентаря
 * @returns Процент заполнения от 0 до 100
 */
export const calculateFillingPercentage = (inventory?: Inventory): number => {
  if (!inventory) return 0;
  
  const { containerSnot, containerCapacity } = inventory;
  
  // Проверяем наличие и корректность данных
  if (typeof containerSnot !== 'number' || 
      typeof containerCapacity !== 'number' || 
      containerCapacity <= 0 || 
      isNaN(containerSnot) || 
      isNaN(containerCapacity)) {
    return 0;
  }
  
  // Ограничиваем значение от 0 до 100
  const percentage = (containerSnot / containerCapacity) * 100;
  return Math.min(Math.max(percentage, 0), 100);
};

/**
 * Вычисляет процент заполнения контейнера
 */
export const calculateFillPercentage = (current: number, max: number): number => {
  if (max <= 0) return 0;
  if (current >= max) return 100;
  
  const percentage = (current / max) * 100;
  return Math.min(Math.max(percentage, 0), 100);
};

/**
 * Обрабатывает ресурсы и инвентарь для отображения в интерфейсе
 */
export function processResources(gameState: any): any {
  // Проверяем наличие объекта gameState
  if (!gameState || typeof gameState !== 'object') {
    return {
      inventory: {
        snot: 0,
        snotCoins: 0,
        containerSnot: 0,
        containerCapacity: RESOURCES.DEFAULTS.MIN_CAPACITY,
        Cap: RESOURCES.DEFAULTS.MIN_CAPACITY,
        containerCapacityLevel: RESOURCES.DEFAULTS.MIN_LEVEL,
        fillingSpeed: RESOURCES.DEFAULTS.MIN_FILLING_SPEED,
        fillingSpeedLevel: RESOURCES.DEFAULTS.MIN_LEVEL,
        collectionEfficiency: 1,
        lastUpdateTimestamp: Date.now()
      },
      container: { capacity: RESOURCES.DEFAULTS.MIN_CAPACITY }
    };
  }

  // Используем существующую getSafeInventory для безопасного получения инвентаря
  const inventory = getSafeInventory(gameState);

  // Для совместимости с разными форматами состояния
  const containerObj = gameState.container || {};
  const containerCapacity = typeof containerObj.capacity === 'number' 
    ? containerObj.capacity 
    : inventory.containerCapacity;

  return { inventory, container: { capacity: containerCapacity } };
} 