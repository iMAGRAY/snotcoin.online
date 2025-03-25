/**
 * Типы данных для игры
 */
// Типы для игровой механики
export interface Inventory {
  snot: number
  snotCoins: number
  collectionEfficiency: number
  containerCapacityLevel: number
  fillingSpeedLevel: number
  fillingSpeed: number
  containerCapacity: number
  containerSnot: number
  Cap: number
  lastUpdateTimestamp?: number // Временная метка последнего обновления ресурсов
}

export interface Upgrades {
  containerLevel: number
  fillingSpeedLevel: number
  collectionEfficiencyLevel: number
}

export interface Container {
  level: number
  capacity: number
  currentAmount: number
  fillRate: number
}

export interface Settings {
  language: string
  theme: string
  notifications: boolean
  tutorialCompleted: boolean
}

export interface SoundSettings {
  clickVolume: number
  effectsVolume: number
  backgroundMusicVolume: number
  isMuted: boolean
  isEffectsMuted: boolean
  isBackgroundMusicMuted: boolean
}

export interface User {
  id: string
  fid?: number
  username?: string
  displayName?: string
  pfp?: string
  telegram_id?: number
  first_name?: string
  last_name?: string
  photo_url?: string
}

export interface GameState {
  activeTab: string
  user: User | null
  validationStatus: "pending" | "valid" | "invalid"
  lastValidation?: number
  inventory: Inventory
  container: Container
  upgrades: Upgrades
  settings: Settings
  soundSettings: SoundSettings
  hideInterface: boolean
  isPlaying: boolean
  isLoading: boolean
  containerLevel: number
  fillingSpeed: number
  containerSnot: number
  gameStarted: boolean
  highestLevel: number
  consecutiveLoginDays: number
  wallet?: {
    snotCoins: number
  }
}

export interface ExtendedGameState extends GameState {
  // Дополнительные поля для расширенного состояния игры
  _saveVersion?: number
  _lastSaved?: string
  _isRetry?: boolean
  _isInitialState?: boolean
  _isError?: boolean
  _lastActionTime?: string
  _lastAction?: string
  _skippedLoad?: boolean  // Флаг, указывающий, что загрузка была пропущена из-за более новой локальной версии
  _isForceSave?: boolean  // Флаг, указывающий на принудительное сохранение
  _isBeforeUnloadSave?: boolean // Флаг для сохранения перед закрытием страницы
  _isMerged?: boolean // Флаг, указывающий что состояние было получено путем слияния
  _clientSentAt?: string // Метка времени отправки с клиента 
  _tempData?: any // Временные данные, которые не должны сохраняться
}

export type ActionType =
  | 'SET_USER'
  | 'SET_TELEGRAM_USER'
  | 'SET_ACTIVE_TAB'
  | 'SET_CONTAINER_LEVEL'
  | 'SET_FILLING_SPEED_LEVEL'
  | 'SET_COLLECTION_EFFICIENCY_LEVEL'
  | 'UPDATE_CONTAINER'
  | 'UPDATE_CONTAINER_LEVEL'
  | 'UPDATE_CONTAINER_SNOT'
  | 'UPDATE_FILLING_SPEED'
  | 'UPDATE_RESOURCES'
  | 'INITIALIZE_NEW_USER'
  | 'RESET_GAME_STATE'
  | 'LOAD_USER_DATA'
  | 'SET_IS_PLAYING'
  | 'LOGIN'
  | 'LOAD_GAME_STATE'
  | 'SET_GAME_STARTED'
  | 'ADD_TO_INVENTORY'
  | 'REMOVE_FROM_INVENTORY'
  | 'FORCE_SAVE_GAME_STATE'
  | 'SET_RESOURCE'
  | 'UPGRADE_CONTAINER_CAPACITY'
  | 'UPGRADE_FILLING_SPEED'
  | 'ADD_SNOT'
  | 'COLLECT_CONTAINER_SNOT'
  | 'INCREMENT_CONTAINER_CAPACITY'
  | 'SET_CLICK_SOUND_VOLUME'
  | 'SET_BACKGROUND_MUSIC_VOLUME'
  | 'SET_EFFECTS_SOUND_VOLUME'
  | 'SET_MUTE'
  | 'SET_EFFECTS_MUTE'
  | 'SET_BACKGROUND_MUSIC_MUTE'
  | 'CLEAR_GAME_DATA'
  | 'MOVE_SC_TO_GAME'
  | 'SET_HIDE_INTERFACE';

export interface Action {
  type: ActionType
  payload?: any
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

// Типы для Telegram
export interface TelegramUser {
  id: string
  first_name: string
  last_name?: string
  username?: string
  telegram_id?: number
  photo_url?: string
} 