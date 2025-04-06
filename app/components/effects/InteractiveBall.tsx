"use client"

import React from "react"
import Image from "next/image"

interface InteractiveBallProps {
  width?: number
  height?: number
  className?: string
  disableControls?: boolean
}

/**
 * Компонент, отображающий шар перед монетой
 */
const InteractiveBall: React.FC<InteractiveBallProps> = ({ 
  width = 40, 
  height = 40,
  className = ""
}) => {
  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {/* Монета (задний план) */}
      <div className="absolute inset-0">
        <Image
          src="/images/common/coins/coin.webp"
          alt="Coin"
          width={width}
          height={height}
          priority
          unoptimized
          className="block max-w-full max-h-full object-contain"
        />
      </div>
      
      {/* Шар (передний план) */}
      <div className="absolute inset-0" style={{ transform: "translate(-20%, -20%)" }}>
        <Image
          src="/images/merge/Balls/1.webp"
          alt="Ball 1"
          width={width * 0.9}
          height={height * 0.9}
          priority
          unoptimized
          className="block max-w-full max-h-full object-contain"
        />
      </div>
    </div>
  )
}

export default InteractiveBall 