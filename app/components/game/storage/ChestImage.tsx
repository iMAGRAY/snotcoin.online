import React from "react"
import Image from "next/image"
import { animated, useSpring } from "react-spring"

interface ChestImageProps {
  src: string
  alt: string
  isOpening: boolean
  chestIndex?: number
}

export const ChestImage: React.FC<ChestImageProps> = React.memo(({ src, alt, isOpening, chestIndex }) => {
  const props = useSpring({
    scale: isOpening ? 1.2 : 1.1,
    rotate: isOpening ? 5 : 0,
    config: { tension: 300, friction: 10 },
  })

  const imageUrl = src || "/placeholder.svg"

  return (
    <animated.div 
      className="fixed inset-0 flex items-center justify-center z-5" 
      style={{
        ...props,
        pointerEvents: "none"
      }}
    >
      <div className="w-full h-full relative">
        <Image 
          src={imageUrl}
          alt={alt || "Chest"}
          fill
          sizes="100vw"
          style={{ 
            objectFit: "contain",
            objectPosition: "center"
          }}
          className="drop-shadow-2xl"
          draggable={false}
          loading="eager"
          priority
        />
      </div>
    </animated.div>
  )
})

ChestImage.displayName = "ChestImage"

