// Game constants
export const MAX_LEVEL = 100
export const BASE_FILLING_SPEED = 1 / (24 * 60 * 60) // 1 SNOT per 24 hours
export const MAX_FILLING_SPEED = 1000 / (24 * 60 * 60) // 1000 SNOT per 24 hours

export const CONTAINER_UPGRADES = [
  { level: 1, cost: 0, capacityIncrease: 1 },
  { level: 2, cost: 10, capacityIncrease: 1 },
  ...Array.from({ length: MAX_LEVEL - 2 }, (_, index) => {
    const level = index + 3
    return {
      level,
      cost: Math.floor(10 * Math.pow(1.1, level - 1)),
      capacityIncrease: 1,
    }
  }),
]

export const FILLING_SPEED_UPGRADES = Array.from({ length: MAX_LEVEL }, (_, index) => {
  const level = index + 1
  return {
    level,
    cost: Math.floor(50 * Math.pow(1.1, level - 1)),
    speedIncrease: BASE_FILLING_SPEED * index, // This will increase the speed by 1 SNOT per 24 hours for each level
  }
})

// GameState interface
export interface GameState {
  // Container properties
  containerLevel: number
  containerSnot: number
  fillingSpeedLevel: number
  fillingSpeed: number

  // Game state
  activeTab: "fusion" | "laboratory" | "storage" | "games" | "profile" | "settings"
  gameStarted: boolean
  fusionGameActive: boolean
  fusionGameStarted: boolean
  fusionAttemptsUsed: number
  fusionGamesPlayed: number
  fusionGamesAvailable: number
  lastFusionGameTime: number

  // Player resources
  inventory: {
    snot: number
    snotCoins: number
    collectionEfficiency: number
    Cap: number
    containerCapacityLevel: number
    fillingSpeedLevel: number
  }

  // Energy system
  energy: number
  maxEnergy: number
  energyRecoveryTime: number

  // Wallet
  wallet: {
    address?: string
    balance?: string
    snotCoins?: number
    seedPhrase?: string
  } | null

  // Audio settings
  clickSoundVolume: number
  effectsSoundVolume: number
  isEffectsMuted: boolean
  backgroundMusicVolume: number
  isMuted: boolean
  isBackgroundMusicMuted: boolean

  // Game progress
  highestLevel: number
  snotCollected: number

  // User and authentication
  user: TelegramUser | null
  lastLoginDate: string
  validationStatus: "valid" | "invalid" | "pending"

  // Additional fields
  achievements: Achievement[]
  fusionHistory: FusionEvent[]
  chestOpeningStats: ChestOpeningStats
  totalPlayTime: number
  settings: {
    language: string
    soundSettings: {
      musicVolume: number
      effectsVolume: number
      isMuted: boolean
    }
  }
  miniGamesProgress: {
    [key: string]: any
  }
  Cap: number
  containerCapacity: number
  containerCapacityLevel: number
  ethBalance: string
  error: string | null
  lastValidation: number | undefined
  lastLoginTime: number
}

// Action types
export type Action =
  | { type: "SET_RESOURCE"; resource: keyof GameState; payload: any }
  | { type: "UPDATE_RESOURCES" }
  | { type: "UPDATE_ENERGY" }
  | { type: "SET_ACTIVE_TAB"; payload: Exclude<GameState["activeTab"], "settings"> }
  | { type: "CONSUME_ENERGY"; payload: number }
  | { type: "CLEAR_GAME_DATA" }
  | { type: "SET_GAME_STARTED"; payload: boolean }
  | { type: "ADD_SNOT"; payload: number }
  | { type: "SYNC_WITH_TELEGRAM" }
  | { type: "LOAD_FROM_TELEGRAM" }
  | { type: "SET_FUSION_GAME_ACTIVE"; payload: boolean }
  | { type: "UPGRADE_FILLING_SPEED" }
  | { type: "ADD_TO_INVENTORY"; item: keyof GameState["inventory"]; amount: number }
  | { type: "REMOVE_FROM_INVENTORY"; item: keyof GameState["inventory"]; amount: number }
  | { type: "SET_NON_BACKGROUND_AUDIO_MUTE"; payload: boolean }
  | { type: "SET_EFFECTS_MUTE"; payload: boolean }
  | { type: "UPGRADE_CONTAINER_CAPACITY" }
  | { type: "UPDATE_FUSION_GAME_AVAILABILITY" }
  | { type: "USE_FUSION_GAME" }
  | { type: "SET_FUSION_GAME_STARTED"; payload: boolean }
  | { type: "USE_FUSION_ATTEMPT" }
  | { type: "RESET_FUSION_GAME" }
  | { type: "START_FUSION_GAME" }
  | { type: "SET_WALLET"; payload: GameState["wallet"] }
  | { type: "SET_ETH_BALANCE"; payload: string }
  | { type: "MOVE_SC_TO_GAME"; payload: number }
  | { type: "LOAD_GAME_STATE"; payload: Partial<GameState> }
  | { type: "INCREMENT_FUSION_GAMES_PLAYED" }
  | { type: "COLLECT_CONTAINER_SNOT"; payload: number | { amount: number } }
  | { type: "OPEN_CHEST"; payload: { requiredSnot: number; rewardAmount: number } }
  | { type: "SET_CLICK_SOUND_VOLUME"; payload: number }
  | { type: "SET_EFFECTS_SOUND_VOLUME"; payload: number }
  | { type: "SET_AUDIO_VOLUME"; audioType: "click" | "effects"; payload: number }
  | { type: "SET_BACKGROUND_MUSIC_VOLUME"; payload: number }
  | { type: "SET_MUTE"; payload: boolean }
  | { type: "UPGRADE_COLLECTION_EFFICIENCY"; payload: number }
  | { type: "SET_BACKGROUND_MUSIC_MUTE"; payload: boolean }
  | { type: "SET_USER"; payload: TelegramUser }
  | { type: "UPDATE_VALIDATION_STATUS"; payload: "valid" | "invalid" | "pending" }
  | { type: "SET_TELEGRAM_USER"; payload: any }
  | { type: "RESET_GAME_STATE" }
  | { type: "LOAD_USER_DATA"; payload: string }
  | { type: "SET_ENERGY"; payload: number }
  | { type: "SET_LAST_LOGIN_TIME"; payload: string }
  | { type: "SET_ERROR"; payload: string }
  | { type: "REPLENISH_ENERGY"; payload: number }
  | { type: "SAVE_GAME_STATE_ERROR"; payload: string }

