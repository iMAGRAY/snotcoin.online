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
  id: string
  farcaster_fid?: number
  fid?: number  // Алиас для farcaster_fid
  farcaster_username?: string
  username?: string  // Алиас для farcaster_username
  farcaster_displayname?: string
  displayName?: string  // Алиас для farcaster_displayname
  farcaster_pfp?: string
  pfp?: string  // Алиас для farcaster_pfp
  email?: string
  created_at?: string
  updated_at?: string
}

// Настройки
export interface Settings {
  language: string
  theme: string
  notifications: boolean
  tutorialCompleted: boolean
}

// Настройки звука
export interface SoundSettings {
  clickVolume: number
  effectsVolume: number
  backgroundMusicVolume: number
  isMuted: boolean
  isEffectsMuted: boolean
  isBackgroundMusicMuted: boolean
}

/**
 * Состояние инвентаря
 */
export interface Inventory {
  // Валюта и ресурсы
  snot: number;
  snotCoins: number;
  
  // Атрибуты контейнера
  containerCapacity: number;
  containerCapacityLevel: number;
  fillingSpeed: number;
  fillingSpeedLevel: number;
  
  // Дополнительные атрибуты для основной игры
  collectionEfficiency: number;
  containerSnot: number;
  Cap: number;
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
  containerLevel: number;
  fillingSpeedLevel: number;
  collectionEfficiencyLevel: number;
  clickPower?: { level: number, value: number };
  passiveIncome?: { level: number, value: number };
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
  // Основные игровые элементы
  inventory: Inventory;
  container: Container;
  upgrades: Upgrades;
  
  // Дополнительные элементы
  items?: Item[];
  achievements?: Achievements;
  stats?: Record<string, number>;
  
  // Настройки
  settings: Settings;
  soundSettings: SoundSettings;
  
  // Состояние UI
  activeTab: string;
  hideInterface: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  
  // Прогресс
  containerLevel: number;
  fillingSpeed: number;
  containerSnot: number;
  gameStarted: boolean;
  highestLevel: number;
  consecutiveLoginDays: number;
  
  // Пользователь
  user: User | null;
  validationStatus: "pending" | "valid" | "invalid";
  lastValidation?: number;
  
  // Кошелек
  wallet?: {
    snotCoins: number
  };
}

/**
 * Расширенное состояние игры с метаданными сохранения
 */
export interface ExtendedGameState extends GameState {
  // Версия сохранения
  _saveVersion?: number;
  
  // Время последнего изменения
  _lastModified?: number;
  _lastSaved?: string;
  
  // ID пользователя
  _userId?: string;
  
  // Флаги состояния
  _isRetry?: boolean;
  _isInitialState?: boolean;
  _isError?: boolean;
  _lastActionTime?: string;
  _lastAction?: string;
  _skippedLoad?: boolean;
  _isForceSave?: boolean;
  _isBeforeUnloadSave?: boolean;
  _isMerged?: boolean;
  _clientSentAt?: string;
  _isRestoredFromBackup?: boolean;
  _skipSave?: boolean;
  _isSavingInProgress?: boolean;
  _unmountSave?: boolean;
  _lastSaveError?: string;
  
  // Информация о восстановлении данных
  _wasRepaired?: boolean;
  _repairedAt?: number;
  _repairedFields?: string[];
  
  // Дополнительные данные для save system
  _tempData?: any;
  logs?: Array<any>;
  analytics?: Record<string, any>;
  
  // Дата декомпрессии (для сжатых данных)
  _decompressedAt?: string;
  
  // Предупреждение о целостности данных
  _integrityWarning?: boolean;
  
  // Данные для дельта-компрессии
  _saveId?: string;
  _appliedDelta?: boolean;
  _deltaAppliedAt?: number;
  _deltaClientId?: string;
}

