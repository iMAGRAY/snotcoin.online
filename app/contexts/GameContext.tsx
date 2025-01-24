"use client"

import { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from "react"
import { gameReducer, initialState } from "../reducers/gameReducer"
import type { GameState, Action } from "../types/gameTypes"
import { AuthProvider } from "./AuthContext"
import { calculateEnergyReplenishment } from "../utils/energyUtils"
import { saveGameState, loadGameState } from "../utils/gameStateManager"
import { getCurrentUser } from "../utils/auth"
import { debounce } from "lodash"

const GameContext = createContext<GameContextType | undefined>(undefined)

interface GameContextType {
  state: GameState
  dispatch: React.Dispatch<Action>
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)

  const contextValue = useMemo(() => ({ state, dispatch }), [state])

  useEffect(() => {
    const loadInitialState = async () => {
      const {
        data: { user },
      } = await getCurrentUser()
      if (user) {
        try {
          const savedState = await loadGameState(user.id)
          if (savedState) {
            dispatch({ type: "LOAD_GAME_STATE", payload: savedState })
          }
        } catch (error) {
          console.error("Error loading initial game state:", error)
        }
      }
    }

    loadInitialState()
  }, [])

  const saveState = async () => {
    try {
      if (!state.user?.id) {
        console.error("User ID is missing, cannot save game state")
        return
      }
      await saveGameState(state.user.id, state)
      console.log("Game state saved successfully")
    } catch (error) {
      console.error("Error saving game state:", error)
      dispatch({ type: "SAVE_GAME_STATE_ERROR", payload: "Failed to save game state. Please try again later." })
    }
  }

  const debouncedSaveState = useMemo(
    () => debounce(saveState, 5000, { leading: false, trailing: true }),
    [state.user?.id],
  )

  useEffect(() => {
    if (state.user) {
      debouncedSaveState()
    }
    return () => {
      debouncedSaveState.cancel()
    }
  }, [state, debouncedSaveState])

  useEffect(() => {
    const lastLoginTime = state.lastLoginTime || Date.now()
    const replenishedEnergy = calculateEnergyReplenishment(
      lastLoginTime,
      state.energy,
      state.maxEnergy,
      1, // Replenish 1 energy per minute
    )

    // Update state with replenished energy and new login time
    if (replenishedEnergy !== state.energy) {
      dispatch({ type: "SET_ENERGY", payload: replenishedEnergy })
      dispatch({ type: "SET_LAST_LOGIN_TIME", payload: new Date().toISOString() })
    }

    const intervalId = setInterval(() => {
      dispatch({ type: "UPDATE_RESOURCES" })
    }, 1000)

    return () => clearInterval(intervalId)
  }, [state.lastLoginTime, state.energy, state.maxEnergy])

  return (
    <AuthProvider>
      <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>
    </AuthProvider>
  )
}

export const useGameContext = () => {
  const context = useContext(GameContext)
  if (context === undefined) {
    throw new Error("useGameContext must be used within a GameProvider")
  }
  return context
}

export const useGameState = (): GameState => {
  const { state } = useGameContext()
  return state
}

export const useGameDispatch = (): React.Dispatch<Action> => {
  const { dispatch } = useGameContext()
  return dispatch
}

export const useInventory = () => {
  const { state, dispatch } = useGameContext()

  const addToInventory = useCallback(
    (item: keyof GameState["inventory"], amount: number) => {
      dispatch({ type: "ADD_TO_INVENTORY", item, amount })
    },
    [dispatch],
  )

  const removeFromInventory = useCallback(
    (item: keyof GameState["inventory"], amount: number) => {
      dispatch({ type: "REMOVE_FROM_INVENTORY", item, amount })
    },
    [dispatch],
  )

  return {
    inventory: state.inventory,
    addToInventory,
    removeFromInventory,
  }
}

export const useContainer = () => {
  const { state } = useGameContext()

  return {
    containerLevel: state.containerLevel,
    containerCapacity: state.containerCapacity,
    containerSnot: state.containerSnot,
    fillingSpeedLevel: state.fillingSpeedLevel,
    fillingSpeed: state.fillingSpeed,
  }
}

export const useEnergy = () => {
  const { state, dispatch } = useGameContext()

  const consumeEnergy = useCallback(
    (amount: number) => {
      dispatch({ type: "CONSUME_ENERGY", payload: amount })
    },
    [dispatch],
  )

  return {
    energy: state.energy,
    maxEnergy: state.maxEnergy,
    energyRecoveryTime: state.energyRecoveryTime,
    consumeEnergy,
  }
}

export const useFusionGame = () => {
  const { state, dispatch } = useGameContext()

  const startFusionGame = useCallback(() => {
    dispatch({ type: "START_FUSION_GAME" })
  }, [dispatch])

  const resetFusionGame = useCallback(() => {
    dispatch({ type: "RESET_FUSION_GAME" })
  }, [dispatch])

  return {
    fusionGameActive: state.fusionGameActive,
    fusionGameStarted: state.fusionGameStarted,
    fusionAttemptsUsed: state.fusionAttemptsUsed,
    fusionGamesPlayed: state.fusionGamesPlayed,
    fusionGamesAvailable: state.fusionGamesAvailable,
    startFusionGame,
    resetFusionGame,
  }
}

export const useWallet = () => {
  const { state } = useGameContext()
  return {
    wallet: state.wallet,
    ethBalance: state.ethBalance,
  }
}

