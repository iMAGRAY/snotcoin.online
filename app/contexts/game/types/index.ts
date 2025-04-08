import type { GameState, Action, ExtendedGameState } from '../../../types/gameTypes'
import type { ReactNode } from 'react'

export interface GameProviderProps {
  children: ReactNode
}

export interface GameContextValue {
  state: ExtendedGameState
  dispatch: (action: Action) => void
}

export interface GameContextType {
  GameStateContext: React.Context<ExtendedGameState | null>
  GameDispatchContext: React.Context<((action: Action) => void) | null>
  useGameState: () => ExtendedGameState
  useGameDispatch: () => (action: Action) => void
  useGameContext: () => GameContextValue
}

export interface MemoryStore {
  resourcesSnapshot?: string
  authenticatedUserIds?: string[]
  [key: string]: any
} 