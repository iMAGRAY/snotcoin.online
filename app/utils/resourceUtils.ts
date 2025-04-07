/**
 * Утилиты для работы с ресурсами и инвентарем
 */
import { ExtendedGameState, Inventory, GameState } from "../types/gameTypes";
import { RESOURCES } from "../constants/uiConstants";
import { initialState, FILL_RATES } from "../constants/gameConstants";

/**
 * Получает безопасный объект инвентаря из состояния игры с установкой значений по умолчанию
 * @param gameState Состояние игры
 * @returns Инвентарь с безопасными значениями
 */
export function getSafeInventory(gameState: any): Inventory {
  if (!gameState || !gameState.inventory) {
    console.warn('[resourceUtils] getSafeInventory: Инвентарь отсутствует, создаем новый');
    return {
      snot: 0,
      snotCoins: 0,
      containerSnot: 0,
      containerCapacity: 1,
      containerCapacityLevel: 1,
      fillingSpeed: 1,
      fillingSpeedLevel: 1,
      collectionEfficiency: 1,
      energy: 500,
      lastEnergyUpdateTime: Date.now()
    };
  }
  
  const inventory = gameState.inventory;
  
  // Проверяем и исправляем некорректные значения
  const safeInventory: Inventory = {
    snot: typeof inventory.snot === 'number' && !isNaN(inventory.snot) ? inventory.snot : 0,
    snotCoins: typeof inventory.snotCoins === 'number' && !isNaN(inventory.snotCoins) ? inventory.snotCoins : 0,
    containerSnot: typeof inventory.containerSnot === 'number' && !isNaN(inventory.containerSnot) ? inventory.containerSnot : 0,
    containerCapacity: typeof inventory.containerCapacity === 'number' && !isNaN(inventory.containerCapacity) ? 
      Math.max(1, inventory.containerCapacity) : 1,
    containerCapacityLevel: typeof inventory.containerCapacityLevel === 'number' && !isNaN(inventory.containerCapacityLevel) ? 
      Math.max(1, inventory.containerCapacityLevel) : 1,
    fillingSpeed: typeof inventory.fillingSpeed === 'number' && !isNaN(inventory.fillingSpeed) ? 
      Math.max(1, inventory.fillingSpeed) : 1,
    fillingSpeedLevel: typeof inventory.fillingSpeedLevel === 'number' && !isNaN(inventory.fillingSpeedLevel) ? 
      Math.max(1, inventory.fillingSpeedLevel) : 1,
    collectionEfficiency: typeof inventory.collectionEfficiency === 'number' && !isNaN(inventory.collectionEfficiency) ? 
      Math.max(1, inventory.collectionEfficiency) : 1,
    energy: 500,
    lastEnergyUpdateTime: Date.now()
  };
  
  // Специальная проверка для энергии
  if (typeof inventory.energy === 'number' && !isNaN(inventory.energy)) {
    // Проверяем границы
    if (inventory.energy < 0) {
      console.warn('[resourceUtils] getSafeInventory: Отрицательное значение энергии:', inventory.energy);
      safeInventory.energy = 0;
    } else if (inventory.energy > 500) {
      console.warn('[resourceUtils] getSafeInventory: Превышение максимального значения энергии:', inventory.energy);
      safeInventory.energy = 500;
    } else {
      safeInventory.energy = inventory.energy;
    }
  } else {
    console.warn('[resourceUtils] getSafeInventory: Некорректное значение энергии:', inventory.energy);
    safeInventory.energy = 500; // Безопасное значение по умолчанию
  }
  
  // Специальная проверка для временной метки обновления энергии
  if (typeof inventory.lastEnergyUpdateTime === 'number' && 
      !isNaN(inventory.lastEnergyUpdateTime) && 
      inventory.lastEnergyUpdateTime > 0) {
    // Проверяем, что метка времени находится в разумных пределах
    const now = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    
    if (inventory.lastEnergyUpdateTime > now) {
      // Метка времени в будущем
      console.warn('[resourceUtils] getSafeInventory: Метка времени энергии в будущем:', new Date(inventory.lastEnergyUpdateTime).toISOString());
      safeInventory.lastEnergyUpdateTime = now;
    } else if ((now - inventory.lastEnergyUpdateTime) > oneYearMs) {
      // Слишком старая метка времени
      console.warn('[resourceUtils] getSafeInventory: Слишком старая метка времени энергии:', new Date(inventory.lastEnergyUpdateTime).toISOString());
      safeInventory.lastEnergyUpdateTime = now;
    } else {
      safeInventory.lastEnergyUpdateTime = inventory.lastEnergyUpdateTime;
    }
  } else {
    console.warn('[resourceUtils] getSafeInventory: Некорректная метка времени энергии:', inventory.lastEnergyUpdateTime);
    safeInventory.lastEnergyUpdateTime = Date.now(); // Безопасное значение по умолчанию
  }
  
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

/**
 * Рассчитывает количество snot, которое должно было накопиться в контейнере за время отсутствия
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
  // Проверяем валидность входных данных
  if (!lastLoadTime || !currentTime || currentTime <= lastLoadTime) {
    return currentContainerSnot;
  }

  // Вычисляем прошедшее время в секундах
  const elapsedSeconds = (currentTime - lastLoadTime) / 1000;
  
  // Определяем базовую скорость заполнения
  const baseIncreasePerSecond = FILL_RATES.BASE_CONTAINER_FILL_RATE;
  
  // Учитываем текущий уровень скорости заполнения
  const actualIncreasePerSecond = baseIncreasePerSecond * fillingSpeed;
  
  // Вычисляем накопленный snot за прошедшее время
  const accumulatedSnot = actualIncreasePerSecond * elapsedSeconds;
  
  // Прибавляем к текущему значению и ограничиваем максимальной вместимостью
  const newContainerSnot = Math.min(
    containerCapacity,
    currentContainerSnot + accumulatedSnot
  );
  
  console.log('[resourceUtils] Расчет накопленного containerSnot:', {
    прошлоСекунд: elapsedSeconds,
    накоплено: accumulatedSnot,
    было: currentContainerSnot,
    стало: newContainerSnot,
    скоростьНакопления: `${(actualIncreasePerSecond * 3600).toFixed(6)} в час`
  });
  
  return newContainerSnot;
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
  if (!gameState || !gameState.inventory) {
    return gameState;
  }
  
  // Получаем время последнего сохранения/загрузки
  // Используем приведение типа для доступа к нестандартным полям
  const state = gameState as any;
  const lastLoadTime = state._localSaveTimestamp || 
                       state._lastModified || 
                       state._lastSaved ? new Date(state._lastSaved).getTime() : 
                       state._loadedAt ? new Date(state._loadedAt).getTime() : 
                       null;
  
  // Если нет информации о последнем сохранении, возвращаем исходное состояние
  if (!lastLoadTime) {
    return gameState;
  }

  // Получаем данные для расчета
  const currentContainerSnot = gameState.inventory.containerSnot || 0;
  const containerCapacity = gameState.inventory.containerCapacity || 1;
  const fillingSpeed = gameState.inventory.fillingSpeed || 1;
  
  // Вычисляем новое значение containerSnot
  const updatedContainerSnot = calculateAccumulatedContainerSnot(
    lastLoadTime,
    currentTime,
    fillingSpeed,
    currentContainerSnot,
    containerCapacity
  );
  
  // Создаем новый объект без добавления нестандартных полей
  const result = {
    ...gameState,
    inventory: {
      ...gameState.inventory,
      containerSnot: updatedContainerSnot
    }
  };
  
  // Также сохраняем время обновления непосредственно в исходный объект
  // для отладки, не используя его в возвращаемом результате
  if (state) {
    state._lastTimeBasedUpdate = currentTime;
  }
  
  return result;
} 