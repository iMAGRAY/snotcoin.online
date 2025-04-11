/**
 * Константы и начальные состояния для игры
 */

import { GameState, ExtendedGameState } from '../types/gameTypes';
import { Inventory } from '../types/inventory';

/**
 * Создает начальное состояние игры
 */
export const createInitialGameState = (userId: string): ExtendedGameState => {
  const now = new Date().toISOString();
  
  return {
    user: null,
    inventory: {
      snot: 0,
      snotCoins: 0,
      containerSnot: 0.05,
      containerCapacity: 1,
      containerCapacityLevel: 1,
      fillingSpeed: 1, // Скорость заполнения: 1 snot за 24 часа на уровне 1
      fillingSpeedLevel: 1,
      collectionEfficiency: 1.0,
      lastUpdateTimestamp: Date.now()
    },
    container: {
      level: 1,
      capacity: 1,
      currentAmount: 0.05,
      fillRate: 0.01,
      currentFill: 0.05,
      fillingSpeed: 1, // Скорость заполнения: 1 snot за 24 часа на уровне 1
      lastUpdateTimestamp: Date.now()
    },
    upgrades: {
      containerCapacity: {
        level: 1,
        cost: 0
      },
      fillingSpeed: {
        level: 1,
        cost: 0
      },
      collectionEfficiencyLevel: 1,
      containerLevel: 1,
      fillingSpeedLevel: 1,
      clickPower: { level: 1, value: 1 },
      passiveIncome: { level: 1, value: 0.1 }
    },
    _userId: userId,
    _provider: userId !== 'unknown' ? 'local' as const : '',
    _lastModified: Date.now(),
    _createdAt: now,
    _tempData: null,
    _lastActionTime: now,
    _lastAction: 'init',
    _dataSource: 'new',
    _loadedAt: now,
    logs: [],
    analytics: null,
    items: [],
    achievements: {
      unlockedAchievements: []
    },
    highestLevel: 1,
    stats: {
      clickCount: 0,
      playTime: 0,
      startDate: now,
      highestLevel: 1,
      totalSnot: 0,
      totalSnotCoins: 0,
      consecutiveLoginDays: 0
    },
    consecutiveLoginDays: 0,
    settings: {
      language: 'ru',
      theme: 'light',
      notifications: true,
      tutorialCompleted: false,
      musicEnabled: true,
      soundEnabled: true,
      notificationsEnabled: true
    },
    soundSettings: {
      musicVolume: 0.5,
      soundVolume: 0.5,
      notificationVolume: 0.5,
      clickVolume: 0.5,
      effectsVolume: 0.5,
      backgroundMusicVolume: 0.25,
      isMuted: false,
      isEffectsMuted: false,
      isBackgroundMusicMuted: false
    },
    hideInterface: false,
    activeTab: 'main',
    fillingSpeed: 1, // Общая скорость заполнения на уровне 1
    containerLevel: 1,
    isPlaying: false,
    isGameInstanceRunning: false,
    validationStatus: 'valid',
    lastValidation: now,
    gameStarted: false,
    isLoading: false,
    saveProgress: null as unknown as (() => void)
  };
};

/**
 * Константы для игры
 */
export const GAME_VERSION = 1;

/**
 * Начальное состояние игры
 */
export const initialState: GameState = {
  user: null,
  inventory: {
    snot: 0,
    snotCoins: 0,
    containerSnot: 0.05,
    containerCapacity: 1,
    containerCapacityLevel: 1,
    fillingSpeed: 1, // Скорость заполнения: 1 snot за 24 часа на уровне 1
    fillingSpeedLevel: 1,
    collectionEfficiency: 1,
    lastUpdateTimestamp: Date.now()
  },
  container: {
    level: 1,
    capacity: 1,
    currentAmount: 0,
    fillRate: 1,
    currentFill: 0,
    fillingSpeed: 1, // Скорость заполнения: 1 snot за 24 часа на уровне 1
    lastUpdateTimestamp: Date.now()
  },
  upgrades: {
    containerLevel: 1,
    fillingSpeedLevel: 1,
    clickPower: { level: 1, value: 1 },
    passiveIncome: { level: 1, value: 0.1 },
    collectionEfficiencyLevel: 1,
    containerCapacity: {
      level: 1,
      cost: 0
    },
    fillingSpeed: {
      level: 1,
      cost: 0
    }
  },
  _userId: '',
  _lastModified: Date.now(),
  _createdAt: new Date().toISOString(),
  _tempData: null,
  _lastActionTime: new Date().toISOString(),
  _lastAction: 'RESET_GAME_STATE',
  logs: [],
  analytics: null,
  items: [],
  achievements: { unlockedAchievements: [] },
  highestLevel: 1,
  stats: {
    clickCount: 0,
    playTime: 0,
    startDate: new Date().toISOString(),
    highestLevel: 1,
    totalSnot: 0,
    totalSnotCoins: 0,
    consecutiveLoginDays: 0
  },
  consecutiveLoginDays: 0,
  settings: {
    language: 'ru',
    theme: 'light',
    notifications: true,
    tutorialCompleted: false,
    musicEnabled: true,
    soundEnabled: true,
    notificationsEnabled: true
  },
  soundSettings: {
    musicVolume: 0.5,
    soundVolume: 0.5,
    notificationVolume: 0.5,
    clickVolume: 0.5,
    effectsVolume: 0.5,
    backgroundMusicVolume: 0.25,
    isMuted: false,
    isEffectsMuted: false,
    isBackgroundMusicMuted: false
  },
  hideInterface: false,
  activeTab: 'game',
  fillingSpeed: 1,
  containerLevel: 1,
  isPlaying: false,
  isGameInstanceRunning: false,
  validationStatus: 'pending',
  lastValidation: new Date().toISOString(),
  gameStarted: false,
  isLoading: false
};

