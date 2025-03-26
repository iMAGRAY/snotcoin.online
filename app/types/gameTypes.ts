/**
 * Типы данных для игры
 */

// Типы для Farcaster
export interface FarcasterUser {
  id: string
  fid: number
  username: string
  displayName?: string
  pfp?: string
}

// Пользователь
export interface User {
  id: string;
  username?: string;
  displayName?: string;
  farcaster_fid?: string;
  pfp?: string;
  [key: string]: any;
}

// Настройки
export interface Settings {
  language: string
  theme: string
  notifications: boolean
  tutorialCompleted: boolean
  musicEnabled: boolean
  soundEnabled: boolean
  notificationsEnabled: boolean
}

// Настройки звука
export interface SoundSettings {
  musicVolume: number;
  soundVolume: number;
  notificationVolume: number;
  clickVolume: number;
  effectsVolume: number;
  backgroundMusicVolume: number;
  isMuted: boolean;
  isEffectsMuted: boolean;
  isBackgroundMusicMuted: boolean;
}

/**
 * Состояние инвентаря
 */
export interface Inventory {
  snot: number;
  snotCoins: number;
  containerCapacity: number;
  containerSnot: number;
  fillingSpeed: number;
  collectionEfficiency: number;
  Cap: number;
  containerCapacityLevel: number;
  fillingSpeedLevel: number;
  lastUpdateTimestamp?: number;
}

/**
 * Состояние контейнера
 */
export interface Container {
  level: number;
  capacity: number;
  currentAmount: number;
  fillRate: number;
  currentFill?: number;
}

/**
 * Улучшения
 */
export interface Upgrades {
  clickPower: {
    level: number;
    value: number;
  };
  passiveIncome: {
    level: number;
    value: number;
  };
  collectionEfficiencyLevel: number;
  containerLevel: number;
  fillingSpeedLevel: number;
}

/**
 * Информация о предмете
 */
export interface Item {
  id: string;
  type: string;
  name: string;
  rarity: string;
  value: number;
  effects?: Record<string, number>;
  obtained?: number; // Timestamp
  _lastModified?: number; // Timestamp
}

/**
 * Состояние улучшения
 */
export interface Upgrade {
  level: number;
  value: number;
  maxLevel?: number;
  cost?: number;
  unlocked?: boolean;
}

/**
 * Состояние достижений
 */
export interface Achievements {
  unlockedAchievements: string[];
}

/**
 * Основное состояние игры
 */
export interface GameState {
  user: User | null;
  inventory: Inventory;
  container: Container;
  upgrades: Upgrades;
  _saveVersion?: number;
  _lastSaved?: string;
  _userId?: string;
  _lastModified?: number;
  _wasRepaired?: boolean;
  _repairedAt?: number;
  _repairedFields?: string[];
  _tempData?: any;
  _isSavingInProgress?: boolean;
  _skipSave?: boolean;
  _lastSaveError?: string;
  _isBeforeUnloadSave?: boolean;
  _isRestoredFromBackup?: boolean;
  _isInitialState?: boolean;
  _lastActionTime?: string;
  _lastAction?: string;
  logs?: any[];
  analytics?: any;
  items?: any[];
  achievements?: {
    unlockedAchievements: string[];
  };
  highestLevel?: number;
  stats?: {
    clickCount: number;
    playTime: number;
    startDate: string;
    highestLevel?: number;
    totalSnot?: number;
    totalSnotCoins?: number;
    consecutiveLoginDays?: number;
  };
  consecutiveLoginDays?: number;
  settings?: Settings;
  soundSettings?: SoundSettings;
  hideInterface?: boolean;
  activeTab?: string;
  fillingSpeed?: number;
  containerLevel?: number;
  isPlaying?: boolean;
  validationStatus?: string;
  lastValidation?: string;
  gameStarted?: boolean;
  isLoading?: boolean;
}

export interface ExtendedGameState extends GameState {
  [key: string]: any;
}

