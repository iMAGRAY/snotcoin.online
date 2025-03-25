"use client"

import React, { useMemo } from "react"
import { motion } from "framer-motion"
import { formatSnotValue } from "../../../utils/formatters"
import type { FlyingNumberProps } from "../../../types/laboratory-types"

const FlyingNumber: React.FC<FlyingNumberProps> = React.memo(({ value }) => {
  const formattedValue = useMemo(() => formatSnotValue(value, 4), [value])

  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{
        opacity: [1, 1, 0],
        y: [0, "-10vh"],
        x: ["-50%", "-50%"],
        scale: [1, 1.2, 1],
      }}
      transition={{
        duration: 1.5,
        ease: "easeOut",
        times: [0, 0.7, 1],
      }}
      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[70] pointer-events-none select-none"
    >
      <motion.span
        className="text-[#bbeb25] font-bold text-2xl"
        style={{
          textShadow: `
            0 2px 4px rgba(0, 0, 0, 0.5),
            0 0 10px rgba(16, 185, 129, 0.5)
          `,
        }}
      >
        +{formattedValue}
      </motion.span>
    </motion.div>
  )
})

FlyingNumber.displayName = "FlyingNumber"

export default FlyingNumber