/**
 * Стоимость улучшений
 */
export const UPGRADE_COSTS = {
  containerCapacity: [
    { level: 1, cost: 0 },
    { level: 2, cost: 100 },
    { level: 3, cost: 250 },
    { level: 4, cost: 500 },
    { level: 5, cost: 1000 }
  ],
  fillingSpeed: [
    { level: 1, cost: 0 },
    { level: 2, cost: 150 },
    { level: 3, cost: 350 },
    { level: 4, cost: 700 },
    { level: 5, cost: 1500 }
  ],
  collectionEfficiency: [
    { level: 1, cost: 0 },
    { level: 2, cost: 200 },
    { level: 3, cost: 450 },
    { level: 4, cost: 900 },
    { level: 5, cost: 2000 }
  ],
  clickPower: [
    { level: 1, cost: 0 },
    { level: 2, cost: 50 },
    { level: 3, cost: 150 },
    { level: 4, cost: 300 },
    { level: 5, cost: 600 }
  ],
  passiveIncome: [
    { level: 0, cost: 0 },
    { level: 1, cost: 300 },
    { level: 2, cost: 600 },
    { level: 3, cost: 1200 },
    { level: 4, cost: 2400 },
    { level: 5, cost: 4800 }
  ]
};

/**
 * Значения улучшений
 */
export const UPGRADE_VALUES = {
  containerCapacity: [1, 2, 3, 5, 8, 12],
  fillingSpeed: [1, 1.5, 2, 3, 4, 6],
  collectionEfficiency: [1, 1.2, 1.5, 1.8, 2.2, 3],
  clickPower: [1, 2, 3, 5, 8, 12],
  passiveIncome: [0, 0.1, 0.3, 0.5, 1, 2]
};

/**
 * Достижения
 */
export const ACHIEVEMENTS = [
  { id: 'first_snot', name: 'Первая сопля', description: 'Получите первую соплю', requirement: 1 },
  { id: 'snot_10', name: 'Соплезбиратель', description: 'Соберите 10 соплей', requirement: 10 },
  { id: 'snot_100', name: 'Соплезбиратель+', description: 'Соберите 100 соплей', requirement: 100 },
  { id: 'snot_1000', name: 'Соплезбиратель++', description: 'Соберите 1000 соплей', requirement: 1000 },
  { id: 'coin_10', name: 'Первые монеты', description: 'Соберите 10 монет', requirement: 10 },
  { id: 'coin_100', name: 'Копилка', description: 'Соберите 100 монет', requirement: 100 },
  { id: 'coin_1000', name: 'Богатство', description: 'Соберите 1000 монет', requirement: 1000 },
  { id: 'max_container', name: 'Максимальный контейнер', description: 'Улучшите контейнер до максимума', requirement: 5 },
  { id: 'max_speed', name: 'Максимальная скорость', description: 'Улучшите скорость до максимума', requirement: 5 },
  { id: 'max_efficiency', name: 'Максимальная эффективность', description: 'Улучшите эффективность до максимума', requirement: 5 }
];

export const THRESHOLDS = {
  snot: 10,
  snotCoins: 1,
  containerAmount: 5
};

export const MAX_RETRIES = 3;

export const RESOURCES = {
  DEFAULTS: {
    MIN_LEVEL: 1,
    MIN_CAPACITY: 1,
    MIN_FILLING_SPEED: 1,
    COLLECTION_EFFICIENCY: 1
  }
};

export const DEFAULT_INVENTORY: Inventory = {
  snot: 0,
  snotCoins: 0,
  containerSnot: 0.05,
  containerCapacity: 1,
  containerCapacityLevel: 1,
  fillingSpeed: 1, // Скорость заполнения: 1 snot за 24 часа на уровне 1
  fillingSpeedLevel: 1,
  collectionEfficiency: 1,
  lastUpdateTimestamp: Date.now()
};

// Константы для обновления ресурсов
export const FILL_RATES = {
  // На уровне 1 заполняем 1 единицу snotа за 24 часов
  BASE_FILL_RATE: 0.5, // Базовый уровень, при котором 1 единица snot заполняется за 24 часов
  
  // Базовая скорость заполнения в единицах в секунду для уровня 1
  // 1 snot за 24 часов = 1 / (24 * 3600) snot в секунду
  BASE_CONTAINER_FILL_RATE: 1 / (24 * 3600), // Точная формула для заполнения за 24 часа
  
  // Коэффициент улучшения на каждом уровне (значение fillingSpeed)
  LEVEL_1_FILL_SPEED: 1,    // 1 snot за 24 часов
  LEVEL_2_FILL_SPEED: 1.5,  // 1 snot за 16 часов
  LEVEL_3_FILL_SPEED: 2,    // 1 snot за 12 часов
  LEVEL_4_FILL_SPEED: 3,    // 1 snot за 8 часов
  LEVEL_5_FILL_SPEED: 4,    // 1 snot за 6 часов
  
  // Время полного заполнения на 1 уровне в часах
  FULL_CONTAINER_FILL_TIME_HOURS: 24
};

/**
 * Рассчитывает емкость контейнера на основе уровня
 * @param level Уровень контейнера
 * @returns Емкость контейнера
 */
function calculateContainerCapacity(level: number): number {
  // Проверяем, что уровень находится в допустимом диапазоне
  const safeLevel = Math.max(1, Math.min(level, UPGRADE_VALUES.containerCapacity.length));
  
  // Получаем емкость на основе уровня из массива значений
  const capacity = UPGRADE_VALUES.containerCapacity[safeLevel - 1];
  
  // Проверяем, что значение определено
  return typeof capacity === 'number' ? capacity : 1;
} 