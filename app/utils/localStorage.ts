import type { GameState } from "../types/gameTypes"

const STORAGE_KEY = "snotcoin_game_state"
const USER_KEY = "snotcoin_user_data"

export const saveToLocalStorage = (state: GameState): void => {
  if (state.user) {
    try {
      const serializedState = JSON.stringify({
        userId: state.user.id,
        inventory: state.inventory,
        containerSnot: state.containerSnot,
        containerLevel: state.containerLevel,
        fillingSpeedLevel: state.fillingSpeedLevel,
        fusionGamesAvailable: state.fusionGamesAvailable,
        lastFusionGameTime: state.lastFusionGameTime,
        energy: state.energy,
        maxEnergy: state.maxEnergy,
        lastLoginTime: state.lastLoginTime || Date.now(),
        achievements: state.achievements,
        fusionHistory: state.fusionHistory,
        chestOpeningStats: state.chestOpeningStats,
        totalPlayTime: state.totalPlayTime,
        lastLoginDate: new Date().toISOString(),
        settings: {
          language: state.settings.language,
          soundSettings: state.settings.soundSettings,
        },
        miniGamesProgress: state.miniGamesProgress,
      })
      localStorage.setItem(STORAGE_KEY, serializedState)
    } catch (err) {
      console.error("Error saving state to localStorage:", err)
    }
  }
}

export const loadFromLocalStorage = (): Partial<GameState> | undefined => {
  try {
    const serializedState = localStorage.getItem(STORAGE_KEY)
    if (serializedState === null) {
      return undefined
    }
    const parsedState = JSON.parse(serializedState)

    // Calculate energy replenishment
    const now = Date.now()
    const timeDifference = now - parsedState.lastLoginTime
    const energyRecovered = Math.floor(timeDifference / (60 * 1000)) // 1 energy per minute
    parsedState.energy = Math.min(parsedState.energy + energyRecovered, parsedState.maxEnergy)
    parsedState.lastLoginTime = now

    return parsedState
  } catch (err) {
    console.error("Error loading state from localStorage:", err)
    return undefined
  }
}

export const clearLocalStorage = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(USER_KEY)
  } catch (err) {
    console.error("Error clearing localStorage:", err)
  }
}

export const saveUserToLocalStorage = (userData: any): void => {
  try {
    const serializedUserData = JSON.stringify(userData)
    localStorage.setItem(USER_KEY, serializedUserData)
  } catch (err) {
    console.error("Error saving user data to localStorage:", err)
  }
}

export const loadUserFromLocalStorage = (): any | null => {
  try {
    const serializedUserData = localStorage.getItem(USER_KEY)
    if (serializedUserData === null) {
      return null
    }
    return JSON.parse(serializedUserData)
  } catch (err) {
    console.error("Error loading user data from localStorage:", err)
    return null
  }
}

export const clearUserFromLocalStorage = (): void => {
  try {
    localStorage.removeItem(USER_KEY)
  } catch (err) {
    console.error("Error clearing user data from localStorage:", err)
  }
}

