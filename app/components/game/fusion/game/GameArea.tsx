import React, { useCallback, useMemo, useEffect } from "react"
import Image from "next/image"
import { AnimatePresence } from "framer-motion"
import {
  GAME_CONSTANTS,
  EXPLOSIVE_BALL,
  BULL_BALL,
  type Ball,
  type BallLevel,
  BALL_LEVELS,
} from "../../../../types/fusion-game"
import GameWalls from "./GameWalls"
import BallComponent from "../Ball"
import ExplosionAnimation from "./ExplosionAnimation"
import Launcher from "./Launcher" // Added import for Launcher

interface GameAreaProps {
  gameAreaRef: React.RefObject<HTMLDivElement>
  scaleFactor: number
  handleMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void
  handleTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void
  throwBall: () => void
  coinPosition: number
  isThrowAnimation: boolean
  canThrow: boolean
  currentBall: BallLevel | null
  thrownBalls: Ball[]
  isPaused: boolean
  isJoyActive: boolean
  isExplosiveBallActive: boolean
  explosions: { x: number; y: number; size: number }[]
  setExplosions: React.Dispatch<React.SetStateAction<{ x: number; y: number; size: number }[]>>
  isBullActive: boolean
  ballsInActivationZone: boolean
  setBallsInActivationZone: React.Dispatch<React.SetStateAction<boolean>>
}

const TRANSPARENT_ZONE_HEIGHT = GAME_CONSTANTS.LAUNCHER_Y - 5

