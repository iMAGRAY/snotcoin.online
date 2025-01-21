import type { GameState, Action } from "../types/gameTypes"

const calculateFillingSpeed = (level: number): number => {
  // 1 SNOT per 24 hours at level 1, increasing by 1 SNOT per level
  return level / (24 * 60 * 60)
}

export const initialState: GameState = {
  telegram_id: 0,
  containerLevel: 1,
  fillingSpeedLevel: 1,
  containerSnot: 0,
  fillingSpeed: calculateFillingSpeed(1),
  activeTab: "laboratory",
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
    Cap: 1,
    collectionEfficiency: 1.0,
  },
  energy: 500,
  maxEnergy: 500,
  Cap: 1,
  containerCapacity: 1,
  fusionGamesAvailable: 2,
  lastFusionGameTime: 0,
  snotCollected: 0,
  fusionGamesPlayed: 0,
  user: null,
  highestLevel: 1,
  wallet: null,
  collectionEfficiency: 1.0,
  backgroundMusicVolume: 50,
  isMuted: false,
  ethBalance: "0",
  clickSoundVolume: 0.5,
  isBackgroundMusicMuted: false,
  isEffectsMuted: false,
  effectsSoundVolume: 0.5,
  snotCoins: 0,
  theme: {
    // Add default theme properties here
  },
}

export function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "SET_RESOURCE":
      return { ...state, [action.resource]: action.payload }
    case "UPDATE_ENERGY":
      const energyRecoveryRate = state.maxEnergy / (12 * 60 * 60)
      return {
        ...state,
        energy: Math.min(state.energy + energyRecoveryRate, state.maxEnergy),
        energyRecoveryTime: Math.ceil((state.maxEnergy - state.energy) / energyRecoveryRate),
      }
    case "SET_ACTIVE_TAB":
      return {
        ...state,
        activeTab: action.payload,
        gameStarted: state.gameStarted,
      }
    case "CONSUME_ENERGY":
      return { ...state, energy: Math.max(0, state.energy - action.payload) }
    case "CLEAR_GAME_DATA":
      return {
        ...initialState,
        inventory: {
          ...initialState.inventory,
          snotCoins: state.inventory.snotCoins || 0,
        },
        activeTab: "laboratory",
        gameStarted: false,
      }
    case "SET_GAME_STARTED":
      return {
        ...state,
        gameStarted: action.payload,
      }
    case "ADD_SNOT":
      return {
        ...state,
        inventory: {
          ...state.inventory,
          snot: state.inventory.snot + action.payload,
        },
      }
    case "SYNC_WITH_TELEGRAM":
      return state
    case "LOAD_FROM_TELEGRAM":
      return state
    case "SET_FUSION_GAME_ACTIVE":
      return { ...state, fusionGameActive: action.payload }
    case "UPGRADE_FILLING_SPEED":
      const newSpeedLevel = Math.min(state.fillingSpeedLevel + 1, 100)
      const speedUpgradeCost = Math.floor(
        (state.Cap * newSpeedLevel + state.Cap * 0.5 + state.Cap * newSpeedLevel * 2) / 2,
      )
      if (state.inventory.snotCoins >= speedUpgradeCost) {
        const newSpeed = calculateFillingSpeed(newSpeedLevel)
        return {
          ...state,
          fillingSpeedLevel: newSpeedLevel,
          fillingSpeed: newSpeed,
          inventory: {
            ...state.inventory,
            snotCoins: state.inventory.snotCoins - speedUpgradeCost,
            fillingSpeedLevel: newSpeedLevel,
          },
        }
      }
      return state
    case "SET_BACKGROUND_MUSIC_MUTE":
      return {
        ...state,
        isBackgroundMusicMuted: action.payload,
      }
    case "ADD_TO_INVENTORY":
      return {
        ...state,
        inventory: {
          ...state.inventory,
          [action.item]: (state.inventory[action.item] || 0) + action.amount,
        },
      }
    case "REMOVE_FROM_INVENTORY":
      return {
        ...state,
        inventory: {
          ...state.inventory,
          [action.item]: Math.max(0, (state.inventory[action.item] || 0) - action.amount),
        },
      }
    case "UPDATE_RESOURCES":
      const newContainerSnot = Math.min(state.containerSnot + state.fillingSpeed, state.Cap)
      return {
        ...state,
        containerSnot: newContainerSnot,
      }
    case "SET_EFFECTS_MUTE":
      return {
        ...state,
        isEffectsMuted: action.payload,
      }
    case "UPGRADE_CONTAINER_CAPACITY":
      const newContainerLevel = Math.min(state.containerLevel + 1, 100)
      const containerUpgradeCost = Math.floor(
        (state.Cap * newContainerLevel + state.Cap * 0.5 + state.Cap * newContainerLevel * 2) / 2,
      )
      if (state.inventory.snotCoins >= containerUpgradeCost) {
        const newCap = state.Cap + 1
        return {
          ...state,
          containerLevel: newContainerLevel,
          Cap: newCap,
          inventory: {
            ...state.inventory,
            snotCoins: state.inventory.snotCoins - containerUpgradeCost,
            containerCapacityLevel: newContainerLevel,
          },
        }
      }
      return state
    case "SET_CONTAINER_CAPACITY":
      return {
        ...state,
        containerCapacity: action.payload,
      }
    case "UPDATE_FUSION_GAME_AVAILABILITY":
      const currentTime = Date.now()
      const timeSinceLastGame = currentTime - state.lastFusionGameTime
      const recoveryTime = 12 * 60 * 60 * 1000
      if (timeSinceLastGame >= recoveryTime) {
        return {
          ...state,
          fusionAttemptsUsed: 0,
          lastFusionGameTime: currentTime,
          fusionGamesAvailable: 2,
        }
      }
      return state
    case "USE_FUSION_GAME":
      return {
        ...state,
        fusionGamesAvailable: state.fusionGamesAvailable > 0 ? state.fusionGamesAvailable - 1 : 0,
        lastFusionGameTime: Date.now(),
        fusionGameStarted: true,
      }
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
        fusionGameStarted: false,
        fusionGameActive: false,
      }
    case "START_FUSION_GAME":
      return {
        ...state,
        fusionGameActive: true,
        fusionGameStarted: true,
      }
    case "SET_WALLET":
      return {
        ...state,
        wallet: action.payload,
      }
    case "SET_ETH_BALANCE":
      return {
        ...state,
        ethBalance: action.payload,
      }
    case "MOVE_SC_TO_GAME":
      const amountToMove = action.payload
      if (state.wallet) {
        return {
          ...state,
          wallet: {
            ...state.wallet,
            snotCoins: (state.wallet.snotCoins || 0) - amountToMove,
          },
          inventory: {
            ...state.inventory,
            snotCoins: state.inventory.snotCoins + amountToMove,
          },
        }
      }
      return state
    case "LOAD_GAME_STATE":
      return {
        ...state,
        ...action.payload,
        user: state.user,
      }
    case "SET_USER":
      return { ...state, user: action.payload }
    case "SET_THEME":
      return { ...state, theme: { ...state.theme, ...action.payload } }
    case "INCREMENT_FUSION_GAMES_PLAYED":
      return {
        ...state,
        fusionGamesPlayed: state.fusionGamesPlayed + 1,
      }
    case "SET_EFFECTS_SOUND_VOLUME":
      return { ...state, effectsSoundVolume: action.payload }
    default:
      return state
  }
}

