import React from 'react'
import { motion } from 'framer-motion'
import { formatSnotValue } from '../../../utils/gameUtils'

const FlyingNumber: React.FC<{ value: number }> = React.memo(({ value }) => (
  <motion.div
    initial={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
    animate={{ opacity: 0, y: -70, scale: 1.2, filter: 'blur(2px)' }}
    exit={{ opacity: 0 }}
    transition={{ duration: 1.2, ease: "easeOut" }}
    className="absolute top-[45%] left-[45%] transform -translate-x-1/2 -translate-y-1/2 z-[70] pointer-events-none select-none"
  >
    <span 
      className="text-green-400 font-bold text-4xl drop-shadow-lg"
      style={{
        textShadow: '0 0 15px rgba(34, 197, 94, 0.7), 0 0 30px rgba(34, 197, 94, 0.5)',
        WebkitTextStroke: '2px black'
      }}
    >
      +{formatSnotValue(value)}
    </span>
  </motion.div>
))

FlyingNumber.displayName = 'FlyingNumber'

export default FlyingNumber

