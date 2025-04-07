"use client"

import React from "react"
import { motion } from "framer-motion"

interface ContainerFlyingNumberProps {
  value: number
  positionX: number
  positionY: number
}

const ContainerFlyingNumber: React.FC<ContainerFlyingNumberProps> = ({ value, positionX, positionY }) => {
  // Форматируем значение с 6 знаками после запятой
  const formattedValue = value.toFixed(6);

  return (
    <motion.div
      initial={{ opacity: 0, x: positionX, y: positionY, scale: 0.8 }}
      animate={{
        opacity: [0, 1, 0],
        y: [positionY, positionY - 80],
        scale: [0.8, 1.2, 1],
      }}
      transition={{
        duration: 1.2,
        ease: "easeOut",
        times: [0, 0.3, 1],
      }}
      className="absolute z-[60] pointer-events-none select-none"
      style={{ 
        left: 0, 
        top: 0, 
        transform: `translate(${positionX}px, ${positionY}px)`,
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none"
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <motion.span
        className="text-blue-400 font-bold text-lg whitespace-nowrap"
        style={{
          textShadow: `
            0 2px 4px rgba(0, 0, 0, 0.5),
            0 0 8px rgba(59, 130, 246, 0.7)
          `,
          userSelect: "none",
          WebkitUserSelect: "none",
          MozUserSelect: "none"
        }}
      >
        +{formattedValue}
      </motion.span>
    </motion.div>
  )
}

export default ContainerFlyingNumber 