export type ActionType =
  | "SET_USER"
  | "SET_INVENTORY"
  | "SET_CONTAINER"
  | "SET_UPGRADES"
  | "SET_SAVE_VERSION"
  | "SET_LAST_SAVED"
  | "SET_USER_ID"
  | "SET_LAST_MODIFIED"
  | "SET_WAS_REPAIRED"
  | "SET_REPAIRED_AT"
  | "SET_REPAIRED_FIELDS"
  | "SET_TEMP_DATA"
  | "SET_LOGS"
  | "SET_ANALYTICS"
  | "SET_ITEMS"
  | "SET_ACHIEVEMENTS"
  | "SET_HIGHEST_LEVEL"
  | "SET_STATS"
  | "SET_CONSECUTIVE_LOGIN_DAYS"
  | "SET_SETTINGS"
  | "SET_SOUND_SETTINGS"
  | "SET_HIDE_INTERFACE"
  | "SET_ACTIVE_TAB"
  | "UPGRADE_CONTAINER_CAPACITY"
  | "UPGRADE_FILLING_SPEED"
  | "LOAD_GAME_STATE"
  | "RESET_GAME_STATE"
  | "FORCE_SAVE_GAME_STATE"
  | "LOGIN"
  | "UPDATE_CONTAINER_LEVEL"
  | "UPDATE_CONTAINER_SNOT"
  | "UPDATE_FILLING_SPEED"
  | "UPDATE_RESOURCES"
  | "SET_RESOURCE"
  | "ADD_SNOT"
  | "COLLECT_CONTAINER_SNOT"
  | "INCREMENT_CONTAINER_CAPACITY"
  | "INITIALIZE_NEW_USER"
  | "LOAD_USER_DATA"
  | "SET_IS_PLAYING"
  | "SET_GAME_STARTED"
  | "SET_CLICK_SOUND_VOLUME"
  | "SET_BACKGROUND_MUSIC_VOLUME"
  | "SET_EFFECTS_SOUND_VOLUME"
  | "SET_MUTE"
  | "SET_EFFECTS_MUTE"
  | "SET_BACKGROUND_MUSIC_MUTE"
  | "UPDATE_INVENTORY"
  | "UPDATE_CONTAINER"
  | "UPDATE_UPGRADES";

export interface Action {
  type: ActionType;
  payload?: any;
}

// Константы для улучшений
export const CONTAINER_UPGRADES = [
  { level: 1, capacity: 100, cost: 0, capacityIncrease: 100 },
  { level: 2, capacity: 200, cost: 100, capacityIncrease: 100 },
  { level: 3, capacity: 400, cost: 300, capacityIncrease: 200 },
  { level: 4, capacity: 800, cost: 700, capacityIncrease: 400 },
  { level: 5, capacity: 1600, cost: 1500, capacityIncrease: 800 },
  { level: 6, capacity: 3200, cost: 3000, capacityIncrease: 1600 },
  { level: 7, capacity: 6400, cost: 6000, capacityIncrease: 3200 },
  { level: 8, capacity: 12800, cost: 12000, capacityIncrease: 6400 },
  { level: 9, capacity: 25600, cost: 24000, capacityIncrease: 12800 },
  { level: 10, capacity: 51200, cost: 48000, capacityIncrease: 25600 }
];

export const FILLING_SPEED_UPGRADES = [
  { level: 1, speed: 1, cost: 0, speedIncrease: 0 },
  { level: 2, speed: 2, cost: 150, speedIncrease: 1 },
  { level: 3, speed: 4, cost: 450, speedIncrease: 2 },
  { level: 4, speed: 8, cost: 1050, speedIncrease: 4 },
  { level: 5, speed: 16, cost: 2250, speedIncrease: 8 },
  { level: 6, speed: 32, cost: 4500, speedIncrease: 16 },
  { level: 7, speed: 64, cost: 9000, speedIncrease: 32 },
  { level: 8, speed: 128, cost: 18000, speedIncrease: 64 },
  { level: 9, speed: 256, cost: 36000, speedIncrease: 128 },
  { level: 10, speed: 512, cost: 72000, speedIncrease: 256 }
];

export interface PlayerAction {
  type: string;
  value?: number;
  timestamp: number;
  target?: string;
}

export interface ChestItem {
  id: string;
  name: string;
  rarity: string;
  description?: string;
  value: number;
  icon: string;
}

export interface Chest {
  id: string;
  type: string;
  rarity: string;
  items: ChestItem[];
}

export enum GameEventType {
  CLICK = 'click',
  UPGRADE = 'upgrade',
  COLLECT = 'collect',
  OPEN_CHEST = 'open-chest',
  ACHIEVEMENT = 'achievement',
  PURCHASE = 'purchase',
  LOGIN = 'login',
  LOGOUT = 'logout',
}

export interface GameEvent {
  type: GameEventType;
  timestamp: number;
  data: Record<string, any>;
  userId?: string;
}

