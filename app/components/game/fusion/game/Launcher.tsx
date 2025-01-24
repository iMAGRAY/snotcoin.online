import React from "react"
import Image from "next/image"
import { GAME_CONSTANTS, BALL_LEVELS } from "../../../../types/fusion-game"

interface LauncherProps {
  coinPosition: number
  scaleFactor: number
  isThrowAnimation: boolean
  canThrow: boolean
  currentBallLevel: number
}

const Launcher: React.FC<LauncherProps> = React.memo(
  ({ coinPosition, scaleFactor, isThrowAnimation, canThrow, currentBallLevel }) => {
    const currentBall = BALL_LEVELS[currentBallLevel - 1]

    return (
      <>
        {/* Coin */}
        <div
          className="absolute"
          style={{
            left: `${coinPosition * scaleFactor}px`,
            top: `${(GAME_CONSTANTS.LAUNCHER_Y - 50) * scaleFactor}px`,
            width: `${56 * scaleFactor}px`,
            height: `${56 * scaleFactor}px`,
          }}
        >
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

        {/* Current Ball */}
        {canThrow && (
          <div
            className="absolute z-30 pointer-events-none"
            style={{
              left: `${(coinPosition + 28) * scaleFactor}px`,
              top: `${(GAME_CONSTANTS.LAUNCHER_Y - 8) * scaleFactor}px`,
              width: `${currentBall.size * scaleFactor}px`,
              height: `${currentBall.size * scaleFactor}px`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <Image
              src={currentBall.image || "/placeholder.svg"}
              alt={`Level ${currentBall.level} Ball`}
              width={currentBall.size * scaleFactor}
              height={currentBall.size * scaleFactor}
              className="w-full h-full object-contain"
              priority
            />
          </div>
        )}
      </>
    )
  },
)

Launcher.displayName = "Launcher"

export default Launcher

