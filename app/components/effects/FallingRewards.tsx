"use client"

import React, { useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence, useAnimation } from "framer-motion"
import Image from "next/image"
import { ICONS } from "../../constants/uiConstants"

interface Reward {
  id: number
  x: number
  y: number
  rotation: number
  scale: number
  delay: number
  duration: number
}

interface FallingRewardsProps {
  amount: number
  onComplete?: () => void
  uniqueId: number
  rewardColor: string
}

const CoinImage = React.memo(() => (
  <Image
    src={ICONS.COMMON.COINS.COIN_PNG}
    alt="Coin"
    width={40}
    height={40}
    className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(255,215,0,0.7)]"
  />
))

CoinImage.displayName = "CoinImage"

const FallingReward = React.memo(
  ({ reward, uniqueId, rewardColor }: { reward: Reward; uniqueId: number; rewardColor: string }) => {
    const controls = useAnimation()

    useEffect(() => {
      controls.start({
        opacity: [0, 1, 1, 0],
        x: [`${reward.x}vw`, `${reward.x * 1.3}vw`],
        y: ["-60vh", `${reward.y}vh`],
        rotate: [0, reward.rotation],
        scale: [0, reward.scale, reward.scale, 0],
        transition: {
          duration: reward.duration,
          ease: "easeOut",
          times: [0, 0.2, 0.8, 1],
          delay: reward.delay,
        },
      })
    }, [controls, reward])

    return (
      <motion.div
        key={`${uniqueId}-${reward.id}`}
        initial={{
          opacity: 0,
          x: `${reward.x}vw`,
          y: "-60vh",
          scale: 0,
        }}
        animate={controls}
        style={{
          position: "absolute",
          width: "40px",
          height: "40px",
        }}
        className={rewardColor}
      >
        <CoinImage />
      </motion.div>
    )
  },
)

FallingReward.displayName = "FallingReward"

const FallingRewards: React.FC<FallingRewardsProps> = React.memo(({ amount, onComplete, uniqueId, rewardColor }) => {
  const rewards = useMemo(() => {
    const numberOfRewards = Math.min(Math.max(Math.floor(amount / 3), 30), 200)
    return Array.from({ length: numberOfRewards }, (_, i) => ({
      id: i,
      x: Math.random() * 120 - 60,
      y: Math.random() * 120 + 60,
      rotation: Math.random() * 1080 - 540,
      scale: 0.4 + Math.random() * 0.6,
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 1.5,
    }))
  }, [amount])

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.()
    }, 3500)

    return () => clearTimeout(timer)
  }, [onComplete])

  const renderReward = useCallback(
    (reward: Reward) => <FallingReward key={reward.id} reward={reward} uniqueId={uniqueId} rewardColor={rewardColor} />,
    [uniqueId, rewardColor],
  )

  return <AnimatePresence>{rewards.map(renderReward)}</AnimatePresence>
})

FallingRewards.displayName = "FallingRewards"

export default FallingRewards