export interface GameStateUpdate {
  type: 'inventory' | 'container' | 'upgrades' | 'achievements' | 'items' | 'full';
  changes: Partial<GameState>;
  timestamp: number;
}

/**
 * Создает состояние игры по умолчанию
 */
export function createDefaultGameState(): GameState {
  return {
    user: null,
    inventory: {
      snot: 0,
      snotCoins: 0,
      containerCapacityLevel: 1,
      fillingSpeedLevel: 1,
      containerCapacity: 100,
      fillingSpeed: 1,
      containerSnot: 0,
      collectionEfficiency: 1,
      Cap: 100,
      lastUpdateTimestamp: Date.now()
    },
    container: {
      level: 1,
      capacity: 100,
      currentAmount: 0,
      fillRate: 1
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
    _isSavingInProgress: false,
    _skipSave: false,
    _lastSaveError: undefined,
    _isBeforeUnloadSave: false,
    _lastModified: Date.now(),
    _wasRepaired: false,
    _repairedAt: undefined,
    _repairedFields: [],
    _tempData: undefined,
    logs: [],
    analytics: undefined,
    items: [],
    achievements: { unlockedAchievements: [] },
    highestLevel: 1,
    stats: { clickCount: 0, playTime: 0, startDate: new Date().toISOString() },
    consecutiveLoginDays: 0,
    settings: { 
      musicEnabled: true, 
      soundEnabled: true, 
      notificationsEnabled: true, 
      theme: "default", 
      language: "en",
      notifications: true,
      tutorialCompleted: false
    },
    soundSettings: { 
      musicVolume: 0.5, 
      soundVolume: 0.5, 
      notificationVolume: 0.5,
      backgroundMusicVolume: 0.5,
      isBackgroundMusicMuted: false,
      clickVolume: 0.5,
      effectsVolume: 0.5,
      isMuted: false,
      isEffectsMuted: false
    },
    hideInterface: false,
    activeTab: "laboratory",
    fillingSpeed: 1,
    containerLevel: 1
  };
}

/**
 * Создает расширенное состояние игры с метаданными сохранения
 */
export function createDefaultExtendedGameState(userId: string): ExtendedGameState {
  return {
    ...createDefaultGameState(),
    _userId: userId,
  };
}

export function createInitialGameState(userId?: string): GameState {
  return {
    user: null,
    inventory: {
      snot: 0,
      snotCoins: 0,
      containerCapacityLevel: 1,
      fillingSpeedLevel: 1,
      containerCapacity: 100,
      fillingSpeed: 1,
      containerSnot: 0,
      collectionEfficiency: 1,
      Cap: 100,
      lastUpdateTimestamp: Date.now()
    },
    container: {
      level: 1,
      capacity: 100,
      currentAmount: 0,
      fillRate: 1
    },
    upgrades: {
      containerLevel: 1,
      fillingSpeedLevel: 1,
      clickPower: { level: 1, value: 1 },
      passiveIncome: { level: 1, value: 0.1 },
      collectionEfficiencyLevel: 1
    },
    _saveVersion: 1,
    _userId: userId,
    _isSavingInProgress: false,
    _skipSave: false,
    _lastSaveError: undefined,
    _isBeforeUnloadSave: false,
    _lastModified: Date.now(),
    _wasRepaired: false,
    _repairedAt: undefined,
    _repairedFields: [],
    _tempData: undefined,
    logs: [],
    analytics: undefined,
    items: [],
    achievements: { unlockedAchievements: [] },
    highestLevel: 1,
    stats: { clickCount: 0, playTime: 0, startDate: new Date().toISOString() },
    consecutiveLoginDays: 0,
    settings: { 
      musicEnabled: true, 
      soundEnabled: true, 
      notificationsEnabled: true, 
      theme: "default", 
      language: "en",
      notifications: true,
      tutorialCompleted: false
    },
    soundSettings: { 
      musicVolume: 0.5, 
      soundVolume: 0.5, 
      notificationVolume: 0.5,
      backgroundMusicVolume: 0.5,
      isBackgroundMusicMuted: false,
      clickVolume: 0.5,
      effectsVolume: 0.5,
      isMuted: false,
      isEffectsMuted: false
    },
    hideInterface: false,
    activeTab: "laboratory",
    fillingSpeed: 1,
    containerLevel: 1,
    isPlaying: false,
    validationStatus: "pending"
  };
} 