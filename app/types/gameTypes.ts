// Game constants
export const CONTAINER_UPGRADES = Array.from({ length: 100 }, (_, index) => {
  const level = index + 1
  return {
    level,
    cost: Math.floor(10 * Math.pow(1.1, level - 1)),
    capacityIncrease: 1,
  }
})

export const FILLING_SPEED_UPGRADES = Array.from({ length: 100 }, (_, index) => {
  const level = index + 1
  const baseSpeed = 1 / (24 * 60 * 60) // 1 SNOT per 24 hours
  const maxSpeed = 1000 / (24 * 60 * 60) // 1000 SNOT per 24 hours
  return {
    level,
    cost: Math.floor(50 * Math.pow(1.1, level - 1)),
    speedIncrease: ((maxSpeed - baseSpeed) / 99) * index,
  }
})

// GameState interface
export interface GameState {
  telegram_id: number
  containerLevel: number
  Cap: number
  fillingSpeedLevel: number
  containerSnot: number
  fillingSpeed: number
  activeTab: "fusion" | "laboratory" | "storage" | "games" | "profile" | "settings"
  gameStarted: boolean
  energyRecoveryTime: number
  fusionGameActive: boolean
  fusionGameStarted: boolean
  fusionAttemptsUsed: number
  inventory: {
    snot: number
    snotCoins: number
    fillingSpeedLevel: number
    containerCapacityLevel: number
    Cap: number
    collectionEfficiency: number
  }
  energy: number
  maxEnergy: number
  snotCollected: number
  fusionGamesPlayed: number
  fusionGamesAvailable: number
  lastFusionGameTime: number
  user: User | null
  wallet: {
    address?: string
    balance?: string
    snotCoins?: number
    seedPhrase?: string
  } | null
  collectionEfficiency: number
  backgroundMusicVolume: number
  isMuted: boolean
  ethBalance: string
  clickSoundVolume: number
  isBackgroundMusicMuted: boolean
  isEffectsMuted: boolean
  highestLevel: number
  effectsSoundVolume: number
  containerCapacity: number
  snotCoins: number
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
  | { type: "SET_BACKGROUND_AUDIO_MUTE"; payload: boolean }
  | { type: "SET_NON_BACKGROUND_AUDIO_MUTE"; payload: boolean }
  | { type: "SET_BACKGROUND_MUSIC_MUTE"; payload: boolean }
  | { type: "SET_EFFECTS_MUTE"; payload: boolean }
  | { type: "UPGRADE_CONTAINER_CAPACITY" }
  | { type: "SET_CONTAINER_CAPACITY"; payload: number }
  | { type: "UPDATE_FUSION_GAME_AVAILABILITY" }
  | { type: "USE_FUSION_GAME" }
  | { type: "SET_FUSION_GAME_STARTED"; payload: boolean }
  | { type: "USE_FUSION_ATTEMPT" }
  | { type: "RESET_FUSION_GAME" }
  | { type: "START_FUSION_GAME" }
  | { type: "SET_WALLET"; payload: any }
  | { type: "SET_ETH_BALANCE"; payload: string }
  | { type: "MOVE_SC_TO_GAME"; payload: number }
  | { type: "LOAD_GAME_STATE"; payload: Partial<GameState> }
  | { type: "SET_USER"; payload: User }
  | { type: "INCREMENT_FUSION_GAMES_PLAYED" }
  | { type: "COLLECT_CONTAINER_SNOT"; payload: { amount: number } }
  | { type: "OPEN_CHEST"; payload: { requiredSnot: number; rewardAmount: number } }
  | { type: "SET_CLICK_SOUND_VOLUME"; payload: number }
  | { type: "SET_BACKGROUND_MUSIC_VOLUME"; payload: number }
  | { type: "SET_MUTE"; payload: boolean }
  | { type: "UPGRADE_COLLECTION_EFFICIENCY"; payload: number }
  | { type: "SET_EFFECTS_SOUND_VOLUME"; payload: number }

// Resource type
export type Resource = keyof Pick<GameState, "containerSnot">

// User interface
export interface User {
  id: number
  telegram_id: number
  username?: string
  first_name?: string
  last_name?: string
  photo_url?: string
  language_code?: string
  auth_date: number
}

export interface TelegramUser {
  id: number
  telegram_id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
  auth_date: number
}

export const initialState: GameState = {
  telegram_id: 0,
  containerLevel: 1,
  Cap: 10,
  fillingSpeedLevel: 1,
  containerSnot: 0,
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
    fillingSpeedLevel: 1,
    containerCapacityLevel: 1,
    Cap: 10,
    collectionEfficiency: 1.0,
  },
  energy: 100,
  maxEnergy: 100,
  snotCollected: 0,
  fusionGamesPlayed: 0,
  fusionGamesAvailable: 1,
  lastFusionGameTime: 0,
  user: null,
  wallet: null,
  collectionEfficiency: 1.0,
  backgroundMusicVolume: 1,
  isMuted: false,
  ethBalance: "",
  clickSoundVolume: 0.5,
  isBackgroundMusicMuted: false,
  isEffectsMuted: false,
  highestLevel: 1,
  effectsSoundVolume: 0.5,
  containerCapacity: 10,
  snotCoins: 0,
}

