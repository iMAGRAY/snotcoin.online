import { GameState } from "../types/gameTypes"

export const initialState: GameState = {
  activeTab: "laboratory",
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
    Cap: 100
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
    collectionEfficiencyLevel: 1
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
} 