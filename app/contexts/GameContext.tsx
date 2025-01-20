"use client"

import type React from "react"
import { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from "react"
import { gameReducer } from "../reducers/gameReducer"
import { type GameState, type Action, initialState } from "../types/gameTypes"
import { formatEther, JsonRpcProvider, Wallet } from "ethers"
import { updateGameProgress, createTransaction, getUserByTelegramId, updateUserGameState } from "../utils/db"
import { supabase } from "../utils/supabase"

const GameContext = createContext<GameContextType | undefined>(undefined)

interface GameContextType {
  state: GameState
  dispatch: React.Dispatch<Action>
  addToInventory: (item: keyof GameState["inventory"], amount: number) => void
  removeFromInventory: (item: keyof GameState["inventory"], amount: number) => boolean
  getInventoryItemCount: (item: keyof GameState["inventory"]) => number
  generateWallet: () => Promise<void>
  getEthBalance: (address: string) => Promise<void>
  saveGameState: () => Promise<void>
  loadGameState: () => Promise<void>
  createGameTransaction: (
    type: "SNOT_GAIN" | "SNOT_SPEND" | "COIN_GAIN" | "COIN_SPEND",
    amount: number,
    description: string,
  ) => Promise<void>
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)

  const addToInventory = useCallback(
    (item: keyof GameState["inventory"], amount: number) => {
      dispatch({ type: "ADD_TO_INVENTORY", item, amount })
      if (item === "containerCapacityLevel") {
        dispatch({ type: "SET_CONTAINER_CAPACITY", payload: amount })
      }
    },
    [dispatch],
  )

  const removeFromInventory = useCallback(
    (item: keyof GameState["inventory"], amount: number): boolean => {
      if ((state.inventory[item] || 0) >= amount) {
        dispatch({ type: "REMOVE_FROM_INVENTORY", item, amount })
        if (item === "containerCapacityLevel") {
          dispatch({ type: "SET_CONTAINER_CAPACITY", payload: state.inventory.containerCapacityLevel - amount })
        }
        return true
      }
      return false
    },
    [state.inventory, dispatch],
  )

  const getInventoryItemCount = useCallback(
    (item: keyof GameState["inventory"]): number => {
      return state.inventory[item] || 0
    },
    [state.inventory],
  )

  const generateWallet = useCallback(async () => {
    try {
      const wallet = Wallet.createRandom()
      if (wallet.mnemonic) {
        dispatch({
          type: "SET_WALLET",
          payload: {
            address: wallet.address,
            seedPhrase: wallet.mnemonic.phrase,
          },
        })
        // Wallet generated successfully
      } else {
        throw new Error("Failed to generate wallet mnemonic")
      }
    } catch (error) {
      console.error("Error generating wallet:", error)
    }
  }, [dispatch])

  const getEthBalance = useCallback(
    async (address: string) => {
      try {
        // Use a public RPC URL for the Base network
        const provider = new JsonRpcProvider("https://mainnet.base.org")

        const balance = await provider.getBalance(address)
        const formattedBalance = formatEther(balance)
        console.log("Fetched balance:", formattedBalance) // Log the fetched balance
        dispatch({ type: "SET_ETH_BALANCE", payload: Number(formattedBalance).toFixed(5) })
      } catch (error: any) {
        console.error("Error fetching ETH balance:", error)
        console.error("Error details:", JSON.stringify(error, null, 2)) // Log detailed error information
        dispatch({ type: "SET_ETH_BALANCE", payload: "0.00000" })
      }
    },
    [dispatch],
  )

  useEffect(() => {
    const intervalId = setInterval(() => {
      dispatch({ type: "UPDATE_RESOURCES" })
      dispatch({ type: "UPDATE_ENERGY" })
    }, 1000)

    return () => clearInterval(intervalId)
  }, [dispatch])

  useEffect(() => {
    const updateBalance = async () => {
      if (state.wallet && state.wallet.address) {
        await getEthBalance(state.wallet.address)
      }
    }

    updateBalance() // Update balance immediately

    const intervalId = setInterval(updateBalance, 30000) // Update every 30 seconds

    return () => clearInterval(intervalId)
  }, [state.wallet, getEthBalance])

  useEffect(() => {
    if (state.wallet && state.wallet.address) {
      getEthBalance(state.wallet.address).catch((error) => {
        console.error("Failed to get ETH balance:", error)
        if (error.message) {
          console.error("Error message:", error.message)
        }
        if (error.stack) {
          console.error("Error stack:", error.stack)
        }
      })
    }
  }, [state.wallet, getEthBalance])

  const saveGameState = useCallback(async () => {
    if (state.user) {
      try {
        await updateUserGameState(state.user.id.toString(), state)
      } catch (error) {
        console.error("Error saving game state:", error)
      }
    }
  }, [state])

  const loadGameState = useCallback(async (): Promise<void> => {
    if (state.user) {
      try {
        const dbUser = await getUserByTelegramId(state.user.telegram_id)
        dispatch({
          type: "LOAD_GAME_STATE",
          payload: {
            inventory: dbUser.inventories,
            ...dbUser.game_progress,
            wallet: dbUser.wallets[0],
          },
        })
      } catch (error) {
        console.error("Error loading game state:", error)
      }
    }
  }, [state.user, dispatch])

  const createGameTransaction = useCallback(
    async (type: "SNOT_GAIN" | "SNOT_SPEND" | "COIN_GAIN" | "COIN_SPEND", amount: number, description: string) => {
      if (state.user) {
        try {
          await createTransaction(state.user.id.toString(), type, amount, description)
        } catch (error) {
          console.error("Error creating transaction:", error)
        }
      }
    },
    [state.user],
  )

  useEffect(() => {
    const saveInterval = setInterval(() => {
      saveGameState()
    }, 60000) // Save every minute

    return () => clearInterval(saveInterval)
  }, [saveGameState])

  const contextValue = useMemo(
    () => ({
      state,
      dispatch,
      addToInventory,
      removeFromInventory,
      getInventoryItemCount,
      generateWallet,
      getEthBalance,
      saveGameState,
      loadGameState,
      createGameTransaction,
    }),
    [
      state,
      dispatch,
      addToInventory,
      removeFromInventory,
      getInventoryItemCount,
      generateWallet,
      getEthBalance,
      saveGameState,
      loadGameState,
      createGameTransaction,
    ],
  )

  return <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>
}

export function useGameContext() {
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
  const { addToInventory, removeFromInventory, getInventoryItemCount } = useGameContext()
  return { addToInventory, removeFromInventory, getInventoryItemCount }
}

export const useWallet = () => {
  const { state, generateWallet, getEthBalance } = useGameContext()
  const handleRefreshBalance = useCallback(() => {
    if (state.wallet && state.wallet.address) {
      getEthBalance(state.wallet.address)
    }
  }, [state.wallet, getEthBalance])
  return {
    wallet: state.wallet,
    generateWallet,
    getEthBalance,
    handleRefreshBalance,
    ethBalance: state.ethBalance,
  }
}

