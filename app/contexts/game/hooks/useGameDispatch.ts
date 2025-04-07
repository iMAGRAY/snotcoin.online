import { useContext } from 'react'
import { SetGameStateContext } from '../contexts'
import type { GameState } from '../../../types/gameTypes'

export function useGameDispatch(): (newStateOrFunction: GameState | ((prevState: GameState) => GameState)) => void {
  const context = useContext(SetGameStateContext)
  if (!context) {
    throw new Error('useGameDispatch должен использоваться внутри GameProvider')
  }
  return context
} 