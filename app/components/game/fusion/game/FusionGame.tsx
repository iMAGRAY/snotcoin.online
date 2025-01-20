"use client"

import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from "react"
import { AnimatePresence } from "framer-motion"
import { useGameState, useGameDispatch, useInventory } from "../../../../contexts/GameContext"
import { useTranslation } from "../../../../contexts/TranslationContext"
import { useRouter } from "next/navigation"
import Header from "./Header"
import GameArea from "./GameArea"
import PauseMenu from "./PauseMenu"
import GameOverMenu from "./GameOverMenu"
import Footer from "./Footer"
import GameBackground from "./GameBackground"
import { GAME_CONSTANTS, BALL_LEVELS, EXPLOSIVE_BALL, BULL_BALL } from "../../../../types/fusion-game"
import { getRandomBallLevel } from "../../../../utils/fusion-game-utils"
import { useFusionGame } from "../../../../hooks/useFusionGame"
import ExplosiveBall from "./power-ups/explosive-ball"
import Joy from "./power-ups/joy"
import Bull from "./power-ups/bull"

const FusionGame: React.FC = () => {
  const gameState = useGameState()
  const gameDispatch = useGameDispatch()
  const { getInventoryItemCount } = useInventory()
  const { t } = useTranslation()
  const router = useRouter()

  const {
    thrownBalls,
    score,
    handleGameOver: handleGameOverFromHook,
    throwBall,
    resetGame,
    startGameLoop,
    stopGameLoop,
    isGameOver: isGameOverFromHook,
    isJoyActive,
    activateJoy,
    explosions,
    setExplosions,
  } = useFusionGame()

  // State hooks
  const [coinPosition, setCoinPosition] = useState<number>(0)
  const [currentBallLevel, setCurrentBallLevel] = useState<number>(1)
  const [isClient, setIsClient] = useState<boolean>(false)
  const [canThrow, setCanThrow] = useState<boolean>(true)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false)
  const [scaleFactor, setScaleFactor] = useState<number>(1)
  const [isThrowAnimation, setIsThrowAnimation] = useState<boolean>(false)
  const [initialSnot, setInitialSnot] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [isBullActive, setIsBullActive] = useState<boolean>(false)
  const [ballsInActivationZone, setBallsInActivationZone] = useState<boolean>(false)
  const [isGameOver, setIsGameOver] = useState<boolean>(false)
  const [finalScore, setFinalScore] = useState<number>(0)
  const [isExplosiveBallActive, setIsExplosiveBallActive] = useState<boolean>(false)
  const [gameOverTimer, setGameOverTimer] = useState<NodeJS.Timeout | null>(null)

  // Ref hooks
  const gameAreaRef = useRef<HTMLDivElement>(null)

  // Memo hooks
  const currentSnot = useMemo(() => {
    return gameState.inventory ? getInventoryItemCount("snot") : 0
  }, [gameState.inventory, getInventoryItemCount])

  const calculateEarnedSnot = useMemo(() => {
    return getInventoryItemCount("snot") - initialSnot
  }, [getInventoryItemCount, initialSnot])

  const currentBall = useMemo(() => {
    if (isBullActive) {
      return BULL_BALL
    } else if (isExplosiveBallActive) {
      return EXPLOSIVE_BALL
    } else {
      return BALL_LEVELS[currentBallLevel - 1] || BALL_LEVELS[0]
    }
  }, [isBullActive, isExplosiveBallActive, currentBallLevel])

  // Callback hooks
  const handleGameOver = useCallback(() => {
    setIsGameOver(true)
    setFinalScore(score)
    gameDispatch({ type: "INCREMENT_FUSION_GAMES_PLAYED" })
  }, [score, gameDispatch])

  const handleHome = useCallback(() => {
    resetGame()
    gameDispatch({ type: "RESET_FUSION_GAME" })
    gameDispatch({ type: "SET_ACTIVE_TAB", payload: "fusion" })
    router.push("/")
  }, [resetGame, gameDispatch, router])

  const handleRestart = useCallback(() => {
    if (gameState.fusionAttemptsUsed < 2) {
      resetGame()
      setInitialSnot(getInventoryItemCount("snot"))
      setIsGameOver(false)
      setFinalScore(0)
      startGameLoop()
      setIsPaused(false)
      setIsGameStarted(true)
      if (gameOverTimer !== null) {
        clearTimeout(gameOverTimer)
        setGameOverTimer(null)
      }
      gameDispatch({ type: "USE_FUSION_ATTEMPT" })
    } else {
      handleHome()
    }
  }, [
    resetGame,
    getInventoryItemCount,
    startGameLoop,
    gameOverTimer,
    gameState.fusionAttemptsUsed,
    gameDispatch,
    handleHome,
  ])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isPaused) return
      const gameArea = gameAreaRef.current?.getBoundingClientRect()
      if (!gameArea) return

      const relativeX = (e.clientX - gameArea.left) / scaleFactor
      const coinWidth = 56
      const minCoinPosition = GAME_CONSTANTS.WALL_WIDTH
      const maxCoinPosition = GAME_CONSTANTS.GAME_WIDTH - GAME_CONSTANTS.WALL_WIDTH - coinWidth

      setCoinPosition(Math.max(minCoinPosition, Math.min(relativeX - coinWidth / 2, maxCoinPosition)))
    },
    [isPaused, scaleFactor],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (isPaused) return
      e.preventDefault()
      const gameArea = gameAreaRef.current?.getBoundingClientRect()
      if (!gameArea) return

      const touch = e.touches[0]
      const relativeX = (touch.clientX - gameArea.left) / scaleFactor
      const coinWidth = 56
      const minCoinPosition = GAME_CONSTANTS.WALL_WIDTH
      const maxCoinPosition = GAME_CONSTANTS.GAME_WIDTH - GAME_CONSTANTS.WALL_WIDTH - coinWidth

      setCoinPosition(Math.max(minCoinPosition, Math.min(relativeX - coinWidth / 2, maxCoinPosition)))
    },
    [isPaused, scaleFactor],
  )

  const handleThrowBall = useCallback(() => {
    if (isPaused || !canThrow || !gameAreaRef.current || isGameOverFromHook) return

    if (!isGameStarted) {
      setIsGameStarted(true)
      gameDispatch({ type: "START_FUSION_GAME" })
    }

    setIsThrowAnimation(true)
    setTimeout(() => {
      setIsThrowAnimation(false)
    }, 500)

    if (isBullActive) {
      throwBall(coinPosition, -1, Date.now())
      setIsBullActive(false)
    } else if (isExplosiveBallActive) {
      throwBall(coinPosition, -2, Date.now())
      setIsExplosiveBallActive(false)
    } else {
      throwBall(coinPosition, currentBallLevel, Date.now())
    }
    setCanThrow(false)

    setTimeout(() => {
      setCanThrow(true)
      setCurrentBallLevel(getRandomBallLevel())
    }, 500)
  }, [
    isPaused,
    canThrow,
    coinPosition,
    isGameStarted,
    isGameOverFromHook,
    throwBall,
    isBullActive,
    isExplosiveBallActive,
    currentBallLevel,
    gameDispatch,
  ])

  const togglePause = useCallback(() => {
    if (!isGameOverFromHook) {
      setIsPaused((prev) => {
        if (!prev) {
          stopGameLoop()
        } else {
          startGameLoop()
        }
        return !prev
      })
    }
  }, [isGameOverFromHook, stopGameLoop, startGameLoop])

  const handleExplosiveBallClick = useCallback(() => {
    setIsExplosiveBallActive(true)
  }, [])

  const handleJoyClick = useCallback(() => {
    activateJoy()
  }, [activateJoy])

  const handleBullClick = useCallback(() => {
    setIsBullActive(true)
    setCurrentBallLevel(-1)
    setCanThrow(true)
    const timer = setTimeout(() => {
      setIsBullActive(false)
      setCurrentBallLevel(getRandomBallLevel())
    }, 5000)
    return () => clearTimeout(timer)
  }, [])

  // Effect hooks
  useLayoutEffect(() => {
    const calculateGameSize = () => {
      if (gameAreaRef.current) {
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight - GAME_CONSTANTS.HEADER_HEIGHT
        const targetAspectRatio =
          GAME_CONSTANTS.GAME_WIDTH / (GAME_CONSTANTS.GAME_HEIGHT + GAME_CONSTANTS.FOOTER_HEIGHT)

        let gameWidth, gameHeight, scale

        if (viewportWidth / viewportHeight > targetAspectRatio) {
          gameHeight = viewportHeight
          gameWidth = viewportHeight * targetAspectRatio
          scale = gameHeight / (GAME_CONSTANTS.GAME_HEIGHT + GAME_CONSTANTS.FOOTER_HEIGHT)
        } else {
          gameWidth = viewportWidth
          gameHeight = viewportWidth / targetAspectRatio
          scale = gameWidth / GAME_CONSTANTS.GAME_WIDTH
        }

        setScaleFactor(scale)

        gameAreaRef.current.style.width = `${gameWidth}px`
        gameAreaRef.current.style.height = `${gameHeight}px`
      }
    }

    calculateGameSize()

    const initialTimer = setTimeout(calculateGameSize, 100)

    window.addEventListener("resize", calculateGameSize)

    return () => {
      window.removeEventListener("resize", calculateGameSize)
      clearTimeout(initialTimer)
    }
  }, [])

  useEffect(() => {
    setIsClient(true)
    if (gameState.fusionGameActive) {
      setIsGameStarted(true)
      startGameLoop()
    } else {
      setIsGameStarted(false)
      stopGameLoop()
    }
    try {
      const initialSnotCount = getInventoryItemCount("snot")
      setInitialSnot(initialSnotCount)
    } catch (err) {
      console.error("Error initializing game:", err)
      setError("Failed to initialize game. Please try again.")
    }
  }, [gameState.fusionGameActive, getInventoryItemCount, startGameLoop, stopGameLoop])

  useEffect(() => {
    if (gameState.fusionAttemptsUsed >= 2 && !isGameStarted) {
      handleHome()
    }
  }, [gameState.fusionAttemptsUsed, handleHome, isGameStarted])

  useEffect(() => {
    if (ballsInActivationZone) {
      if (gameOverTimer === null) {
        const timer = setTimeout(() => {
          handleGameOver()
        }, 2000)
        setGameOverTimer(timer)
      }
    } else {
      if (gameOverTimer !== null) {
        clearTimeout(gameOverTimer)
        setGameOverTimer(null)
      }
    }
  }, [ballsInActivationZone, handleGameOver, gameOverTimer])

  useEffect(() => {
    if (!isPaused && isGameStarted && !isGameOverFromHook) {
      startGameLoop()
    }

    return () => {
      stopGameLoop()
      if (gameOverTimer !== null) {
        clearTimeout(gameOverTimer)
      }
    }
  }, [isPaused, isGameStarted, isGameOverFromHook, startGameLoop, stopGameLoop, gameOverTimer])

  useEffect(() => {
    if (isGameOverFromHook || isGameOver) {
      handleGameOver()
    }
  }, [isGameOverFromHook, isGameOver, handleGameOver])

  useEffect(() => {
    setCurrentBallLevel(getRandomBallLevel())
  }, [])

  useEffect(() => {
    if (isGameStarted && !gameState.fusionGameStarted) {
      gameDispatch({ type: "USE_FUSION_ATTEMPT" })
    }
  }, [isGameStarted, gameState.fusionGameStarted, gameDispatch])

  useEffect(() => {
    return () => {
      gameDispatch({ type: "RESET_FUSION_GAME" })
      gameDispatch({ type: "SET_ACTIVE_TAB", payload: "fusion" })
      gameDispatch({ type: "SET_FUSION_GAME_ACTIVE", payload: false })
    }
  }, [gameDispatch])

  if (!isClient) return null

  if (error) {
    return <div className="text-red-500">{error}</div>
  }

  return (
    <div className="fixed inset-0 flex items-end justify-center bg-black overflow-hidden">
      <GameBackground imageUrl="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/BackGround-RJZVEJFmxj7dmXfppAMKJPDAAugPdU.webp" />
      <Header
        score={score}
        snot={gameState.inventory?.snot || 0}
        isPaused={isPaused}
        isGameOver={isGameOverFromHook}
        togglePause={togglePause}
      />

      <GameArea
        gameAreaRef={gameAreaRef}
        scaleFactor={scaleFactor}
        handleMouseMove={handleMouseMove}
        handleTouchMove={handleTouchMove}
        throwBall={handleThrowBall}
        coinPosition={coinPosition}
        isThrowAnimation={isThrowAnimation}
        canThrow={canThrow}
        currentBall={currentBall}
        thrownBalls={thrownBalls}
        isPaused={isPaused}
        isJoyActive={isJoyActive}
        isExplosiveBallActive={isExplosiveBallActive}
        explosions={explosions}
        setExplosions={setExplosions}
        isBullActive={isBullActive}
        ballsInActivationZone={ballsInActivationZone}
        setBallsInActivationZone={setBallsInActivationZone}
      />

      <AnimatePresence>
        {isPaused && !isGameOverFromHook && (
          <PauseMenu
            togglePause={togglePause}
            handleRestart={handleRestart}
            handleHome={handleHome}
            gamesAvailable={2 - gameState.fusionAttemptsUsed}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(isGameOverFromHook || isGameOver) && (
          <GameOverMenu
            finalScore={finalScore}
            earnedSnot={calculateEarnedSnot}
            handleRestart={handleRestart}
            handleHome={handleHome}
            gamesAvailable={2 - gameState.fusionAttemptsUsed}
          />
        )}
      </AnimatePresence>

      <Footer scaleFactor={scaleFactor} currentSnot={currentSnot} />
      <div className="absolute bottom-4 left-0 right-0 z-50 px-4 flex justify-between items-center max-w-xs mx-auto">
        <ExplosiveBall onClick={handleExplosiveBallClick} />
        <Bull onClick={handleBullClick} />
        <Joy onClick={handleJoyClick} />
      </div>
    </div>
  )
}

export default React.memo(FusionGame)