const GameArea: React.FC<GameAreaProps> = React.memo(
  ({
    gameAreaRef,
    scaleFactor,
    handleMouseMove,
    handleTouchMove,
    throwBall,
    coinPosition,
    isThrowAnimation,
    canThrow,
    currentBall,
    thrownBalls,
    isPaused,
    isJoyActive,
    isExplosiveBallActive,
    explosions,
    setExplosions,
    isBullActive,
    ballsInActivationZone,
    setBallsInActivationZone,
  }) => {
    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
      e.preventDefault()
    }, [])

    const gameAreaStyle = useMemo(
      () => ({
        touchAction: "none" as const,
        WebkitTouchCallout: "none" as const,
        WebkitUserSelect: "none" as const,
        KhtmlUserSelect: "none" as const,
        MozUserSelect: "none" as const,
        msUserSelect: "none" as const,
        userSelect: "none" as const,
        position: "absolute" as const,
        left: "50%",
        bottom: "0",
        transform: "translateX(-50%)",
        width: `${GAME_CONSTANTS.GAME_WIDTH}px`,
        height: `${GAME_CONSTANTS.GAME_HEIGHT + GAME_CONSTANTS.FOOTER_HEIGHT}px`,
        maxWidth: "100vw",
        maxHeight: `calc(100vh - ${GAME_CONSTANTS.HEADER_HEIGHT}px)`,
      }),
      [],
    )

    const coinStyle = useMemo(
      () => ({
        left: `${coinPosition * scaleFactor}px`,
        top: `${(GAME_CONSTANTS.LAUNCHER_Y - 50) * scaleFactor}px`,
        width: `${56 * scaleFactor}px`,
        height: `${56 * scaleFactor}px`,
      }),
      [coinPosition, scaleFactor],
    )

    const whiteLineStyle = useMemo(
      () => ({
        top: `${(GAME_CONSTANTS.LAUNCHER_Y + 6) * scaleFactor}px`,
        left: `${(coinPosition + 28) * scaleFactor}px`,
        width: "2px",
        height: `${(GAME_CONSTANTS.GAME_HEIGHT - GAME_CONSTANTS.LAUNCHER_Y - 6) * scaleFactor}px`,
        background: "linear-gradient(to bottom, white 50%, transparent 50%)",
        backgroundSize: "1px 20px",
        backgroundRepeat: "repeat-y",
      }),
      [coinPosition, scaleFactor],
    )

    const yellowDottedLineStyle = useMemo(
      () => ({
        top: `${(GAME_CONSTANTS.LAUNCHER_Y - 5) * scaleFactor}px`,
        left: 0,
        right: 0,
        height: "2px",
        background: "linear-gradient(to right, #FFD700 50%, transparent 50%)",
        backgroundSize: "10px 2px",
        backgroundRepeat: "repeat-x",
      }),
      [scaleFactor],
    )

    const currentBallStyle = useMemo(() => {
      const size = currentBall?.size ?? BALL_LEVELS[0].size

      return {
        left: `${(coinPosition + 28) * scaleFactor}px`,
        top: `${(GAME_CONSTANTS.LAUNCHER_Y - 8) * scaleFactor}px`,
        width: `${size * scaleFactor}px`,
        height: `${size * scaleFactor}px`,
        transform: "translate(-50%, -50%)",
      }
    }, [coinPosition, currentBall, scaleFactor])

    const checkBallsInTransparentZone = useCallback(() => {
      const ballsInZone = thrownBalls.some((ball) => ball.y - ball.radius <= TRANSPARENT_ZONE_HEIGHT)
      setBallsInActivationZone(ballsInZone)
    }, [thrownBalls, setBallsInActivationZone])

    useEffect(() => {
      if (!isPaused) {
        checkBallsInTransparentZone()
      }
    }, [isPaused, checkBallsInTransparentZone, thrownBalls])

    return (
      <div ref={gameAreaRef} className="relative z-10 overflow-hidden" style={gameAreaStyle}>
        {/* Visible zone (now transparent) */}
        <div
          className="absolute top-0 left-0 right-0 z-30"
          style={{
            height: `${TRANSPARENT_ZONE_HEIGHT * scaleFactor}px`,
            // Remove the background color and border
          }}
        />
        {/* Yellow dotted line */}
        <div className="absolute z-20 w-full" style={yellowDottedLineStyle} />
        <div
          className="absolute inset-0"
          onMouseMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          onTouchStart={handleTouchStart}
          onClick={throwBall}
        >
          <GameWalls scaleFactor={scaleFactor} />

          {/* Launcher Component */}
          <Launcher
            coinPosition={coinPosition}
            scaleFactor={scaleFactor}
            isThrowAnimation={isThrowAnimation}
            canThrow={canThrow}
            currentBallLevel={currentBall?.level} // Added optional chaining
          />

          {/* Coin */}
          <div className="absolute" style={coinStyle}>
            <Image
              src={
                isThrowAnimation
                  ? "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Coin%202-d8onIVlR3MlcVx3trPCOD5pTJL7K33.webp"
                  : "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Coin%201-nue6MldrXukYnteli43PCZZFjvU1pO.webp"
              }
              alt="Coin"
              width={56 * scaleFactor}
              height={56 * scaleFactor}
              className="w-full h-full object-contain pointer-events-none"
              priority
            />
          </div>

          {/* White dotted line from coin to bottom */}
          <div className="absolute z-20" style={whiteLineStyle} />

          {/* Current Ball */}
          {canThrow && (
            <div className="absolute z-30 pointer-events-none" style={currentBallStyle}>
              <Image
                src={
                  isBullActive
                    ? BULL_BALL.image
                    : isExplosiveBallActive
                      ? EXPLOSIVE_BALL.image
                      : currentBall && currentBall.image
                        ? currentBall.image
                        : BALL_LEVELS[0].image
                }
                alt={
                  isBullActive
                    ? "Bull Ball"
                    : isExplosiveBallActive
                      ? "Explosive Ball"
                      : currentBall && currentBall.level
                        ? `Level ${currentBall.level} Ball`
                        : "Default Ball"
                }
                width={Number.parseInt(currentBallStyle.width)}
                height={Number.parseInt(currentBallStyle.height)}
                className="w-full h-full object-contain"
                priority
              />
            </div>
          )}

          {/* Thrown Balls */}
          {!isPaused &&
            thrownBalls &&
            thrownBalls.map((ball) => (
              <BallComponent key={ball.id} ball={ball} scaleFactor={scaleFactor} isJoyActive={isJoyActive} />
            ))}

          {/* Explosion Animations */}
          <AnimatePresence>
            {explosions.map((explosion, index) => (
              <ExplosionAnimation
                key={index}
                x={explosion.x * scaleFactor}
                y={explosion.y * scaleFactor}
                size={explosion.size * scaleFactor}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    )
  },
)

GameArea.displayName = "GameArea"

export default GameArea

