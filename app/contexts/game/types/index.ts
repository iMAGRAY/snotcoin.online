import type { GameState, Action, ExtendedGameState } from '../../../types/gameTypes'
import type { ReactNode } from 'react'

export interface GameProviderProps {
  children: ReactNode
}

export interface GameContextValue {
  state: ExtendedGameState
  dispatch: (action: Action) => void
  isSaving: boolean
}

export interface GameContextType {
  GameStateContext: React.Context<ExtendedGameState | null>
  GameDispatchContext: React.Context<((action: Action) => void) | null>
  IsSavingContext: React.Context<boolean>
  useGameState: () => ExtendedGameState
  useGameDispatch: () => (action: Action) => void
  useIsSaving: () => boolean
  useGameContext: () => GameContextValue
}

export interface MemoryStore {
  resourcesSnapshot?: string
  isLoadingInProgress?: boolean
  lastSaveAttempt?: number
  lastForceSaveAttempt?: number
  lastUnmountLogTime?: number
  isUnmountSaveInProgress?: boolean
  lastStateRaw?: any
  lastStateSnapshot?: string
  authenticatedUserIds?: string[]
  [key: string]: any
} 