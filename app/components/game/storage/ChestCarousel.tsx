"use client"

import React, { useState, RefObject, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChestImage } from "./ChestImage"
import { ICONS } from "../../../constants/uiConstants"

interface ChestCarouselProps {
  onSwipeComplete?: (index: number) => void;
  carouselRef?: RefObject<HTMLDivElement>;
  containerRef?: RefObject<HTMLDivElement>;
  isOpening: boolean;
  setActiveChestIndex: (index: number) => void;
  activeChestIndex: number;
}

const variants = {
  enter: (direction: number) => {
    return {
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    };
  },
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => {
    return {
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    };
  }
};

// Функция для циклического переключения между значениями
const wrap = (min: number, max: number, v: number) => {
  const rangeSize = max - min;
  return ((((v - min) % rangeSize) + rangeSize) % rangeSize) + min;
};

const chestImages = [
  ICONS.STORAGE.LEVELS.LEVEL1,
  ICONS.STORAGE.LEVELS.LEVEL2,
  ICONS.STORAGE.LEVELS.LEVEL3,
];

export const ChestCarousel: React.FC<ChestCarouselProps> = ({
  onSwipeComplete,
  carouselRef,
  containerRef,
  isOpening,
  setActiveChestIndex,
  activeChestIndex
}) => {
  const [[page, direction], setPage] = useState([0, 0]);
  const imageIndex = wrap(0, chestImages.length, page);
  
  // Синхронизация внешнего activeChestIndex с внутренним page
  useEffect(() => {
    if (imageIndex !== activeChestIndex) {
      // Определяем направление смены для анимации
      const newDirection = activeChestIndex > imageIndex ? 1 : -1;
      setPage([activeChestIndex, newDirection]);
    }
  }, [activeChestIndex, imageIndex]);

  const paginate = (newDirection: number) => {
    const newPage = page + newDirection;
    const newIndex = wrap(0, chestImages.length, newPage);
    setPage([newPage, newDirection]);
    setActiveChestIndex(newIndex);
    if (onSwipeComplete) {
      onSwipeComplete(newIndex);
    }
  };

  const handleSwipeLeft = () => paginate(1);
  const handleSwipeRight = () => paginate(-1);

  return (
    <div 
      className="fixed inset-0 overflow-hidden z-10"
      ref={containerRef}
      onTouchStart={(e) => {
        const touchStart = e.touches[0].clientX;
        const handleTouchEnd = (e: TouchEvent) => {
          const touchEnd = e.changedTouches[0].clientX;
          if (touchEnd < touchStart - 50) {
            handleSwipeLeft();
          } else if (touchEnd > touchStart + 50) {
            handleSwipeRight();
          }
          document.removeEventListener('touchend', handleTouchEnd);
        };
        document.addEventListener('touchend', handleTouchEnd);
      }}
      onMouseDown={(e) => {
        const mouseStart = e.clientX;
        const handleMouseUp = (e: MouseEvent) => {
          const mouseEnd = e.clientX;
          if (mouseEnd < mouseStart - 50) {
            handleSwipeLeft();
          } else if (mouseEnd > mouseStart + 50) {
            handleSwipeRight();
          }
          document.removeEventListener('mouseup', handleMouseUp);
        };
        document.addEventListener('mouseup', handleMouseUp);
      }}
    >
      <motion.div className="w-full h-full" ref={carouselRef}>
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={page}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            className="absolute inset-0 w-full h-full flex justify-center items-center"
          >
            <ChestImage 
              src={chestImages[imageIndex]} 
              alt={`Chest level ${imageIndex + 1}`}
              isOpening={isOpening} 
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

ChestCarousel.displayName = "ChestCarousel";

