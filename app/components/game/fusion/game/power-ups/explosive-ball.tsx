import type React from "react"
import Image from "next/image"
import { motion } from "framer-motion"

interface ExplosiveBallProps {
  onClick: () => void
}

const ExplosiveBall: React.FC<ExplosiveBallProps> = ({ onClick }) => {
  return (
    <motion.button
      onClick={onClick}
      className="w-12 h-12 rounded-full overflow-hidden shadow-md bg-gray-800/50"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Explosive Ball"
    >
      <div className="relative w-full h-full">
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Explosive%20Ball-sjrLf6zoy5XPpVdvL9FXTIe01cN2Hn.webp"
          alt="Explosive Ball"
          fill
          className="object-contain"
        />
      </div>
    </motion.button>
  )
}

export default ExplosiveBall

