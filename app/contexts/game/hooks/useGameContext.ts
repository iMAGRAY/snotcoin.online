import { useGameState } from './useGameState'
import { useGameDispatch } from './useGameDispatch'
import { useIsSaving } from './useIsSaving'
import type { GameState } from '../../../types/gameTypes'

interface GameContextValue {
  state: GameState
  setState: (newStateOrFunction: GameState | ((prevState: GameState) => GameState)) => void
  isSaving: boolean
}

export function useGameContext(): GameContextValue {
  const state = useGameState()
  const setState = useGameDispatch()
  const isSaving = useIsSaving()
  
  return {
    state,
    setState,
    isSaving
  }
}

export { useGameState, useGameDispatch, useIsSaving } 