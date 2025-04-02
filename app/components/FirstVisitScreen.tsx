"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { ICONS } from "../constants/uiConstants"

interface FirstVisitScreenProps {
  onComplete: () => void
}

const FirstVisitScreen: React.FC<FirstVisitScreenProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!isVisible) {
      onComplete()
    }
  }, [isVisible, onComplete])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative w-64 h-64 mb-4 mx-auto">
            <Image
              src={ICONS.COMMON.FIRST_VISIT}
              alt="Welcome"
              fill
              sizes="(max-width: 768px) 100vw, 16rem"
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default FirstVisitScreen

