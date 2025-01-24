import {
  type GameState,
  type Action,
  MAX_LEVEL,
  BASE_FILLING_SPEED,
  CONTAINER_UPGRADES,
  FILLING_SPEED_UPGRADES,
} from "../types/gameTypes"
import { saveToLocalStorage, saveUserToLocalStorage } from "../utils/localStorage"

const calculateFillingSpeed = (level: number): number => {
  return BASE_FILLING_SPEED * level
}

export const initialState: GameState = {
  containerLevel: 1,
  containerSnot: 0,
  fillingSpeedLevel: 1,
  fillingSpeed: 1 / (24 * 60 * 60),
  activeTab: "laboratory",
  gameStarted: false,
  fusionGameActive: false,
  fusionGameStarted: false,
  fusionAttemptsUsed: 0,
  fusionGamesPlayed: 0,
  fusionGamesAvailable: 2,
  lastFusionGameTime: 0,
  inventory: {
    snot: 0,
    snotCoins: 0,
    collectionEfficiency: 1.0,
    containerCapacity: 1,
    containerCapacityLevel: 1,
    fillingSpeedLevel: 1,
  },
  energy: 500,
  maxEnergy: 500,
  energyRecoveryTime: 0,
  wallet: null,
  clickSoundVolume: 0.5,
  effectsSoundVolume: 0.5,
  isEffectsMuted: false,
  highestLevel: 1,
  snotCollected: 0,
  backgroundMusicVolume: 0.5,
  isMuted: false,
  isBackgroundMusicMuted: false,
  containerCapacity: 1,
  containerCapacityLevel: 1,
  ethBalance: "0",
  user: null,
  lastValidation: undefined,
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
  lastLoginDate: new Date().toISOString(),
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

export function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "SET_RESOURCE":
      if (action.resource === "containerSnot") {
        return {
          ...state,
          containerSnot: Math.min(action.payload, state.inventory.containerCapacity),
        }
      }
      return { ...state, [action.resource]: action.payload }

    case "UPDATE_RESOURCES":
      return {
        ...state,
        containerSnot: Math.min(state.containerSnot + state.fillingSpeed, state.inventory.containerCapacity),
      }

    case "UPDATE_ENERGY":
      const energyRecoveryRate = state.maxEnergy / (12 * 60 * 60)
      const newEnergy = Math.min(state.energy + energyRecoveryRate, state.maxEnergy)
      return {
        ...state,
        energy: newEnergy,
        energyRecoveryTime: Math.ceil((state.maxEnergy - newEnergy) / energyRecoveryRate),
      }

    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.payload }

    case "CONSUME_ENERGY":
      return { ...state, energy: Math.max(0, state.energy - action.payload) }

    case "ADD_SNOT":
      return {
        ...state,
        inventory: { ...state.inventory, snot: state.inventory.snot + action.payload },
        snotCollected: state.snotCollected + action.payload,
      }

    case "UPGRADE_FILLING_SPEED":
      if (state.fillingSpeedLevel < MAX_LEVEL) {
        const upgrade = FILLING_SPEED_UPGRADES[state.fillingSpeedLevel - 1]
        if (state.inventory.snotCoins >= upgrade.cost) {
          return {
            ...state,
            fillingSpeedLevel: state.fillingSpeedLevel + 1,
            fillingSpeed: calculateFillingSpeed(state.fillingSpeedLevel + 1),
            inventory: {
              ...state.inventory,
              snotCoins: state.inventory.snotCoins - upgrade.cost,
            },
          }
        }
      }
      return state

    case "UPGRADE_CONTAINER_CAPACITY":
      if (state.containerLevel < MAX_LEVEL) {
        const upgrade = CONTAINER_UPGRADES[state.containerLevel]
        if (state.inventory.snotCoins >= upgrade.cost) {
          return {
            ...state,
            containerLevel: state.containerLevel + 1,
            inventory: {
              ...state.inventory,
              containerCapacity: state.inventory.containerCapacity + upgrade.capacityIncrease,
              snotCoins: state.inventory.snotCoins - upgrade.cost,
            },
          }
        }
      }
      return state

    case "SET_FUSION_GAME_ACTIVE":
      return { ...state, fusionGameActive: action.payload }

    case "SET_FUSION_GAME_STARTED":
      return { ...state, fusionGameStarted: action.payload }

    case "USE_FUSION_ATTEMPT":
      if (state.fusionAttemptsUsed < 2) {
        return {
          ...state,
          fusionAttemptsUsed: state.fusionAttemptsUsed + 1,
          lastFusionGameTime: state.fusionAttemptsUsed === 0 ? Date.now() : state.lastFusionGameTime,
        }
      }
      return state

    case "RESET_FUSION_GAME":
      return {
        ...state,
        fusionGameActive: false,
        fusionGameStarted: false,
      }

    case "START_FUSION_GAME":
      return {
        ...state,
        fusionGameActive: true,
        fusionGameStarted: true,
      }

    case "SET_WALLET":
      return { ...state, wallet: action.payload }

    case "SET_AUDIO_VOLUME":
      return {
        ...state,
        [action.audioType === "click" ? "clickSoundVolume" : "effectsSoundVolume"]: action.payload,
      }

    case "SET_EFFECTS_MUTE":
      return { ...state, isEffectsMuted: action.payload }

    case "INCREMENT_FUSION_GAMES_PLAYED":
      return { ...state, fusionGamesPlayed: state.fusionGamesPlayed + 1 }

    case "COLLECT_CONTAINER_SNOT":
      const amount = typeof action.payload === "number" ? action.payload : action.payload.amount
      return {
        ...state,
        containerSnot: 0,
        inventory: {
          ...state.inventory,
          snot: state.inventory.snot + amount,
        },
        snotCollected: state.snotCollected + amount,
      }

    case "OPEN_CHEST":
      return {
        ...state,
        inventory: {
          ...state.inventory,
          snot: state.inventory.snot - action.payload.requiredSnot,
          snotCoins: state.inventory.snotCoins + action.payload.rewardAmount,
        },
      }

    case "SET_USER":
      return { ...state, user: action.payload }

    case "UPDATE_VALIDATION_STATUS":
      return {
        ...state,
        validationStatus: action.payload,
        lastValidation: Date.now(),
      }

    case "RESET_GAME_STATE":
      return { ...initialState }

    case "LOAD_USER_DATA":
      try {
        if (!action.payload) {
          console.error("LOAD_USER_DATA: Payload is empty")
          return state
        }

        let userData
        if (typeof action.payload === "string") {
          // If payload is a string (likely a token), try to decode it
          const decodedData = atob(action.payload)
          if (!decodedData) {
            console.error("LOAD_USER_DATA: Decoded data is empty")
            return state
          }
          userData = JSON.parse(decodedData)
        } else if (typeof action.payload === "object") {
          // If payload is already an object, use it directly
          userData = action.payload
        } else {
          console.error("LOAD_USER_DATA: Invalid payload type")
          return state
        }

        if (!userData || typeof userData !== "object") {
          console.error("LOAD_USER_DATA: Invalid user data format")
          return state
        }

        console.log("Loaded user data:", userData)
        return {
          ...state,
          user: userData,
        }
      } catch (error) {
        console.error("Error parsing user data:", error)
        return state
      }

    case "SET_ENERGY":
      return { ...state, energy: Math.min(action.payload, state.maxEnergy) }

    case "REPLENISH_ENERGY":
      return { ...state, energy: Math.min(state.energy + action.payload, state.maxEnergy) }

    default:
      return state
  }
}

