/**
 * Константы и начальные значения для игры
 */

import type { GameState } from '../types/gameTypes';

/**
 * Создает начальное состояние игры для нового пользователя
 * @param userId ID пользователя
 * @returns Начальное состояние игры
 */
export function createInitialGameState(userId: string): GameState {
  return {
    ...initialState,
    _userId: userId
  };
}

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
    containerCapacity: 100,
    containerSnot: 0, 
    fillingSpeed: 1,
    containerCapacityLevel: 1,
    fillingSpeedLevel: 1,
    collectionEfficiency: 1,
    Cap: 100,
    lastUpdateTimestamp: Date.now()
  },
  container: {
    level: 1,
    capacity: 100,
    currentAmount: 0,
    fillRate: 1,
    currentFill: 0
  },
  upgrades: {
    containerLevel: 1,
    fillingSpeedLevel: 1,
    clickPower: { level: 1, value: 1 },
    passiveIncome: { level: 1, value: 0.1 },
    collectionEfficiencyLevel: 1
  },
  _saveVersion: 1,
  _lastSaved: new Date().toISOString(),
  _userId: '',
  _lastModified: Date.now(),
  _createdAt: new Date().toISOString(),
  _wasRepaired: false,
  _repairedAt: Date.now(),
  _repairedFields: [],
  _tempData: null,
  _isSavingInProgress: false,
  _skipSave: false,
  _lastSaveError: null,
  _isBeforeUnloadSave: false,
  _isRestoredFromBackup: false,
  _isInitialState: true,
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
    language: 'en',
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
    backgroundMusicVolume: 0.5,
    isMuted: false,
    isEffectsMuted: false,
    isBackgroundMusicMuted: false
  },
  hideInterface: false,
  activeTab: 'game',
  fillingSpeed: 1,
  containerLevel: 1,
  isPlaying: false,
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
  containerCapacity: [100, 150, 250, 400, 600, 1000],
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

export const SAVE_INTERVALS = {
  MIN_SAVE_INTERVAL: 10000,
  MIN_FORCE_SAVE_INTERVAL: 5000,
  MIN_LOAD_INTERVAL: 2000,
  SAVE_RETRY_DELAY: 3000,
  SAVE_DEBOUNCE_DELAY: 10000
};

export const THRESHOLDS = {
  snot: 10,
  snotCoins: 1,
  containerAmount: 5
};

export const MAX_RETRIES = 3; 