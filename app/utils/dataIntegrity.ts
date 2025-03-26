/**
 * Модуль для проверки целостности данных и валидации состояния игры
 * Обеспечивает надежность работы с данными пользователей
 */

import { ExtendedGameState, GameState, Inventory, Container, Upgrades } from "../types/gameTypes";
import { StructuredGameSave, IntegrityData } from "../types/saveTypes";
import { createInitialGameState } from "../constants/gameConstants";

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
 * Интерфейс для статистики игры в рамках модуля целостности данных
 */
interface GameStats extends Record<string, any> {
  highestLevel: number;
  clickCount: number;
  totalSnot: number;
  totalSnotCoins: number;
  playTime: number;
  startDate: string; // Явно указываем, что это строка
  consecutiveLoginDays: number;
}

/**
 * Создает состояние по умолчанию для восстановления поврежденных данных
 * @returns Базовое состояние по умолчанию
 */
function createDefaultRepairState(): ExtendedGameState {
  const defaultState: ExtendedGameState = {
    // Инвентарь
    inventory: {
      snot: 0,
      snotCoins: 0,
      containerCapacity: 100,
      containerCapacityLevel: 1,
      fillingSpeed: 1,
      fillingSpeedLevel: 1,
      collectionEfficiency: 1,
      containerSnot: 0,
      Cap: 100,
      lastUpdateTimestamp: Date.now()
    },
    
    // Улучшения
    upgrades: {
      containerLevel: 1,
      fillingSpeedLevel: 1,
      clickPower: { level: 1, value: 1 },
      passiveIncome: { level: 1, value: 0.1 },
      collectionEfficiencyLevel: 1
    },
    
    // Контейнер
    container: {
      level: 1,
      capacity: 100,
      currentAmount: 0,
      fillRate: 1
    },
    
    // Статистика
    stats: {
      clickCount: 0,
      playTime: 0,
      startDate: new Date().toISOString(),
      highestLevel: 1,
      totalSnot: 0,
      totalSnotCoins: 0,
      consecutiveLoginDays: 0
    },
    
    // Настройки
    settings: {
      language: 'en',
      theme: 'light',
      notifications: true,
      tutorialCompleted: false,
      musicEnabled: true,
      soundEnabled: true,
      notificationsEnabled: true
    },
    
    soundSettings: {
      clickVolume: 0.5,
      effectsVolume: 0.5,
      backgroundMusicVolume: 0.3,
      isMuted: false,
      isEffectsMuted: false,
      isBackgroundMusicMuted: false,
      musicVolume: 0.5,
      soundVolume: 0.5,
      notificationVolume: 0.5
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
  
  return defaultState;
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
      tutorialCompleted: false,
      musicEnabled: true,
      soundEnabled: true,
      notificationsEnabled: true
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
      isBackgroundMusicMuted: false,
      musicVolume: 0.5,
      soundVolume: 0.5,
      notificationVolume: 0.5
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
 * Проверяет и восстанавливает состояние игры
 * @param state Состояние игры для проверки
 * @returns Исправленное состояние
 */
export function validateAndRepairGameState(state: ExtendedGameState): ExtendedGameState {
  if (!state) {
    console.error('[dataIntegrity] Null or undefined game state');
    return createEmptyGameState();
  }
  
  try {
    // Клонируем состояние для безопасности
    const fixedState = JSON.parse(JSON.stringify(state));
    
    // Базовые поля
    fixedState._saveVersion = fixedState._saveVersion || 1;
    fixedState._lastModified = fixedState._lastModified || Date.now();
    fixedState._userId = fixedState._userId || 'unknown';
    
    // Проверяем и восстанавливаем критические структуры
    fixedState.inventory = repairInventory(fixedState.inventory);
    fixedState.container = repairContainer(fixedState.container);
    fixedState.upgrades = repairUpgrades(fixedState.upgrades);
    
    // Проверяем массивы
    fixedState.items = Array.isArray(fixedState.items) ? fixedState.items : [];
    
    // Проверяем объекты
    fixedState.achievements = fixedState.achievements || { unlockedAchievements: [] };
    if (!Array.isArray(fixedState.achievements.unlockedAchievements)) {
      fixedState.achievements.unlockedAchievements = [];
    }
    
    // Проверяем статистику
    fixedState.stats = fixedState.stats || {};
    fixedState.stats.highestLevel = fixedState.stats.highestLevel || 1;
    fixedState.stats.clickCount = fixedState.stats.clickCount || 0;
    fixedState.stats.totalSnot = fixedState.stats.totalSnot || 0;
    fixedState.stats.totalSnotCoins = fixedState.stats.totalSnotCoins || 0;
    fixedState.stats.playTime = fixedState.stats.playTime || 0;
    fixedState.stats.startDate = fixedState.stats.startDate || new Date().toISOString();
    fixedState.stats.consecutiveLoginDays = fixedState.stats.consecutiveLoginDays || 0;
    
    // Настройки
    fixedState.settings = {
      language: fixedState.settings?.language || 'en',
      theme: fixedState.settings?.theme || 'light', 
      notifications: fixedState.settings?.notifications ?? true,
      tutorialCompleted: fixedState.settings?.tutorialCompleted ?? false,
      musicEnabled: fixedState.settings?.musicEnabled ?? true,
      soundEnabled: fixedState.settings?.soundEnabled ?? true,
      notificationsEnabled: fixedState.settings?.notificationsEnabled ?? true
    };
    
    fixedState.soundSettings = {
      clickVolume: fixedState.soundSettings?.clickVolume ?? 0.5,
      effectsVolume: fixedState.soundSettings?.effectsVolume ?? 0.5,
      backgroundMusicVolume: fixedState.soundSettings?.backgroundMusicVolume ?? 0.3,
      isMuted: fixedState.soundSettings?.isMuted ?? false,
      isEffectsMuted: fixedState.soundSettings?.isEffectsMuted ?? false,
      isBackgroundMusicMuted: fixedState.soundSettings?.isBackgroundMusicMuted ?? false,
      musicVolume: fixedState.soundSettings?.musicVolume ?? 0.5,
      soundVolume: fixedState.soundSettings?.soundVolume ?? 0.5,
      notificationVolume: fixedState.soundSettings?.notificationVolume ?? 0.5
    };
    
    // Интерфейс и состояние игры
    fixedState.activeTab = fixedState.activeTab || 'laboratory';
    fixedState.hideInterface = !!fixedState.hideInterface;
    fixedState.isPlaying = !!fixedState.isPlaying;
    fixedState.isLoading = !!fixedState.isLoading;
    fixedState.gameStarted = fixedState.gameStarted !== false;
    fixedState.highestLevel = fixedState.highestLevel || 1;
    fixedState.consecutiveLoginDays = fixedState.consecutiveLoginDays || 0;
    
    // Пользователь
    fixedState.validationStatus = fixedState.validationStatus || 'pending';
    
    return fixedState;
  } catch (error) {
    console.error('[dataIntegrity] Error repairing game state:', error);
    return createEmptyGameState();
  }
}

/**
 * Восстанавливает инвентарь
 * @param inventory Инвентарь для восстановления
 * @returns Исправленный инвентарь
 */
function repairInventory(inventory: any): any {
  if (!inventory || typeof inventory !== 'object') {
    return { snot: 0, snotCoins: 0, containerSnot: 0 };
  }
  
  const fixedInventory = { ...inventory };
  
  // Проверяем основные значения
  fixedInventory.snot = !isNaN(fixedInventory.snot) ? fixedInventory.snot : 0;
  fixedInventory.snotCoins = !isNaN(fixedInventory.snotCoins) ? fixedInventory.snotCoins : 0;
  fixedInventory.containerSnot = !isNaN(fixedInventory.containerSnot) ? fixedInventory.containerSnot : 0;
  
  return fixedInventory;
}

/**
 * Восстанавливает контейнер
 * @param container Контейнер для восстановления
 * @returns Исправленный контейнер
 */
function repairContainer(container: any): any {
  if (!container || typeof container !== 'object') {
    return { level: 1, capacity: 100, currentAmount: 0, fillRate: 1 };
  }
  
  const fixedContainer = { ...container };
  
  // Проверяем основные значения
  fixedContainer.level = !isNaN(fixedContainer.level) ? Math.max(1, fixedContainer.level) : 1;
  fixedContainer.capacity = !isNaN(fixedContainer.capacity) ? Math.max(100, fixedContainer.capacity) : 100;
  fixedContainer.currentAmount = !isNaN(fixedContainer.currentAmount) ? Math.max(0, fixedContainer.currentAmount) : 0;
  fixedContainer.fillRate = !isNaN(fixedContainer.fillRate) ? Math.max(1, fixedContainer.fillRate) : 1;
  
  // Проверяем корректность значений
  if (fixedContainer.currentAmount > fixedContainer.capacity) {
    fixedContainer.currentAmount = fixedContainer.capacity;
  }
  
  return fixedContainer;
}

/**
 * Восстанавливает улучшения
 * @param upgrades Улучшения для восстановления
 * @returns Исправленные улучшения
 */
function repairUpgrades(upgrades: any): any {
  if (!upgrades || typeof upgrades !== 'object') {
    return { autoClicker: 0, snotMultiplier: 0, containerMultiplier: 0 };
  }
  
  const fixedUpgrades = { ...upgrades };
  
  // Проверяем основные значения
  fixedUpgrades.autoClicker = !isNaN(fixedUpgrades.autoClicker) ? Math.max(0, fixedUpgrades.autoClicker) : 0;
  fixedUpgrades.snotMultiplier = !isNaN(fixedUpgrades.snotMultiplier) ? Math.max(0, fixedUpgrades.snotMultiplier) : 0;
  fixedUpgrades.containerMultiplier = !isNaN(fixedUpgrades.containerMultiplier) ? Math.max(0, fixedUpgrades.containerMultiplier) : 0;
  
  return fixedUpgrades;
}

/**
 * Создает пустое состояние игры
 * @returns Пустое состояние игры
 */
function createEmptyGameState(): ExtendedGameState {
  const timestamp = Date.now();
  const currentTime = new Date().toISOString();
  
  // Создаем статистику с правильными типами
  const stats: GameStats = {
    highestLevel: 1,
    clickCount: 0,
    totalSnot: 0,
    totalSnotCoins: 0,
    playTime: 0,
    startDate: currentTime, // Используем строку в формате ISO
    consecutiveLoginDays: 0
  };
  
  const result: ExtendedGameState = {
    // Критические данные
    inventory: { 
      snot: 0, 
      snotCoins: 0, 
      containerSnot: 0,
      containerCapacity: 100,
      containerCapacityLevel: 1,
      fillingSpeed: 1,
      fillingSpeedLevel: 1,
      collectionEfficiency: 1,
      Cap: 0,
      lastUpdateTimestamp: timestamp
    },
    container: { level: 1, capacity: 100, currentAmount: 0, fillRate: 1 },
    upgrades: { 
      containerLevel: 1, 
      fillingSpeedLevel: 1,
      collectionEfficiencyLevel: 1,
      clickPower: { level: 1, value: 1 },
      passiveIncome: { level: 1, value: 0.1 }
    },
    
    // Регулярные данные
    items: [],
    achievements: { unlockedAchievements: [] },
    stats, // Используем созданную статистику
    
    // Настройки
    settings: {
      language: 'en',
      theme: 'light',
      notifications: true,
      tutorialCompleted: false,
      musicEnabled: true,
      soundEnabled: true,
      notificationsEnabled: true
    },
    
    soundSettings: {
      clickVolume: 0.5,
      effectsVolume: 0.5,
      backgroundMusicVolume: 0.3,
      isMuted: false,
      isEffectsMuted: false,
      isBackgroundMusicMuted: false,
      musicVolume: 0.5,
      soundVolume: 0.5,
      notificationVolume: 0.5
    },
    
    // Интерфейс и состояние игры
    activeTab: 'laboratory',
    hideInterface: false,
    isPlaying: false,
    isLoading: false,
    gameStarted: true,
    highestLevel: 1,
    consecutiveLoginDays: 0,
    user: null,
    validationStatus: 'pending',
    
    // Метаданные
    _saveVersion: 1,
    _lastModified: timestamp,
    _userId: 'new_user',
    _decompressedAt: currentTime,
    
    // Добавляем недостающие поля
    containerLevel: 1,
    fillingSpeed: 1,
    containerSnot: 0
  };
  
  return result;
}

/**
 * Генерирует простую контрольную сумму для строки
 * @param data Строка данных для генерации контрольной суммы
 * @returns Строковое представление контрольной суммы
 */
export function generateSimpleChecksum(data: string): string {
  try {
    // Простая хеш-функция
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Преобразуем в 32-битное целое
    }
    
    // Возвращаем хеш в виде шестнадцатеричной строки
    return hash.toString(16);
  } catch (error) {
    console.error('[dataIntegrity] Error generating checksum:', error);
    return '0';
  }
}

/**
 * Проверяет целостность структуры состояния игры
 * @param state Состояние игры для проверки
 * @returns true, если структура корректна
 */
export function isValidGameState(state: any): boolean {
  if (!state || typeof state !== 'object') {
    return false;
  }
  
  // Проверяем наличие критических полей
  const hasCriticalFields = 
    state.inventory && typeof state.inventory === 'object' &&
    state.container && typeof state.container === 'object' &&
    state.upgrades && typeof state.upgrades === 'object';
  
  if (!hasCriticalFields) {
    return false;
  }
  
  // Проверяем корректность основных полей
  const hasValidInventory = 
    !isNaN(state.inventory.snot) &&
    !isNaN(state.inventory.snotCoins);
  
  const hasValidContainer = 
    !isNaN(state.container.level) &&
    !isNaN(state.container.capacity) &&
    !isNaN(state.container.currentAmount);
  
  const hasValidUpgrades = 
    !isNaN(state.upgrades.autoClicker) &&
    !isNaN(state.upgrades.snotMultiplier);
  
  return hasValidInventory && hasValidContainer && hasValidUpgrades;
}

/**
 * Проверяет, является ли объект корректным состоянием игры
 * @param state Объект для проверки
 * @returns true, если это корректное состояние игры
 */
export function isExtendedGameState(state: any): state is ExtendedGameState {
  return isValidGameState(state) && 
    typeof state._saveVersion === 'number' &&
    typeof state._lastModified === 'number';
}

// Функция createStructuredSave, экспортируем для использования в других модулях
export function createStructuredSave(state: ExtendedGameState, userId: string): StructuredGameSave {
  const currentTime = new Date().toISOString();
  
  // Извлекаем ID пользователя из состояния или используем переданный
  const finalUserId = state._userId || userId;
  
  // Преобразовываем saveVersion в числовой тип
  const saveVersion = typeof state._saveVersion === 'string' 
    ? parseInt(state._saveVersion, 10) 
    : (state._saveVersion || 1);
  
  // Подготавливаем необходимые данные
  const inventoryObj = state.inventory || {} as any;
  const containerObj = state.container || {} as any;
  const upgradesObj = state.upgrades || {} as any;
  
  // Инвентарь
  const inventory: Inventory = {
    snot: typeof inventoryObj.snot === 'number' ? inventoryObj.snot : 0, 
    snotCoins: typeof inventoryObj.snotCoins === 'number' ? inventoryObj.snotCoins : 0,
    containerSnot: typeof inventoryObj.containerSnot === 'number' ? inventoryObj.containerSnot : 0,
    containerCapacity: typeof inventoryObj.containerCapacity === 'number' ? inventoryObj.containerCapacity : 100,
    containerCapacityLevel: typeof inventoryObj.containerCapacityLevel === 'number' ? inventoryObj.containerCapacityLevel : 1,
    fillingSpeed: typeof inventoryObj.fillingSpeed === 'number' ? inventoryObj.fillingSpeed : 1,
    fillingSpeedLevel: typeof inventoryObj.fillingSpeedLevel === 'number' ? inventoryObj.fillingSpeedLevel : 1,
    collectionEfficiency: typeof inventoryObj.collectionEfficiency === 'number' ? inventoryObj.collectionEfficiency : 1,
    Cap: typeof inventoryObj.Cap === 'number' ? inventoryObj.Cap : 100,
    lastUpdateTimestamp: typeof inventoryObj.lastUpdateTimestamp === 'number' ? inventoryObj.lastUpdateTimestamp : Date.now()
  };
  
  // Контейнер
  const container: Container = {
    level: typeof containerObj.level === 'number' ? containerObj.level : 1,
    capacity: typeof containerObj.capacity === 'number' ? containerObj.capacity : 100,
    currentAmount: typeof containerObj.currentAmount === 'number' ? containerObj.currentAmount : 0,
    fillRate: typeof containerObj.fillRate === 'number' ? containerObj.fillRate : 1
  };
  
  // Улучшения
  const upgrades: Upgrades = {
    containerLevel: typeof upgradesObj.containerLevel === 'number' ? upgradesObj.containerLevel : 1,
    fillingSpeedLevel: typeof upgradesObj.fillingSpeedLevel === 'number' ? upgradesObj.fillingSpeedLevel : 1,
    collectionEfficiencyLevel: typeof upgradesObj.collectionEfficiencyLevel === 'number' ? upgradesObj.collectionEfficiencyLevel : 1,
    clickPower: typeof upgradesObj.clickPower === 'object' && upgradesObj.clickPower ? 
      {
        level: typeof upgradesObj.clickPower.level === 'number' ? upgradesObj.clickPower.level : 1,
        value: typeof upgradesObj.clickPower.value === 'number' ? upgradesObj.clickPower.value : 1
      } : { level: 1, value: 1 },
    passiveIncome: typeof upgradesObj.passiveIncome === 'object' && upgradesObj.passiveIncome ? 
      {
        level: typeof upgradesObj.passiveIncome.level === 'number' ? upgradesObj.passiveIncome.level : 1,
        value: typeof upgradesObj.passiveIncome.value === 'number' ? upgradesObj.passiveIncome.value : 0.1
      } : { level: 1, value: 0.1 }
  };
  
  // Создаем объект целостности с нужным типом
  const integrityData: IntegrityData = {
    userId: finalUserId,
    saveVersion: saveVersion,
    timestamp: currentTime,
    checksum: generateSimpleChecksum(JSON.stringify(inventory) + JSON.stringify(upgrades))
  };
  
  // Подготавливаем статистику с правильными типами
  const gameStats = {
    highestLevel: state.highestLevel || 1,
    clickCount: state.stats?.clickCount || 0,
    totalSnot: inventory.snot || 0,
    totalSnotCoins: inventory.snotCoins || 0,
    playTime: state.stats?.playTime || 0,
    startDate: typeof state.stats?.startDate === 'string' 
      ? state.stats.startDate 
      : currentTime,
    consecutiveLoginDays: state.consecutiveLoginDays || 0
  };
  
  // Создаем объект структурированного сохранения соответствующий интерфейсу StructuredGameSave
  const structuredSave: StructuredGameSave = {
    // Критические данные
    critical: {
      inventory,
      upgrades,
      container,
      metadata: {
        version: saveVersion,
        lastModified: state._lastModified || Date.now(),
        userId: finalUserId,
        saveCount: 0,
        lastSaved: currentTime
      }
    },
    
    // Регулярные данные
    regular: {
      items: state.items || [],
      achievements: state.achievements || { unlockedAchievements: [] },
      stats: gameStats
    },
    
    // Расширенные данные
    extended: {
      settings: state.settings || {
        language: 'en',
        theme: 'light',
        notifications: true,
        tutorialCompleted: false,
        musicEnabled: true,
        soundEnabled: true,
        notificationsEnabled: true
      },
      soundSettings: state.soundSettings || {
        clickVolume: 0.5,
        effectsVolume: 0.5,
        backgroundMusicVolume: 0.3,
        isMuted: false,
        isEffectsMuted: false,
        isBackgroundMusicMuted: false,
        musicVolume: 0.5,
        soundVolume: 0.5,
        notificationVolume: 0.5
      },
    },
    
    // Данные целостности
    integrity: integrityData,
    
    // Метаданные
    _isCompressed: false,
    _metadata: {
      version: saveVersion,
      userId: finalUserId,
      isCompressed: false,
      savedAt: currentTime,
      loadedAt: currentTime
    }
  };
  
  return structuredSave;
} 