import { GameState } from './gameTypes'

export interface LocalState {
  showColorButtons: boolean;
  collectionResult: 'success' | 'fail' | null;
  collectedAmount: number | null;
  flyingNumbers: Array<{ id: number; value: number }>;
}

export type LocalAction =
  | { type: 'SET_LOCAL_STATE'; payload: Partial<LocalState> }
  | { type: 'ADD_FLYING_NUMBER'; payload: { id: number; value: number } }
  | { type: 'REMOVE_FLYING_NUMBER'; payload: number };

export interface BackgroundImageProps {
  store: GameState
  dispatch: React.Dispatch<any>
  localState: LocalState
  localDispatch: React.Dispatch<LocalAction>
  onContainerClick: () => void
}

export interface StatusDisplayProps {
  containerCapacity: number
  containerLevel: number
  containerSnot: number
  containerFillingSpeed: number
  fillingSpeedLevel: number
}

export interface EnergyDisplayProps {
  energy: number
  maxEnergy: number
}

