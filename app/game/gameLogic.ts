import type { GameState, Action } from "../types/gameTypes"
import { CONTAINER_UPGRADES, FILLING_SPEED_UPGRADES } from "../types/gameTypes"

export function updateResources(state: GameState): GameState {
  const newContainerSnot = Math.min(state.containerSnot + state.fillingSpeed, state.inventory.Cap)
  return { ...state, containerSnot: newContainerSnot }
}

export function updateEnergy(state: GameState): GameState {
  const energyRecoveryRate = state.maxEnergy / (12 * 60 * 60)
  const newEnergy = Math.min(state.energy + energyRecoveryRate, state.maxEnergy)
  const energyRecoveryTime = Math.ceil((state.maxEnergy - newEnergy) / energyRecoveryRate)
  return { ...state, energy: newEnergy, energyRecoveryTime }
}

export function upgradeContainerCapacity(state: GameState): GameState {
  const nextLevel = state.inventory.containerCapacityLevel + 1
  if (nextLevel <= 100) {
    const upgrade = CONTAINER_UPGRADES[nextLevel - 2]
    if (state.inventory.snotCoins >= upgrade.cost) {
      return {
        ...state,
        inventory: {
          ...state.inventory,
          containerCapacityLevel: nextLevel,
          Cap: state.inventory.Cap + upgrade.capacityIncrease,
          snotCoins: state.inventory.snotCoins - upgrade.cost,
        },
      }
    }
  }
  return state
}

export function upgradeFillingSpeed(state: GameState): GameState {
  const nextLevel = state.inventory.fillingSpeedLevel + 1
  if (nextLevel <= 100) {
    const upgrade = FILLING_SPEED_UPGRADES[nextLevel - 2]
    if (state.inventory.snotCoins >= upgrade.cost) {
      return {
        ...state,
        inventory: {
          ...state.inventory,
          fillingSpeedLevel: nextLevel,
          snotCoins: state.inventory.snotCoins - upgrade.cost,
        },
        fillingSpeed: (1 + upgrade.speedIncrease) / (24 * 60 * 60),
      }
    }
  }
  return state
}

export function collectContainerSnot(state: GameState, amount: number): GameState {
  return {
    ...state,
    inventory: {
      ...state.inventory,
      snot: state.inventory.snot + amount,
    },
    containerSnot: 0,
  }
}

export function openChest(state: GameState, requiredSnot: number, rewardAmount: number): GameState {
  return {
    ...state,
    inventory: {
      ...state.inventory,
      snot: state.inventory.snot - requiredSnot,
      snotCoins: state.inventory.snotCoins + rewardAmount,
    },
  }
}

export function upgradeCollectionEfficiency(state: GameState, cost: number): GameState {
  if (state.inventory.snotCoins >= cost) {
    return {
      ...state,
      inventory: {
        ...state.inventory,
        collectionEfficiency: Math.min(state.inventory.collectionEfficiency + 0.01, 2.0),
        snotCoins: state.inventory.snotCoins - cost,
      },
    }
  }
  return state
}

export function consumeEnergy(state: GameState, amount: number): GameState {
  return { ...state, energy: Math.max(0, state.energy - amount) }
}

export function addSnot(state: GameState, amount: number): GameState {
  return {
    ...state,
    inventory: {
      ...state.inventory,
      snot: state.inventory.snot + amount,
    },
  }
}

export function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "SET_RESOURCE":
      return { ...state, [action.resource]: action.payload }
    case "UPDATE_RESOURCES":
      return updateResources(state)
    case "UPDATE_ENERGY":
      return updateEnergy(state)
    case "UPGRADE_CONTAINER_CAPACITY":
      return upgradeContainerCapacity(state)
    case "UPGRADE_FILLING_SPEED":
      return upgradeFillingSpeed(state)
    case "COLLECT_CONTAINER_SNOT":
      if (typeof action.payload === "number") {
        return collectContainerSnot(state, action.payload)
      } else {
        return collectContainerSnot(state, action.payload.amount)
      }
    case "OPEN_CHEST":
      return openChest(state, action.payload.requiredSnot, action.payload.rewardAmount)
    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.payload as GameState["activeTab"] }
    case "SET_CLICK_SOUND_VOLUME":
      return { ...state, clickSoundVolume: action.payload }
    case "SET_BACKGROUND_MUSIC_VOLUME":
      return { ...state, backgroundMusicVolume: action.payload }
    case "SET_MUTE":
      return {
        ...state,
        isMuted: action.payload,
        isEffectsMuted: action.payload,
        isBackgroundMusicMuted: action.payload,
      }
    case "UPGRADE_COLLECTION_EFFICIENCY":
      return upgradeCollectionEfficiency(state, action.payload)
    case "CONSUME_ENERGY":
      return consumeEnergy(state, action.payload)
    case "ADD_SNOT":
      return addSnot(state, action.payload)
    case "SET_EFFECTS_MUTE":
      return { ...state, isEffectsMuted: action.payload }
    case "SET_BACKGROUND_MUSIC_MUTE":
      return { ...state, isBackgroundMusicMuted: action.payload }
    case "SET_EFFECTS_SOUND_VOLUME":
      return { ...state, effectsSoundVolume: action.payload }
    case "CLEAR_GAME_DATA":
      return {
        ...state,
        inventory: {
          ...state.inventory,
          snot: 0,
          snotCoins: 0,
        },
        containerCapacity: 1,
        containerLevel: 1,
        activeTab: "laboratory",
        gameStarted: false,
      }
    case "SET_GAME_STARTED":
      return { ...state, gameStarted: action.payload }
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
    case "SET_FUSION_GAME_ACTIVE":
      return { ...state, fusionGameActive: action.payload }
    case "SET_FUSION_GAME_STARTED":
      return { ...state, fusionGameStarted: action.payload }
    case "USE_FUSION_ATTEMPT":
      return { ...state, fusionAttemptsUsed: state.fusionAttemptsUsed + 1 }
    case "RESET_FUSION_GAME":
      return { ...state, fusionGameActive: false, fusionGameStarted: false }
    case "START_FUSION_GAME":
      return { ...state, fusionGameActive: true, fusionGameStarted: true }
    case "SET_WALLET":
      return { ...state, wallet: action.payload }
    case "SET_ETH_BALANCE":
      return { ...state, ethBalance: action.payload }
    case "MOVE_SC_TO_GAME":
      return {
        ...state,
        wallet: {
          ...state.wallet,
          snotCoins: (state.wallet?.snotCoins || 0) - action.payload,
        },
        inventory: {
          ...state.inventory,
          snotCoins: state.inventory.snotCoins + action.payload,
        },
      }
    case "LOAD_GAME_STATE":
      return { ...state, ...action.payload }
    case "SET_USER":
      return { ...state, user: action.payload }
    case "SET_TELEGRAM_USER":
      return { ...state, user: action.payload }
    case "INCREMENT_FUSION_GAMES_PLAYED":
      return { ...state, fusionGamesPlayed: state.fusionGamesPlayed + 1 }
    default:
      return state
  }
}

