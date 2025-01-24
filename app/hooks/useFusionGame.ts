import { useState, useCallback, useRef, useEffect } from "react"
import { useGameState, useGameDispatch, useInventory } from "../contexts/GameContext"
import { type Ball, GAME_CONSTANTS, BALL_LEVELS, EXPLOSIVE_BALL, BULL_BALL } from "../types/fusion-game"
import { resolveCollision } from "../utils/fusion-game-utils"

const FLOOR_OFFSET = 0.1 // Small offset to keep balls above the floor

const TRANSPARENT_ZONE_HEIGHT = 100 // Example height, adjust as needed
const timerId: NodeJS.Timeout | null = null

export const useFusionGame = () => {
  const [thrownBalls, setThrownBalls] = useState<Ball[]>([])
  const [score, setScore] = useState(0)
  const [pendingScoreIncrease, setPendingScoreIncrease] = useState(0)
  const [pendingSnotReward, setPendingSnotReward] = useState(0)
  const [highestMergedLevel, setHighestMergedLevel] = useState(1)
  const [isGameOver, setIsGameOver] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [isJoyActive, setIsJoyActive] = useState(false)
  const [isExplosiveBallActive, setIsExplosiveBallActive] = useState(false)
  const [explosions, setExplosions] = useState<{ x: number; y: number; size: number }[]>([])
  const [ballsInTransparentZone, setBallsInTransparentZone] = useState(0)
  const [isPaused, setIsPaused] = useState(false) // Added isPaused state

  const gameState = useGameState()
  const gameDispatch = useGameDispatch()
  const { inventory } = useInventory()
  const { inventory: gameInventory } = useGameState()
  const nextBallId = useRef(0)
  const animationFrameId = useRef<number | null>(null)

  const handleGameOver = useCallback(() => {
    setIsGameOver(true)
    setFinalScore(score)
    gameDispatch({ type: "INCREMENT_FUSION_GAMES_PLAYED" })
  }, [score, gameDispatch])

  const updatePhysics = useCallback(() => {
    const currentTime = Date.now()

    setThrownBalls((prevBalls) => {
      let updatedBalls = prevBalls.map((ball) => {
        if (ball.isBull) {
          // Bull ball moves straight down and is not affected by physics
          return {
            ...ball,
            y: ball.y + ball.vy,
          }
        }

        // Rest of the existing ball update logic
        const newBall = { ...ball }

        // Apply Joy effect
        if (isJoyActive) {
          const randomAngle = Math.random() * Math.PI * 2
          const forceMagnitude = 0.3
          newBall.vx += Math.cos(randomAngle) * forceMagnitude
          newBall.vy += Math.sin(randomAngle) * forceMagnitude
        }

        // Basic physics update
        newBall.vy += GAME_CONSTANTS.GRAVITY
        newBall.vx *= GAME_CONSTANTS.AIR_RESISTANCE
        newBall.vy *= GAME_CONSTANTS.AIR_RESISTANCE

        newBall.x += newBall.vx
        newBall.y += newBall.vy

        // Wall collisions
        if (newBall.x - newBall.radius < GAME_CONSTANTS.WALL_WIDTH) {
          newBall.x = GAME_CONSTANTS.WALL_WIDTH + newBall.radius
          newBall.vx = Math.abs(newBall.vx) * GAME_CONSTANTS.BOUNCE_FACTOR
        } else if (newBall.x + newBall.radius > GAME_CONSTANTS.GAME_WIDTH - GAME_CONSTANTS.WALL_WIDTH) {
          newBall.x = GAME_CONSTANTS.GAME_WIDTH - GAME_CONSTANTS.WALL_WIDTH - newBall.radius
          newBall.vx = -Math.abs(newBall.vx) * GAME_CONSTANTS.BOUNCE_FACTOR
        }

        // Floor collision
        if (newBall.y + newBall.radius > GAME_CONSTANTS.GAME_HEIGHT) {
          newBall.y = GAME_CONSTANTS.GAME_HEIGHT - newBall.radius - FLOOR_OFFSET
          if (newBall.vy > 0) {
            newBall.vy = -Math.abs(newBall.vy) * GAME_CONSTANTS.BOUNCE_FACTOR
          }
          newBall.vx *= 0.98 // Apply friction
        }

        // Ceiling collision
        if (newBall.y - newBall.radius < 0) {
          newBall.y = newBall.radius
          newBall.vy = Math.abs(newBall.vy) * GAME_CONSTANTS.BOUNCE_FACTOR
        }

        if (Math.abs(newBall.vx) < GAME_CONSTANTS.MINIMUM_VELOCITY) newBall.vx = 0
        if (Math.abs(newBall.vy) < GAME_CONSTANTS.MINIMUM_VELOCITY) newBall.vy = 0

        return newBall
      })

      // Handle Bull ball collisions and removal
      const bullBalls = updatedBalls.filter((ball) => ball.isBull)
      bullBalls.forEach((bullBall) => {
        updatedBalls = updatedBalls.filter((ball) => {
          if (ball.id === bullBall.id) return true // Keep the Bull ball

          const dx = ball.x - bullBall.x
          const dy = ball.y - bullBall.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          // If the ball touches the Bull ball, remove it
          return distance > bullBall.radius + ball.radius
        })
      })

      // Handle explosions and collisions
      const explosions: { x: number; y: number; size: number }[] = []
      const ballsToRemove = new Set<number>()

      // Check for collisions
      for (let i = 0; i < updatedBalls.length; i++) {
        for (let j = i + 1; j < updatedBalls.length; j++) {
          const ball1 = updatedBalls[i]
          const ball2 = updatedBalls[j]

          if (ballsToRemove.has(ball1.id) || ballsToRemove.has(ball2.id)) continue

          const dx = ball2.x - ball1.x
          const dy = ball2.y - ball1.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          const minDistance = ball1.radius + ball2.radius

          if (distance < minDistance) {
            if (ball1.isExplosive || ball2.isExplosive) {
              const explosiveBall = ball1.isExplosive ? ball1 : ball2
              explosions.push({
                x: explosiveBall.x,
                y: explosiveBall.y,
                size: EXPLOSIVE_BALL.explosionRadius * 2,
              })
              ballsToRemove.add(explosiveBall.id)

              // Mark balls within explosion radius for removal
              updatedBalls.forEach((otherBall) => {
                if (otherBall.id !== explosiveBall.id) {
                  const explosionDx = otherBall.x - explosiveBall.x
                  const explosionDy = otherBall.y - explosiveBall.y
                  const explosionDistance = Math.sqrt(explosionDx * explosionDx + explosionDy * explosionDy)

                  if (explosionDistance <= EXPLOSIVE_BALL.explosionRadius) {
                    ballsToRemove.add(otherBall.id)
                  }
                }
              })
            } else {
              // Normal ball collision handling
              const { resolvedBall1, resolvedBall2, mergedBall, scoreIncrease, snotReward } = resolveCollision(
                ball1,
                ball2,
                nextBallId,
                gameInventory.Cap,
              )

              if (mergedBall) {
                updatedBalls = updatedBalls.filter((b) => b.id !== ball1.id && b.id !== ball2.id)
                updatedBalls.push(mergedBall)

                setPendingScoreIncrease((prev) => prev + scoreIncrease)
                setPendingSnotReward((prev) => prev + snotReward)
                setHighestMergedLevel((prevLevel) => Math.max(prevLevel, mergedBall.level))
              } else {
                // Prevent overlapping by adjusting positions
                const overlap = minDistance - distance
                const moveX = (overlap * dx) / distance / 2
                const moveY = (overlap * dy) / distance / 2

                resolvedBall1.x -= moveX
                resolvedBall1.y -= moveY
                resolvedBall2.x += moveX
                resolvedBall2.y += moveY

                // Add a small random force to prevent stacking
                const randomForce = 0.01 // Adjust this value as needed
                resolvedBall1.vx += (Math.random() - 0.5) * randomForce
                resolvedBall1.vy += (Math.random() - 0.5) * randomForce
                resolvedBall2.vx += (Math.random() - 0.5) * randomForce
                resolvedBall2.vy += (Math.random() - 0.5) * randomForce

                updatedBalls[i] = resolvedBall1
                updatedBalls[j] = resolvedBall2
              }
            }
          }
        }
      }

      // Remove exploded balls immediately
      updatedBalls = updatedBalls.filter((ball) => !ballsToRemove.has(ball.id))

      // Count balls in transparent zone
      const ballsInZone = updatedBalls.filter((ball) => ball.y - ball.radius <= TRANSPARENT_ZONE_HEIGHT).length
      setBallsInTransparentZone(ballsInZone)

      // Add new explosions
      setExplosions((prevExplosions) => [...prevExplosions, ...explosions])

      return updatedBalls
    })
  }, [isJoyActive, nextBallId, setHighestMergedLevel, gameInventory.Cap])

  useEffect(() => {
    if (pendingScoreIncrease > 0 || pendingSnotReward > 0) {
      setScore((prevScore) => prevScore + pendingScoreIncrease)
      gameDispatch({ type: "ADD_TO_INVENTORY", item: "snot", amount: pendingSnotReward })
      setPendingScoreIncrease(0)
      setPendingSnotReward(0)
    }
  }, [pendingScoreIncrease, pendingSnotReward, gameDispatch, gameInventory.snot])

  useEffect(() => {
    if (isJoyActive) {
      const timer = setTimeout(() => {
        setIsJoyActive(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [isJoyActive])

  const checkBallsInTransparentZone = useCallback(() => {
    const ballsInZone = thrownBalls.some((ball) => ball.y - ball.radius <= TRANSPARENT_ZONE_HEIGHT)

    if (ballsInZone) {
      // Timer logic removed
    }
    // deactivateTimer removed
  }, [thrownBalls])

  useEffect(() => {
    if (!isPaused) {
      checkBallsInTransparentZone()
    }
  }, [thrownBalls, isPaused, checkBallsInTransparentZone])

  const throwBall = useCallback((coinPosition: number, currentBallLevel: number, currentTime: number) => {
    const startX = coinPosition + 28

    let ballSize: number
    let isExplosive = false
    let isBull = false
    let level = currentBallLevel

    if (currentBallLevel === -1) {
      ballSize = BULL_BALL.size
      isBull = true
    } else if (currentBallLevel === -2) {
      ballSize = EXPLOSIVE_BALL.size
      isExplosive = true
      level = 1 // Set a default level for explosive balls
    } else {
      const currentBall = BALL_LEVELS[currentBallLevel - 1]
      ballSize = currentBall.size
    }

    const newBallId = nextBallId.current++
    const ball: Ball = {
      id: newBallId,
      x: startX,
      y: GAME_CONSTANTS.LAUNCHER_Y + 4,
      level: level,
      vx: 0,
      vy: isBull ? 5 : 0, // Bull ball moves downward
      radius: ballSize / 2,
      mass: GAME_CONSTANTS.UNIFORM_BALL_MASS,
      isExplosive: isExplosive,
      isBull: isBull,
      sleeping: false,
      throwTime: currentTime,
    }

    setThrownBalls((prev) => {
      const updatedBalls = [...prev, ball]
      return removeDuplicateBalls(updatedBalls)
    })
  }, [])

  const removeDuplicateBalls = (balls: Ball[]): Ball[] => {
    const uniqueBalls = new Map<number, Ball>()
    balls.forEach((ball) => {
      if (!uniqueBalls.has(ball.id)) {
        uniqueBalls.set(ball.id, ball)
      }
    })
    return Array.from(uniqueBalls.values())
  }

  const stopGameLoop = useCallback(() => {
    if (animationFrameId.current !== null) {
      cancelAnimationFrame(animationFrameId.current)
      animationFrameId.current = null
    }
  }, [])

  const resetGame = useCallback(() => {
    stopGameLoop()
    setThrownBalls([])
    setScore(0)
    setIsGameOver(false)
    setHighestMergedLevel(5) // Set the highest merged level to 5
    setIsJoyActive(false)
    setIsExplosiveBallActive(false)
    setExplosions([]) // Reset explosions on game reset
    setBallsInTransparentZone(0) // Reset balls in transparent zone
    setIsPaused(false) // Reset pause state
  }, [stopGameLoop])

  const gameLoop = useCallback(() => {
    updatePhysics()
    animationFrameId.current = requestAnimationFrame(gameLoop)
  }, [updatePhysics])

  const startGameLoop = useCallback(() => {
    if (animationFrameId.current === null) {
      gameLoop()
    }
  }, [gameLoop])

  const activateJoy = useCallback(() => {
    setIsJoyActive(true)
  }, [])

  const activateExplosiveBall = useCallback(() => {
    setIsExplosiveBallActive(true)
  }, [])

  const pauseGame = useCallback(() => {
    setIsPaused(true)
  }, [])

  const resumeGame = useCallback(() => {
    setIsPaused(false)
  }, [])

  return {
    thrownBalls,
    score,
    highestMergedLevel,
    handleGameOver,
    updatePhysics,
    throwBall,
    resetGame,
    startGameLoop,
    stopGameLoop,
    finalScore,
    isGameOver,
    isJoyActive,
    activateJoy,
    isExplosiveBallActive,
    activateExplosiveBall,
    explosions,
    setExplosions,
    ballsInTransparentZone,
    pauseGame,
    resumeGame,
  }
}

