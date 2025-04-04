"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion, PanInfo } from "framer-motion"
import { ChestImage } from "./ChestImage"
import { CHEST_IMAGES_ARRAY } from "../../../constants/storageConstants"

interface ChestCarouselProps {
  onChestSelect: (index: number) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  carouselRef?: React.RefObject<HTMLDivElement>;
  isOpening: boolean;
  setActiveChestIndex: React.Dispatch<React.SetStateAction<number>>;
  activeChestIndex: number;
  onSwipeComplete: (index: number) => void;
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

export const ChestCarousel: React.FC<ChestCarouselProps> = ({ 
  onChestSelect, 
  containerRef, 
  carouselRef, 
  isOpening, 
  setActiveChestIndex, 
  activeChestIndex, 
  onSwipeComplete 
}) => {
  const [[page, direction], setPage] = useState([0, 0]);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef<number | null>(null);
  
  // Используем переданный activeChestIndex вместо локального imageIndex
  const safeImageIndex = Math.abs(activeChestIndex % CHEST_IMAGES_ARRAY.length);

  useEffect(() => {
    onChestSelect(safeImageIndex);
  }, [safeImageIndex, onChestSelect]);

  const paginate = (newDirection: number) => {
    const newPage = page + newDirection;
    // Обеспечиваем цикличность (если достигли конца, переходим в начало и наоборот)
    const adjustedPage = ((newPage % CHEST_IMAGES_ARRAY.length) + CHEST_IMAGES_ARRAY.length) % CHEST_IMAGES_ARRAY.length;
    setPage([adjustedPage, newDirection]);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches.length > 0) {
      const touch = e.touches[0];
      if (touch) {
        startX.current = touch.clientX;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    
    const changedTouch = e.changedTouches?.[0];
    if (!changedTouch) return;
    
    const endX = changedTouch.clientX;
    const diff = startX.current - endX;

    if (Math.abs(diff) > 50) { // Пороговое значение для свайпа
      if (diff > 0) {
        handleSwipeLeft();
      } else {
        handleSwipeRight();
      }
    }
    startX.current = null;
  };

  const handleSwipeLeft = () => {
    paginate(1);
  };

  const handleSwipeRight = () => {
    paginate(-1);
  };

  // Гарантируем, что элемент массива всегда будет строкой
  const currentImageSrc: string = CHEST_IMAGES_ARRAY[safeImageIndex] || '';
  
  return (
    <div
      className="w-full h-full relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      ref={containerRef}
    >
      <motion.div
        className="w-full h-full flex items-center justify-center"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => {
          setIsDragging(false);
        }}
        ref={carouselRef}
      >
        <ChestImage
          src={currentImageSrc}
          alt={`Chest ${safeImageIndex + 1}`}
          isOpening={isOpening}
          chestIndex={safeImageIndex}
        />
      </motion.div>
    </div>
  );
};

ChestCarousel.displayName = "ChestCarousel";

