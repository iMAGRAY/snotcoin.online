import React from "react"
import Image from "next/image"
import { animated, useSpring } from "react-spring"

interface ChestImageProps {
  src: string
  alt: string
  isOpening: boolean
}

export const ChestImage: React.FC<ChestImageProps> = React.memo(({ src, alt, isOpening }) => {
  const props = useSpring({
    scale: isOpening ? 1.1 : 1,
    rotate: isOpening ? 5 : 0,
    config: { tension: 300, friction: 10 },
  })

  return (
    <animated.div className="relative w-64 h-64 mb-8" style={props}>
      <Image
        src={src || "/placeholder.svg"}
        alt={alt}
        layout="fill"
        objectFit="contain"
        className="drop-shadow-2xl"
        draggable={false}
        loading="eager"
        priority
      />
    </animated.div>
  )
})

ChestImage.displayName = "ChestImage"

