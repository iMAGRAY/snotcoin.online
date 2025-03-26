import { useContext } from 'react'
import { GameDispatchContext } from '../contexts'
import type { Action } from '../../../types/gameTypes'

export function useGameDispatch(): (action: Action) => void {
  const context = useContext(GameDispatchContext)
  if (!context) {
    throw new Error('useGameDispatch должен использоваться внутри GameProvider')
  }
  return context
} 