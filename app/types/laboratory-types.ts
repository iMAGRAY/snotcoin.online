import type React from "react"
import type { GameState } from "./gameTypes"

// Удалим дублирующиеся типы и оставим только специфичные для лаборатории
export interface LocalState {
  showColorButtons: boolean
  collectionResult: "success" | "fail" | null
  collectedAmount: number | null
  flyingNumbers: Array<{ id: number; value: number }>
}

export type LocalAction =
  | { type: "SET_LOCAL_STATE"; payload: Partial<LocalState> }
  | { type: "ADD_FLYING_NUMBER"; payload: { id: number; value: number } }
  | { type: "REMOVE_FLYING_NUMBER"; payload: number }

export interface LaboratoryProps {
  gameState: GameState
  dispatch: React.Dispatch<any>
}

export interface StatusDisplayProps {
  containerCapacity: number
  containerLevel: number
  containerSnot: number
  containerFillingSpeed: number
  fillingSpeedLevel: number
}

export interface CollectButtonProps {
  onCollect: () => void
  containerSnot: number
  isCollecting: boolean
}

export interface BackgroundImageProps {
  store: GameState
  onContainerClick: (() => void) | null
  allowContainerClick: boolean
  isContainerClicked: boolean
  id: string
  containerSnotValue: string
  containerFilling: number
}

export interface FlyingNumberProps {
  value: number
}

export interface UpgradeButtonProps {
  onClick: () => void
}

