/**
 * Модуль проверки целостности данных для игровых сохранений
 * Обеспечивает валидацию и восстановление структуры данных
 */

import { ExtendedGameState, Inventory, Upgrades } from "../types/gameTypes";
import { StructuredGameSave } from "../types/saveTypes";

/**
 * Результат проверки целостности данных
 */
export interface DataIntegrityResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  repaired: boolean;
  repairedFields: string[];
  state: ExtendedGameState;
}

/**
 * Критические поля инвентаря, которые должны существовать
 */
const criticalInventoryFields = [
  "snot",
  "snotCoins",
  "containerCapacity",
  "containerCapacityLevel",
  "fillingSpeed",
  "fillingSpeedLevel"
];

/**
 * Критические поля улучшений, которые должны существовать
 */
const criticalUpgradeFields = [
  "containerLevel",
  "fillingSpeedLevel",
  "collectionEfficiencyLevel",
  "clickPower",
  "passiveIncome"
];

/**
 * Создает состояние по умолчанию для восстановления поврежденных данных
 * @returns Базовое состояние по умолчанию
 */
function createDefaultRepairState(): ExtendedGameState {
  return {
    inventory: {
      snot: 0,
      snotCoins: 0,
      containerCapacity: 100,
      containerCapacityLevel: 1,
      fillingSpeed: 1,
      fillingSpeedLevel: 1,
      collectionEfficiency: 1,
      containerSnot: 0,
      Cap: 0,
      lastUpdateTimestamp: Date.now()
    },
    upgrades: {
      containerLevel: 1,
      fillingSpeedLevel: 1,
      collectionEfficiencyLevel: 1,
      clickPower: { level: 1, value: 1 },
      passiveIncome: { level: 1, value: 0.1 }
    },
    container: {
      level: 1,
      capacity: 100,
      currentAmount: 0,
      fillRate: 1,
      currentFill: 0
    },
    
    // Базовые данные
    items: [],
    achievements: { unlockedAchievements: [] },
    stats: {},
    
    // Настройки
    settings: {
      language: 'en',
      theme: 'light',
      notifications: true,
      tutorialCompleted: false
    },
    
    soundSettings: {
      clickVolume: 0.5,
      effectsVolume: 0.5,
      backgroundMusicVolume: 0.3,
      isMuted: false,
      isEffectsMuted: false,
      isBackgroundMusicMuted: false
    },
    
    // Состояние UI
    activeTab: 'main',
    hideInterface: false,
    isPlaying: false,
    isLoading: false,
    
    // Прогресс
    containerLevel: 1,
    fillingSpeed: 1,
    containerSnot: 0,
    gameStarted: false,
    highestLevel: 1,
    consecutiveLoginDays: 0,
    
    // Пользователь
    user: null,
    validationStatus: "pending",
    
    // Метаданные
    _saveVersion: 1,
    _lastModified: Date.now(),
    _wasRepaired: true,
    _repairedAt: Date.now()
  };
}

/**
 * Проверяет наличие критических полей в инвентаре
 * @param inventory Инвентарь для проверки
 * @returns Результат проверки
 */
export function validateInventory(inventory: Inventory): { isValid: boolean; missingFields: string[] } {
  const result = { isValid: true, missingFields: [] as string[] };
  
  for (const field of criticalInventoryFields) {
    if (inventory[field as keyof Inventory] === undefined) {
      result.isValid = false;
      result.missingFields.push(field);
    }
  }
  
  return result;
}

/**
 * Проверяет наличие критических полей в улучшениях
 * @param upgrades Улучшения для проверки
 * @returns Результат проверки
 */
export function validateUpgrades(upgrades: Upgrades): { isValid: boolean; missingFields: string[] } {
  const result = { isValid: true, missingFields: [] as string[] };
  
  for (const field of criticalUpgradeFields) {
    if (upgrades[field as keyof Upgrades] === undefined) {
      result.isValid = false;
      result.missingFields.push(field);
    }
  }
  
  return result;
}

/**
 * Проверяет целостность состояния игры
 * @param state Состояние для проверки
 * @returns Результат проверки целостности данных
 */
