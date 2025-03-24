"use client"

import type React from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { ICONS } from "../constants/uiConstants"

const SplashScreen: React.FC = () => {
  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative w-full h-full">
        <Image
          src={ICONS.COMMON.LOADING}
          alt="SnotCoin Splash Screen"
          layout="fill"
          objectFit="contain"
          priority
          loading="eager"
          className="transition-opacity duration-300"
          onLoadingComplete={(image) => {
            image.classList.remove("opacity-0")
          }}
        />
      </div>
    </motion.div>
  )
}

export default SplashScreen