// Resource type
export type Resource = keyof Pick<GameState, "containerSnot">

export const initialState: GameState = {
  containerLevel: 1,
  containerSnot: 0,
  fillingSpeedLevel: 1,
  fillingSpeed: 1 / (24 * 60 * 60),
  activeTab: "fusion",
  gameStarted: false,
  energyRecoveryTime: 0,
  fusionGameActive: false,
  fusionGameStarted: false,
  fusionAttemptsUsed: 0,
  inventory: {
    snot: 0,
    snotCoins: 0,
    collectionEfficiency: 1.0,
    Cap: 1,
    containerCapacityLevel: 1,
    fillingSpeedLevel: 1,
  },
  energy: 100,
  maxEnergy: 100,
  snotCollected: 0,
  fusionGamesPlayed: 0,
  fusionGamesAvailable: 1,
  lastFusionGameTime: 0,
  wallet: null,
  clickSoundVolume: 0.5,
  effectsSoundVolume: 0.5,
  isEffectsMuted: false,
  backgroundMusicVolume: 0.5,
  isMuted: false,
  isBackgroundMusicMuted: false,
  highestLevel: 1,
  Cap: 1,
  containerCapacity: 1,
  containerCapacityLevel: 1,
  ethBalance: "0",
  error: null,
  lastValidation: undefined,
  lastLoginTime: 0,
  user: null,
  lastLoginDate: "",
  validationStatus: "pending",
  achievements: [],
  fusionHistory: [],
  chestOpeningStats: {
    common: 0,
    rare: 0,
    legendary: 0,
    totalRewards: 0,
  },
  totalPlayTime: 0,
  settings: {
    language: "en",
    soundSettings: {
      musicVolume: 0.5,
      effectsVolume: 0.5,
      isMuted: false,
    },
  },
  miniGamesProgress: {},
}

interface TelegramWebAppBase {
  initData: string
  initDataUnsafe: any
}

export interface ExtendedTelegramWebApp extends TelegramWebAppBase {
  ready: () => void
  expand: () => void
  onEvent: (eventType: string, eventHandler: () => void) => void
  offEvent: (eventType: string, eventHandler: () => void) => void
  isExpanded: boolean
  platform: string
  viewportHeight: number
  CloudStorage: {
    getItem: (key: string) => string | null
    setItem: (key: string, value: string) => void
  }
  onTelegramAuth?: (user: any) => void
}

export interface TelegramUser {
  id: string
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

export type TelegramWebApp = TelegramWebAppBase | ExtendedTelegramWebApp

export function isExtendedTelegramWebApp(webApp: TelegramWebApp): webApp is ExtendedTelegramWebApp {
  return "ready" in webApp && typeof webApp.ready === "function"
}

export interface Achievement {
  id: string
  name: string
  description: string
  completed: boolean
  completedDate?: string
}

export interface FusionEvent {
  date: string
  level: number
  result: "success" | "failure"
  reward?: number
}

export interface ChestOpeningStats {
  common: number
  rare: number
  legendary: number
  totalRewards: number
}

export interface GameStateRecord {
  user_id: string
  game_state: GameState
}

