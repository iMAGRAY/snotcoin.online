import type React from "react"
import { createContext, useContext, useReducer, useEffect, useCallback } from "react"
import { gameReducer } from "../reducers/gameReducer"
import { type GameState, type Action, initialState } from "../types/gameTypes"
import { getTelegramUser, getTelegramThemeParams } from "../utils/telegramAuth"
import { saveGameState, loadGameState } from "../utils/storage"

interface GameContextType {
  state: GameState
  dispatch: React.Dispatch<Action>
  saveGame: () => Promise<void>
  loadGame: () => Promise<void>
}

const GameContext = createContext<GameContextType | undefined>(undefined)

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState)

  const saveGame = useCallback(async () => {
    if (state.user) {
      await saveGameState(state.user.telegram_id.toString(), state)
    }
  }, [state])

  const loadGame = useCallback(async () => {
    if (state.user) {
      const loadedState = await loadGameState(state.user.telegram_id.toString())
      if (loadedState) {
        dispatch({ type: "LOAD_GAME_STATE", payload: loadedState })
      }
    }
  }, [state.user])

  useEffect(() => {
    const user = getTelegramUser()
    if (user) {
      dispatch({ type: "SET_USER", payload: user })
    }

    const themeParams = getTelegramThemeParams()
    if (themeParams) {
      dispatch({
        type: "SET_THEME",
        payload: {
          backgroundColor: themeParams.bg_color,
          textColor: themeParams.text_color,
          buttonColor: themeParams.button_color,
          buttonTextColor: themeParams.button_text_color,
        },
      })
    }

    loadGame()
  }, [loadGame])

  useEffect(() => {
    const saveInterval = setInterval(saveGame, 60000) // Save every minute
    return () => clearInterval(saveInterval)
  }, [saveGame])

  return <GameContext.Provider value={{ state, dispatch, saveGame, loadGame }}>{children}</GameContext.Provider>
}

export const useGameState = () => {
  const context = useContext(GameContext)
  if (context === undefined) {
    throw new Error("useGameState must be used within a GameProvider")
  }
  return context.state
}

export const useGameDispatch = () => {
  const context = useContext(GameContext)
  if (context === undefined) {
    throw new Error("useGameDispatch must be used within a GameProvider")
  }
  return context.dispatch
}

export const useGameActions = () => {
  const context = useContext(GameContext)
  if (context === undefined) {
    throw new Error("useGameActions must be used within a GameProvider")
  }
  return { saveGame: context.saveGame, loadGame: context.loadGame }
}

export const useGameContext = () => {
  const context = useContext(GameContext)
  if (context === undefined) {
    throw new Error("useGameContext must be used within a GameProvider")
  }
  return context
}