export type Action =
  | { type: "LOGIN" }
  | { type: "SET_ACTIVE_TAB"; payload: string }
  | { type: "SET_USER"; payload: any }
  | { type: "UPDATE_CONTAINER_LEVEL"; payload: number }
  | { type: "UPDATE_CONTAINER_SNOT"; payload: number }
  | { type: "UPDATE_FILLING_SPEED"; payload: number }
  | { type: "UPDATE_RESOURCES" }
  | { type: "SET_RESOURCE"; payload: { resource: string; value: number } }
  | { type: "ADD_SNOT"; payload: number }
  | { type: "COLLECT_CONTAINER_SNOT"; payload: { amount: number } }
  | { type: "UPGRADE_FILLING_SPEED" }
  | { type: "UPGRADE_CONTAINER_CAPACITY" }
  | { type: "INCREMENT_CONTAINER_CAPACITY" }
  | { type: "INITIALIZE_NEW_USER"; payload?: ExtendedGameState }
  | { type: "SET_HIDE_INTERFACE"; payload: boolean }
  | { type: "SET_INVENTORY"; payload: Inventory }
  | { type: "SET_CONTAINER"; payload: Container }
  | { type: "SET_UPGRADES"; payload: Upgrades }
  | { type: "FORCE_SAVE_GAME_STATE" }
  | { type: "RESET_GAME_STATE" }
  | { type: "ADD_ACHIEVEMENT"; payload: string }
  | { type: "CONVERT_SNOT_TO_COINS"; payload: number }
  | { type: "SET_ITEM"; payload: Item }
  | { type: "ADD_ITEM"; payload: Item }
  | { type: "REMOVE_ITEM"; payload: string }
  | { type: "SET_SETTINGS"; payload: Settings }
  | { type: "SET_SOUND_SETTINGS"; payload: SoundSettings }
  | { type: "TOGGLE_MUSIC_MUTE" }
  | { type: "TOGGLE_EFFECTS_MUTE" }
  | { type: "SET_MUSIC_VOLUME"; payload: number }
  | { type: "SET_EFFECTS_VOLUME"; payload: number }
  | { type: "LOAD_GAME_STATE"; payload: ExtendedGameState }
  | { type: "LOAD_USER_DATA"; payload: Partial<ExtendedGameState> }
  | { type: "SET_IS_PLAYING"; payload: boolean }
  | { type: "SET_GAME_STARTED"; payload: boolean }
  | { type: "SET_CLICK_SOUND_VOLUME"; payload: number }
  | { type: "SET_BACKGROUND_MUSIC_VOLUME"; payload: number }
  | { type: "SET_EFFECTS_SOUND_VOLUME"; payload: number }
  | { type: "SET_MUTE"; payload: boolean }
  | { type: "SET_EFFECTS_MUTE"; payload: boolean }
  | { type: "SET_BACKGROUND_MUSIC_MUTE"; payload: boolean }
  | { type: "ADD_TO_INVENTORY"; payload: Item }
  | { type: "REMOVE_FROM_INVENTORY"; payload: string };

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
    activeTab: 'main',
    user: null,
    validationStatus: "pending",
    inventory: {
      snot: 0,
      snotCoins: 0,
      collectionEfficiency: 1,
      containerCapacityLevel: 1,
      fillingSpeedLevel: 1,
      fillingSpeed: 1,
      containerCapacity: 100,
      containerSnot: 0,
      Cap: 0
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
      collectionEfficiencyLevel: 1,
      clickPower: { level: 1, value: 1 },
      passiveIncome: { level: 1, value: 0.1 }
    },
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
    hideInterface: false,
    isPlaying: false,
    isLoading: false,
    containerLevel: 1,
    fillingSpeed: 1,
    containerSnot: 0,
    gameStarted: false,
    highestLevel: 1,
    consecutiveLoginDays: 0
  };
}

/**
 * Создает расширенное состояние игры с метаданными сохранения
 */
export function createDefaultExtendedGameState(userId: string): ExtendedGameState {
  return {
    ...createDefaultGameState(),
    _saveVersion: 1,
    _lastModified: Date.now(),
    _userId: userId,
  };
} 