export function verifyGameStateIntegrity(state: ExtendedGameState): DataIntegrityResult {
  const result: DataIntegrityResult = {
    isValid: true,
    errors: [],
    warnings: [],
    repaired: false,
    repairedFields: [],
    state: {...state}
  };
  
  // Проверяем наличие инвентаря
  if (!state.inventory) {
    result.isValid = false;
    result.errors.push("Отсутствует инвентарь");
    result.state.inventory = {
      snot: 0,
      snotCoins: 0,
      containerCapacity: 100,
      containerCapacityLevel: 1,
      fillingSpeed: 1,
      fillingSpeedLevel: 1,
      collectionEfficiency: 1,
      containerSnot: 0,
      Cap: 0,
      lastUpdateTimestamp: Date.now()
    };
    result.repairedFields.push('inventory');
    result.repaired = true;
  } else {
    const inventoryResult = validateInventory(state.inventory);
    if (!inventoryResult.isValid) {
      result.isValid = false;
      for (const field of inventoryResult.missingFields) {
        result.errors.push(`Отсутствует ${field} в инвентаре`);
        // Восстанавливаем отсутствующие поля
        if (field === "snot" || field === "snotCoins" || field === "containerSnot" || field === "Cap") {
          (result.state.inventory as any)[field] = 0;
        } else if (field === "containerCapacity") {
          result.state.inventory.containerCapacity = 100;
        } else if (field === "containerCapacityLevel" || field === "fillingSpeedLevel") {
          (result.state.inventory as any)[field] = 1;
        } else if (field === "fillingSpeed" || field === "collectionEfficiency") {
          (result.state.inventory as any)[field] = 1;
        }
        result.repairedFields.push(`inventory.${field}`);
        result.repaired = true;
      }
    }
  }
  
  // Проверяем наличие улучшений
  if (!state.upgrades) {
    result.isValid = false;
    result.errors.push("Отсутствуют улучшения");
    result.state.upgrades = {
      containerLevel: 1,
      fillingSpeedLevel: 1,
      collectionEfficiencyLevel: 1,
      clickPower: { level: 1, value: 1 },
      passiveIncome: { level: 1, value: 0.1 }
    };
    result.repairedFields.push('upgrades');
    result.repaired = true;
  } else {
    const upgradesResult = validateUpgrades(state.upgrades);
    if (!upgradesResult.isValid) {
      result.isValid = false;
      for (const field of upgradesResult.missingFields) {
        result.errors.push(`Отсутствует ${field} в улучшениях`);
        // Восстанавливаем отсутствующие поля
        if (field === "containerLevel" || field === "fillingSpeedLevel" || field === "collectionEfficiencyLevel") {
          (result.state.upgrades as any)[field] = 1;
        } else if (field === "clickPower") {
          result.state.upgrades.clickPower = { level: 1, value: 1 };
        } else if (field === "passiveIncome") {
          result.state.upgrades.passiveIncome = { level: 1, value: 0.1 };
        }
        result.repairedFields.push(`upgrades.${field}`);
        result.repaired = true;
      }
    }
  }
  
  // Проверяем наличие контейнера
  if (!state.container) {
    result.isValid = false;
    result.errors.push("Отсутствует контейнер");
    result.state.container = {
      level: 1,
      capacity: 100,
      currentAmount: 0,
      fillRate: 1,
      currentFill: 0
    };
    result.repairedFields.push('container');
    result.repaired = true;
  } else if (state.container.level === undefined) {
    result.warnings.push("Отсутствует уровень контейнера");
    result.state.container.level = 1;
    result.repairedFields.push('container.level');
    result.repaired = true;
  }
  
  // Проверяем наличие настроек
  if (!state.settings) {
    result.isValid = false;
    result.errors.push("Отсутствуют настройки");
    result.state.settings = {
      language: 'en',
      theme: 'light',
      notifications: true,
      tutorialCompleted: false
    };
    result.repairedFields.push('settings');
    result.repaired = true;
  }
  
  // Проверяем наличие звуковых настроек
  if (!state.soundSettings) {
    result.isValid = false;
    result.errors.push("Отсутствуют звуковые настройки");
    result.state.soundSettings = {
      clickVolume: 0.5,
      effectsVolume: 0.5,
      backgroundMusicVolume: 0.3,
      isMuted: false,
      isEffectsMuted: false,
      isBackgroundMusicMuted: false
    };
    result.repairedFields.push('soundSettings');
    result.repaired = true;
  }
  
  return result;
}

/**
 * Проверяет целостность структурированного сохранения
 * @param save Структурированное сохранение
 * @returns Результат проверки целостности данных
 */
export function verifyStructuredSaveIntegrity(save: StructuredGameSave): DataIntegrityResult {
  // Создаем пустое состояние для сборки результата
  const emptyState = createDefaultRepairState();
  
  const result: DataIntegrityResult = {
    isValid: true,
    errors: [],
    warnings: [],
    repaired: false,
    repairedFields: [],
    state: emptyState
  };
  
  // Проверяем наличие критических данных
  if (!save.critical) {
    result.isValid = false;
    result.errors.push('Отсутствуют критические данные');
    return result;
  }
  
  // Проверяем инвентарь
  if (!save.critical.inventory) {
    result.isValid = false;
    result.errors.push('Отсутствует инвентарь в критических данных');
  } else {
    // Проверяем необходимые поля инвентаря
    for (const field of criticalInventoryFields) {
      if ((save.critical.inventory as any)[field] === undefined) {
        result.isValid = false;
        result.errors.push(`Отсутствует ${field} в инвентаре`);
      }
    }
  }
  
  // Проверяем улучшения
  if (!save.critical.upgrades) {
    result.isValid = false;
    result.errors.push('Отсутствуют улучшения в критических данных');
  }
  
  // Проверяем контейнер (опционально)
  if (!save.critical.container) {
    result.warnings.push('Отсутствует контейнер в критических данных');
  }
  
  // Проверяем метаданные
  if (!save.critical.metadata) {
    result.isValid = false;
    result.errors.push('Отсутствуют метаданные в критических данных');
  } else {
    // Проверяем необходимые поля метаданных
    if (save.critical.metadata.version === undefined) {
      result.isValid = false;
      result.errors.push('Отсутствует версия в метаданных');
    }
    
    if (save.critical.metadata.lastModified === undefined) {
      result.isValid = false;
      result.errors.push('Отсутствует timestamp в метаданных');
    }
  }
  
  return result;
}

/**
 * Проверяет целостность состояния и восстанавливает его при необходимости
 * @param state Состояние для проверки и восстановления
 * @returns Состояние с восстановленными данными
 */
export function validateAndRepairGameState(state: ExtendedGameState | null): ExtendedGameState {
  // Если состояние отсутствует, создаем новое
  if (!state) {
    return createDefaultRepairState();
  }
  
  // Проверяем целостность данных
  const integrityResult = verifyGameStateIntegrity(state);
  
  // Если данные валидны, возвращаем исходное состояние
  if (integrityResult.isValid) {
    return state;
  }
  
  // Если данные были восстановлены, добавляем информацию о восстановлении
  const repairedState = integrityResult.state;
  repairedState._wasRepaired = true;
  repairedState._repairedAt = Date.now();
  repairedState._repairedFields = integrityResult.repairedFields;
  
  return repairedState;
} 