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
  username: string | null;
  displayName: string | null;
  farcaster_fid: string | null;
  farcaster_username: string | null;
  farcaster_displayname: string | null;
  farcaster_pfp: string | null;
  pfp: string | null;
  fid: number | null;
  verified: boolean | null;
  metadata?: Record<string, any>;
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
  containerSnot: number;
  containerCapacity: number;
  containerCapacityLevel: number;
  fillingSpeed: number;
  fillingSpeedLevel: number;
  collectionEfficiency: number;
  lastUpdateTimestamp?: number;
}

/**
 * Состояние контейнера
 */
export interface Container {
  level: number;
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
 * Предмет в инвентаре
 */
export interface InventoryItem {
  id: string;
  quantity: number;
  stackable: boolean;
  acquired_at: string;
  metadata: Record<string, any>;
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
 * Статистика игры
 */
export interface GameStateStats {
  clickCount: number;
  playTime: number;
  startDate: string;
  highestLevel: number;
  totalSnot: number;
  totalSnotCoins: number;
  consecutiveLoginDays: number;
}

/**
 * Основное состояние игры
 */
export interface GameState {
  user: User | null;
  inventory: Inventory;
  container: Container;
  upgrades: Upgrades;
  _userId: string;
  _provider?: string;
  _lastModified: number;
  _createdAt: string;
  _tempData: any | null;
  _lastActionTime: string;
  _lastAction: string;
  _dataSource?: string; // Источник данных: 'local', 'server', 'new', 'default'
  _loadedAt?: string;   // Время загрузки данных
  logs: any[];
  analytics: any | null;
  items: Item[];
  achievements: {
    unlockedAchievements: string[];
  };
  highestLevel: number;
  stats: GameStateStats;
  consecutiveLoginDays: number;
  settings: Settings;
  soundSettings: SoundSettings;
  hideInterface: boolean;
  activeTab: string;
  fillingSpeed: number;
  containerLevel: number;
  isPlaying: boolean;
  isGameInstanceRunning: boolean;
  validationStatus: string;
  lastValidation: string;
  gameStarted: boolean;
  isLoading: boolean;
}

export interface ExtendedGameState extends GameState {
  _decompressedAt?: string;
  _compressedAt?: string;
  _compressionVersion?: number;
  _backupId?: string;
  _backupTimestamp?: number;
  _backupType?: string;
  _backupReason?: string;
  _backupMetadata?: Record<string, any>;
  _syncId?: string;
  _syncTimestamp?: number;
  _syncType?: string;
  _syncReason?: string;
  _syncMetadata?: Record<string, any>;
  _validationErrors?: string[];
  _validationWarnings?: string[];
  _validationMetadata?: Record<string, any>;
  _lastMerged?: string;
  _mergeInfo?: {
    timestamp: number;
    strategy: string;
    conflicts: number;
    resolved: number;
    duration: number;
  };
  repairData?: {
    timestamp: number;
    strategy: string;
    conflicts: number;
    resolved: number;
    duration: number;
  };
  _dataSource?: string; // Источник данных: 'local', 'server', 'new'
  _loadedAt?: string;   // Время загрузки данных
  score?: number;
  source?: string;
  containerSnot?: number;
  quests?: Record<string, {
    id: string;
    progress: number;
    completed: boolean;
    completed_at?: string;
    started_at?: string;
    steps?: Record<string, boolean>;
    metadata?: Record<string, any>;
  }>;
  _isEncrypted?: boolean;
  _integrityVerified?: boolean;
  _integrityWarning?: boolean;
}

export type ActionType =
  | "SET_USER"
  | "SET_INVENTORY"
  | "SET_CONTAINER"
  | "SET_UPGRADES"
  | "SET_USER_ID"
  | "SET_LAST_MODIFIED"
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
  | "UPDATE_UPGRADES"
  | "SET_GAME_INSTANCE_RUNNING";

export interface Action {
  type: ActionType;
  payload?: any;
}

// Константы для улучшений
export const CONTAINER_UPGRADES = [
  { level: 1, capacity: 1, cost: 0, capacityIncrease: 0 },
  { level: 2, capacity: 2, cost: 100, capacityIncrease: 1 },
  { level: 3, capacity: 3, cost: 300, capacityIncrease: 1 },
  { level: 4, capacity: 4, cost: 700, capacityIncrease: 1 },
  { level: 5, capacity: 5, cost: 1500, capacityIncrease: 1 },
  { level: 6, capacity: 6, cost: 3000, capacityIncrease: 1 },
  { level: 7, capacity: 7, cost: 6000, capacityIncrease: 1 },
  { level: 8, capacity: 8, cost: 12000, capacityIncrease: 1 },
  { level: 9, capacity: 9, cost: 24000, capacityIncrease: 1 },
  { level: 10, capacity: 10, cost: 48000, capacityIncrease: 1 }
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
 * Создает объект состояния игры по умолчанию
 */
export function createDefaultGameState(): GameState {
  const now = new Date().toISOString();
  // Получаем текущее время в миллисекундах
  const currentTimeMs = Date.now();
  
  // Базовые значения по умолчанию
  const initialSnot = 0;
  const initialSnotCoins = 0;
  const initialContainerSnot = 0.05;
  
  // Создаем случайный идентификатор для нового пользователя
  const generatedUserId = `user_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  
  console.log('[createDefaultGameState] Создаем новое состояние игры');
  
  return {
    user: null,
    inventory: {
      snot: initialSnot,
      snotCoins: initialSnotCoins,
      containerSnot: initialContainerSnot,
      containerCapacity: 1,
      containerCapacityLevel: 1,
      fillingSpeed: 0.01,
      fillingSpeedLevel: 1,
      collectionEfficiency: 1.0,
      lastUpdateTimestamp: currentTimeMs
    },
    container: {
      level: 1,
      currentAmount: initialContainerSnot,
      fillRate: 0.01,
      currentFill: initialContainerSnot
    },
    upgrades: {
      clickPower: {
        level: 1,
        value: 0.1
      },
      passiveIncome: {
        level: 1,
        value: 0.01
      },
      collectionEfficiencyLevel: 1,
      containerLevel: 1,
      fillingSpeedLevel: 1
    },
    _userId: generatedUserId,
    _lastModified: currentTimeMs,
    _createdAt: now,
    _tempData: null,
    _lastActionTime: now,
    _lastAction: 'create_default_state',
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
      totalSnot: initialSnot,
      totalSnotCoins: initialSnotCoins,
      consecutiveLoginDays: 1
    },
    consecutiveLoginDays: 1,
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
      notificationVolume: 0.7,
      clickVolume: 0.4,
      effectsVolume: 0.6,
      backgroundMusicVolume: 0.3,
      isMuted: false,
      isEffectsMuted: false,
      isBackgroundMusicMuted: false
    },
    hideInterface: false,
    activeTab: 'game',
    fillingSpeed: 0.01,
    containerLevel: 1,
    isPlaying: false,
    isGameInstanceRunning: false,
    validationStatus: 'none',
    lastValidation: now,
    gameStarted: false,
    isLoading: false
  };
}

export function createInitialGameState(userId?: string): GameState {
  const state = createDefaultGameState();
  if (userId) {
    state._userId = userId;
  }
  return state;
} 