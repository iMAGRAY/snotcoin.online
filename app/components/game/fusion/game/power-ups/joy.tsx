import type React from "react"
import Image from "next/image"
import { motion } from "framer-motion"

interface JoyProps {
  onClick: () => void
}

const Joy: React.FC<JoyProps> = ({ onClick }) => {
  return (
    <motion.button
      onClick={onClick}
      className="w-12 h-12 rounded-full overflow-hidden shadow-md bg-gray-800/50"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Joy"
    >
      <div className="relative w-full h-full">
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/joy-OWpAzEIVzAHXU2321a9iKQq7uzZf7Q.webp"
          alt="Joy"
          fill
          className="object-contain"
        />
      </div>
    </motion.button>
  )
}

export default Joy

