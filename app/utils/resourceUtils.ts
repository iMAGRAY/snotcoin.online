/**
 * Утилиты для работы с ресурсами и инвентарем
 */
import { ExtendedGameState, Inventory, GameState } from "../types/gameTypes";
import { RESOURCES } from "../constants/uiConstants";
import { initialState, FILL_RATES } from "../constants/gameConstants";
import { getFillingSpeedByLevel } from "./gameUtils";

/**
 * Получает безопасный объект инвентаря из состояния игры с установкой значений по умолчанию
 * @param gameState Состояние игры
 * @returns Инвентарь с безопасными значениями
 */
export function getSafeInventory(gameState: any): Inventory {
  if (!gameState || !gameState.inventory) {
    return {
      snot: 0,
      snotCoins: 0,
      containerSnot: 0,
      containerCapacity: 1, // Уровень 1 соответствует емкости 1
      containerCapacityLevel: 1,
      fillingSpeed: 1, // 1 snot за 12 часов на уровне 1
      fillingSpeedLevel: 1,
      collectionEfficiency: 1,
      lastUpdateTimestamp: Date.now()
    };
  }
  
  const inventory = gameState.inventory;
  
  // Создаем объект с безопасными значениями
  const safeInventory: Inventory = {
    snot: typeof inventory.snot === 'number' && !isNaN(inventory.snot) 
      ? inventory.snot 
      : 0,
      
    snotCoins: typeof inventory.snotCoins === 'number' && !isNaN(inventory.snotCoins) 
      ? inventory.snotCoins 
      : 0,
      
    containerSnot: typeof inventory.containerSnot === 'number' && !isNaN(inventory.containerSnot) 
      ? inventory.containerSnot 
      : 0,
      
    containerCapacity: typeof inventory.containerCapacity === 'number' && !isNaN(inventory.containerCapacity) && inventory.containerCapacity > 0
      ? inventory.containerCapacity 
      : 1, // Для уровня 1 емкость должна быть 1
      
    containerCapacityLevel: typeof inventory.containerCapacityLevel === 'number' && !isNaN(inventory.containerCapacityLevel) && inventory.containerCapacityLevel > 0
      ? inventory.containerCapacityLevel 
      : 1,
      
    fillingSpeed: typeof inventory.fillingSpeed === 'number' && !isNaN(inventory.fillingSpeed) && inventory.fillingSpeed > 0
      ? inventory.fillingSpeed 
      : 1, // 1 snot за 12 часов на уровне 1
      
    fillingSpeedLevel: typeof inventory.fillingSpeedLevel === 'number' && !isNaN(inventory.fillingSpeedLevel) && inventory.fillingSpeedLevel > 0
      ? inventory.fillingSpeedLevel 
      : 1,
      
    collectionEfficiency: typeof inventory.collectionEfficiency === 'number' && !isNaN(inventory.collectionEfficiency) && inventory.collectionEfficiency > 0
      ? inventory.collectionEfficiency 
      : 1,
      
    lastUpdateTimestamp: typeof inventory.lastUpdateTimestamp === 'number' && !isNaN(inventory.lastUpdateTimestamp)
      ? inventory.lastUpdateTimestamp
      : Date.now()
  };
  
  return safeInventory;
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
 * Вычисляет процент заполнения контейнера
 * @param inventory Инвентарь
 * @returns Процент заполнения контейнера
 */
export function calculateFillingPercentage(inventory: Inventory): number {
  if (!inventory) return 0;
  
  const containerCapacity = Math.max(1, inventory.containerCapacity || 1);
  const containerSnot = Math.max(0, inventory.containerSnot || 0);
  
  return (containerSnot / containerCapacity) * 100;
}

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

/**
 * Вычисляет накопленный containerSnot за время между загрузками
 * @param lastLoadTime Время последнего сохранения/входа в игру (timestamp)
 * @param currentTime Текущее время (timestamp)
 * @param fillingSpeed Скорость заполнения контейнера
 * @param currentContainerSnot Текущее количество snot в контейнере
 * @param containerCapacity Максимальная вместимость контейнера
 * @returns Обновленное количество snot в контейнере
 */
export function calculateAccumulatedContainerSnot(
  lastLoadTime: number,
  currentTime: number,
  fillingSpeed: number,
  currentContainerSnot: number,
  containerCapacity: number
): number {
  // Базовые проверки
  if (currentTime <= lastLoadTime || fillingSpeed <= 0 || currentContainerSnot >= containerCapacity) {
    return Math.min(currentContainerSnot, containerCapacity);
  }

  // 1. Вычисляем время в секундах
  const elapsedSeconds = (currentTime - lastLoadTime) / 1000;
  
  // 2. Используем базовую скорость заполнения из констант и умножаем на пользовательскую fillingSpeed
  const fillRatePerSecond = FILL_RATES.BASE_CONTAINER_FILL_RATE * fillingSpeed;
  
  // 3. Вычисляем количество накопленного snot
  const accumulatedSnot = fillRatePerSecond * elapsedSeconds;
  
  // 4. Возвращаем новое значение с учетом максимальной вместимости контейнера
  return Math.min(currentContainerSnot + accumulatedSnot, containerCapacity);
}

/**
 * Обновляет состояние игры с учетом времени, прошедшего с последнего входа
 * @param gameState Текущее состояние игры
 * @param currentTime Текущее время (timestamp)
 * @returns Обновленное состояние игры
 */
export function updateResourcesBasedOnTimePassed(
  gameState: GameState | ExtendedGameState,
  currentTime: number = Date.now()
): GameState | ExtendedGameState {
  if (!gameState?.inventory) {
    return gameState;
  }
  
  // Получаем время последнего обновления
  const state = gameState as any;
  const inventory = gameState.inventory;
  
  // Находим последнее время обновления (от самого нового к старому)
  const lastLoadTime = inventory.lastUpdateTimestamp || 
                     state._localSaveTimestamp || 
                     state._lastModified || 
                     (state._lastSaved ? new Date(state._lastSaved).getTime() : null) || 
                     (currentTime - 1000); // Если нет данных, используем текущее время - 1 секунда
  
  // Получаем необходимые данные с валидацией
  const currentContainerSnot = Math.max(0, Number(inventory.containerSnot) || 0);
  const containerCapacity = Math.max(1, Number(inventory.containerCapacity) || 1);
  
  // Получаем уровень скорости и вычисляем правильное значение скорости
  const fillingSpeedLevel = Math.max(1, Number(inventory.fillingSpeedLevel) || 1);
  
  // Используем вычисленную скорость заполнения на основе уровня
  const fillingSpeed = getFillingSpeedByLevel(fillingSpeedLevel);
  
  // Проверка на слишком малое значение containerSnot при большом промежутке времени
  // Если прошло более 1 часа, но значение очень маленькое, возможно произошел сброс
  const elapsedSeconds = (currentTime - lastLoadTime) / 1000;
  const fillRatePerSecond = FILL_RATES.BASE_CONTAINER_FILL_RATE * fillingSpeed;
  const expectedMinimumAccumulation = Math.min(fillRatePerSecond * Math.max(0, elapsedSeconds - 60), containerCapacity);
  
  let updatedContainerSnot = currentContainerSnot;
  
  // Если прошло более часа, проверим на сброс значения
  if (elapsedSeconds > 3600 && currentContainerSnot < 0.01) {
    // Принудительно устанавливаем минимальное значение на основе времени
    updatedContainerSnot = expectedMinimumAccumulation;
  } 
  // Стандартная логика расчета containerSnot
  else if (currentTime - lastLoadTime > 1000) {
    updatedContainerSnot = calculateAccumulatedContainerSnot(
      lastLoadTime,
      currentTime,
      fillingSpeed,
      currentContainerSnot,
      containerCapacity
    );
  }
  
  // Дополнительная проверка - если расчетное значение меньше ожидаемого минимума
  // при значительном времени, используем ожидаемый минимум
  if (elapsedSeconds > 3600 && updatedContainerSnot < expectedMinimumAccumulation) {
    updatedContainerSnot = expectedMinimumAccumulation;
  }
  
  // Создаем новый объект с обновленными данными
  const result = {
    ...gameState,
    inventory: {
      ...inventory,
      containerSnot: updatedContainerSnot,
      // Обновляем также значение скорости для соответствия уровню
      fillingSpeed: fillingSpeed,
      lastUpdateTimestamp: currentTime // Обновляем время последнего расчета
    }
  };
  
  // Добавляем метаданные об обновлении через приведение типа
  (result as any)._lastTimeBasedUpdate = currentTime;
  
  return result;
}

/**
 * Проверяет наличие необходимого количества snotCoins для покупки
 * @param inventory Инвентарь игрока
 * @param cost Стоимость покупки
 * @returns Хватает ли snotCoins
 */
export function hasEnoughSnotCoins(inventory: Inventory, cost: number): boolean {
  return (inventory?.snotCoins || 0) >= cost;
} 