import { useCallback, useRef, useEffect } from "react"
import { useGamePhysics } from "./useGamePhysics"
import { useGameState } from "./useGameState"
import { detectCollision, resolveCollision } from "../utils/collisionDetection"
import { mergeBalls } from "../utils/ballMerging"

export const useGameLoop = (isPaused: boolean) => {
  const { updateBallPhysics } = useGamePhysics()
  const { updateBalls, increaseScore, updateHighestMergedLevel, fusionBalls } = useGameState()
  const nextBallId = useRef(0)

  const gameLoop = useCallback(() => {
    if (isPaused) return

    let updatedBalls = fusionBalls.map(updateBallPhysics)

    // Collision detection and resolution
    for (let i = 0; i < updatedBalls.length; i++) {
      for (let j = i + 1; j < updatedBalls.length; j++) {
        if (detectCollision(updatedBalls[i], updatedBalls[j])) {
          const [resolvedBall1, resolvedBall2] = resolveCollision(updatedBalls[i], updatedBalls[j])
          updatedBalls[i] = resolvedBall1
          updatedBalls[j] = resolvedBall2

          const { mergedBall, scoreIncrease, snotReward } = mergeBalls(resolvedBall1, resolvedBall2, nextBallId)
          if (mergedBall) {
            updatedBalls = updatedBalls.filter(
              (ball: any) => ball.id !== resolvedBall1.id && ball.id !== resolvedBall2.id,
            )
            updatedBalls.push(mergedBall)
            increaseScore(scoreIncrease)
            updateHighestMergedLevel(mergedBall.level)
            // Handle snotReward here if needed
          }
        }
      }
    }

    updateBalls(updatedBalls)
  }, [isPaused, fusionBalls, updateBallPhysics, updateBalls, increaseScore, updateHighestMergedLevel])

  useEffect(() => {
    let animationFrameId: number

    const animate = () => {
      gameLoop()
      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [gameLoop])

  return { gameLoop }
}

