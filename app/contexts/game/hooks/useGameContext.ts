import { useGameState } from './useGameState'
import { useGameDispatch } from './useGameDispatch'
import { useIsSaving } from './useIsSaving'
import type { GameState, Action } from '../../../types/gameTypes'

interface GameContextValue {
  state: GameState
  dispatch: React.Dispatch<Action>
  isSaving: boolean
}

export function useGameContext(): GameContextValue {
  const state = useGameState()
  const dispatch = useGameDispatch()
  const isSaving = useIsSaving()
  
  return {
    state,
    dispatch,
    isSaving
  }
}

export { useGameState, useGameDispatch, useIsSaving } 