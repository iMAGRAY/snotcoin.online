import { useContext } from 'react'
import { GameStateContext } from '../contexts'
import type { GameState } from '../../../types/gameTypes'

export function useGameState(): GameState {
  const context = useContext(GameStateContext)
  if (!context) {
    throw new Error('useGameState должен использоваться внутри GameProvider')
  }
  return context
} 