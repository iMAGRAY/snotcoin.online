import React from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import { BALL_LEVELS, EXPLOSIVE_BALL, BULL_BALL } from "../../../types/fusion-game"

interface BallProps {
  ball: {
    id: number
    x: number
    y: number
    radius: number
    level: number
    vx: number
    vy: number
    isExplosive?: boolean
    isBull?: boolean
  }
  scaleFactor: number
  isJoyActive: boolean
}

const Ball: React.FC<BallProps> = React.memo(({ ball, scaleFactor, isJoyActive }) => {
  let ballImage: string
  let ballSize: number

  if (ball.isBull) {
    ballImage = BULL_BALL.image
    ballSize = BULL_BALL.size
  } else if (ball.isExplosive) {
    ballImage = EXPLOSIVE_BALL.image
    ballSize = EXPLOSIVE_BALL.size
  } else {
    const ballLevel = BALL_LEVELS[ball.level - 1] || BALL_LEVELS[0]
    ballImage = ballLevel.image
    ballSize = ballLevel.size
  }

  // Check if the ball is moving
  const isMoving = Math.abs(ball.vx) > 0.1 || Math.abs(ball.vy) > 0.1

  return (
    <motion.div
      className="absolute z-20"
      style={{
        left: `${ball.x * scaleFactor - (ballSize * scaleFactor) / 2}px`,
        top: `${ball.y * scaleFactor - (ballSize * scaleFactor) / 2}px`,
        width: `${ballSize * scaleFactor}px`,
        height: `${ballSize * scaleFactor}px`,
      }}
      animate={
        isJoyActive && !ball.isBull && isMoving
          ? {
              x: [-2, 2, -2],
              rotate: [-5, 5, -5],
            }
          : {}
      }
      transition={
        isJoyActive && !ball.isBull && isMoving
          ? {
              duration: 0.3,
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "reverse",
              ease: "easeInOut",
            }
          : {}
      }
    >
      <Image
        src={ballImage || "/placeholder.svg"}
        alt={ball.isBull ? "Bull Ball" : ball.isExplosive ? "Explosive Ball" : `Ball Level ${ball.level}`}
        width={ballSize * scaleFactor}
        height={ballSize * scaleFactor}
        className="w-full h-full object-contain"
        priority
        draggable={false}
      />
    </motion.div>
  )
})

Ball.displayName = "Ball"

export default Ball

