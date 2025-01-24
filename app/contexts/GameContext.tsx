"use client"

import type React from "react"
import { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from "react"
import { gameReducer, initialState } from "../reducers/gameReducer"
import type { GameState, Action } from "../types/gameTypes"
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  loadUserFromLocalStorage,
  saveUserToLocalStorage,
  clearLocalStorage,
} from "../utils/localStorage"
import { AuthProvider } from "./AuthContext"
import { calculateEnergyReplenishment } from "../utils/energyUtils"

const GameContext = createContext<GameContextType | undefined>(undefined)

interface GameContextType {
  state: GameState
  dispatch: React.Dispatch<Action>
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)

  const contextValue = useMemo(() => ({ state, dispatch }), [state])

  useEffect(() => {
    const loadInitialState = () => {
      const authToken = localStorage.getItem("authToken")
      if (authToken) {
        try {
          let userData
          try {
            const decodedToken = atob(authToken)
            userData = JSON.parse(decodedToken)
          } catch (error) {
            console.error("Error decoding auth token:", error)
            userData = null
          }

          if (userData) {
            console.log("Loading initial user data:", userData)
            dispatch({ type: "LOAD_USER_DATA", payload: userData } as Action)
          } else {
            console.error("Invalid user data in auth token")
          }
        } catch (error) {
          console.error("Error loading initial user data:", error)
        }
      } else {
        console.log("No auth token found in localStorage")
      }
    }

    loadInitialState()
  }, [])

  useEffect(() => {
    if (state.user) {
      console.log("GameContext updated:", state)

      // Calculate energy replenishment
      const lastLoginTime = state.lastLoginTime || Date.now()
      const replenishedEnergy = calculateEnergyReplenishment(
        lastLoginTime,
        state.energy,
        state.maxEnergy,
        1, // Replenish 1 energy per minute
      )

      // Update state with replenished energy and new login time
      if (replenishedEnergy !== state.energy) {
        dispatch({ type: "SET_ENERGY", payload: replenishedEnergy } as Action)
        dispatch({ type: "SET_LAST_LOGIN_TIME", payload: Date.now() } as Action)
      }

      const intervalId = setInterval(() => {
        dispatch({ type: "UPDATE_RESOURCES" } as Action)
      }, 1000)

      return () => clearInterval(intervalId)
    }
  }, [state.user, state.lastLoginTime, state.energy, state.maxEnergy])

  useEffect(() => {
    const authToken = localStorage.getItem("authToken")
    if (authToken && !state.user) {
      dispatch({ type: "LOAD_USER_DATA", payload: authToken } as Action)
    }
  }, [state.user])

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
      if (state.user) {
        dispatch({ type: "ADD_TO_INVENTORY", item, amount })
      }
    },
    [dispatch, state.user],
  )

  const removeFromInventory = useCallback(
    (item: keyof GameState["inventory"], amount: number) => {
      if (state.user) {
        dispatch({ type: "REMOVE_FROM_INVENTORY", item, amount })
      }
    },
    [dispatch, state.user],
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
      if (state.user) {
        dispatch({ type: "CONSUME_ENERGY", payload: amount })
      }
    },
    [dispatch, state.user],
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
    if (state.user) {
      dispatch({ type: "START_FUSION_GAME" })
    }
  }, [dispatch, state.user])

  const resetFusionGame = useCallback(() => {
    if (state.user) {
      dispatch({ type: "RESET_FUSION_GAME" })
    }
  }, [dispatch, state.user])

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
    ethBalance: state.wallet?.balance || "0",
  }
}

