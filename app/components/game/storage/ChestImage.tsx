import React, { useState, useEffect } from "react"
import Image from "next/image"
import { animated, useSpring } from "react-spring"
import { CHEST_IMAGES } from "../../../constants/storageConstants"

interface ChestImageProps {
  src: string
  alt: string
  isOpening: boolean
  chestIndex?: number
}

export const ChestImage: React.FC<ChestImageProps> = React.memo(({ src, alt, isOpening, chestIndex }) => {
  const [imageToShow, setImageToShow] = useState<string>(src)
  
  useEffect(() => {
    if (isOpening) {
      // Определяем какое изображение открытого сундука использовать на основе индекса
      if (chestIndex === 0) {
        // Сундук первого уровня
        setImageToShow(CHEST_IMAGES.LEVEL1_OPEN)
      } else if (chestIndex === 1) {
        // Сундук второго уровня
        setImageToShow(CHEST_IMAGES.LEVEL2_OPEN)
      } else if (chestIndex === 2) {
        // Сундук третьего уровня
        setImageToShow(CHEST_IMAGES.LEVEL3_OPEN)
      }
    } else {
      // В противном случае показываем оригинальное изображение
      setImageToShow(src)
    }
  }, [isOpening, chestIndex, src])

  const props = useSpring({
    scale: isOpening ? 1.2 : 1.1,
    rotate: isOpening ? 5 : 0,
    config: { tension: 300, friction: 10 },
  })

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
          src={imageToShow}
          alt={alt}
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

