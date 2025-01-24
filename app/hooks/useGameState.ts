import { useContext } from "react"
import { useGameContext } from "../contexts/GameContext"
import type { GameState, Action } from "../types/gameTypes"
import type { Ball } from "../types/fusion-game"

export const useGameState = () => {
  const context = useGameContext()
  if (!context) {
    throw new Error("useGameState must be used within a GameProvider")
  }

  const { state, dispatch } = context

  const updateBalls = (balls: Ball[]) =>
    dispatch({ type: "SET_RESOURCE", resource: "fusionBalls" as keyof GameState, payload: balls })
  const increaseScore = (score: number) =>
    dispatch({ type: "SET_RESOURCE", resource: "fusionScore" as keyof GameState, payload: score })
  const updateHighestMergedLevel = (level: number) =>
    dispatch({ type: "SET_RESOURCE", resource: "highestLevel", payload: level })

  return {
    ...state,
    updateBalls,
    increaseScore,
    updateHighestMergedLevel,
    dispatch,
    fusionBalls: state.fusionBalls || [],
  }
}

