"use client"

import type React from "react"
import Image from "next/image"
import { MotionDiv } from "./motion/MotionWrapper"
import { ICONS } from "../constants/uiConstants"

interface LoadingScreenProps {
  progress?: number
  error?: Error | null
  statusMessage?: string
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress = 0, error = null, statusMessage = "Loading..." }) => {
  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center z-50 bg-red-900 text-white p-4">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-center">{error.message}</p>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-end z-[9999] overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src={ICONS.COMMON.LOADING}
          alt="Snot Coin Loading Screen"
          fill
          style={{ objectFit: "cover" }}
          priority
        />
      </div>
      <div className="relative w-full max-w-md mx-auto mb-8 px-4 z-10">
        <div className="h-4 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
          <MotionDiv
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
            style={{
              boxShadow: "0 0 20px rgba(0,255,0,0.5)",
            }}
          />
        </div>
        <MotionDiv
          className="absolute -top-8 left-0 w-full flex justify-center"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        >
          <span className="px-4 py-1 bg-black/40 rounded-full text-emerald-400 text-sm font-bold backdrop-blur-sm border border-emerald-500/20">
            {statusMessage} {Math.round(progress)}%
          </span>
        </MotionDiv>
      </div>
    </div>
  )
}

export default LoadingScreen

