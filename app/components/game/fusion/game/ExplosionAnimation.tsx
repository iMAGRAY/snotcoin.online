import React, { useMemo } from "react"
import { motion } from "framer-motion"

interface ExplosionAnimationProps {
  x: number
  y: number
  size: number
}

const ExplosionAnimation: React.FC<ExplosionAnimationProps> = ({ x, y, size }) => {
  const particleCount = 12

  const particles = useMemo(() => {
    const colors = ["#FFA500", "#FF4500", "#FF0000", "#FFD700"]
    return Array.from({ length: particleCount }).map((_, index) => {
      const angle = (Math.PI * 2 * index) / particleCount
      const distance = size / 4
      const offsetX = Math.cos(angle) * distance
      const offsetY = Math.sin(angle) * distance
      const color = colors[index % colors.length]

      return { offsetX, offsetY, color }
    })
  }, [size, particleCount])

  return (
    <motion.div
      className="absolute"
      style={{
        left: `${x - size / 2}px`,
        top: `${y - size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
      }}
      initial={{ opacity: 1, scale: 0 }}
      animate={{ opacity: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Shockwave effect */}
      <motion.div
        className="absolute inset-0 rounded-full bg-white"
        initial={{ scale: 0, opacity: 0.7 }}
        animate={{ scale: 1.5, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />

      {/* Core explosion */}
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-radial from-yellow-500 via-orange-500 to-red-500"
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 1, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />

      {/* Particles */}
      {particles.map((particle, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full"
          style={{
            left: `${size / 2}px`,
            top: `${size / 2}px`,
            width: `${size / 25}px`,
            height: `${size / 25}px`,
            backgroundColor: particle.color,
          }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{
            x: particle.offsetX,
            y: particle.offsetY,
            opacity: 0,
            scale: [1, 2, 0],
          }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      ))}

      {/* Light flash */}
      <motion.div
        className="absolute inset-0 rounded-full bg-white"
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
      />
    </motion.div>
  )
}

export default React.memo(ExplosionAnimation)

