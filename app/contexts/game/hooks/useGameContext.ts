import { useGameState } from './useGameState'
import { useGameDispatch } from './useGameDispatch'
import type { GameState } from '../../../types/gameTypes'

interface GameContextValue {
  state: GameState
  setState: (newStateOrFunction: GameState | ((prevState: GameState) => GameState)) => void
}

export function useGameContext(): GameContextValue {
  const state = useGameState()
  const setState = useGameDispatch()
  
  return {
    state,
    setState
  }
}

export { useGameState, useGameDispatch } 