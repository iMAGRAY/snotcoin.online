import React, { useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { ChestImage } from './ChestImage';
import { Chest } from '../../types/storage';

interface ChestCarouselProps {
  currentIndex: number;
  direction: number;
  chests: Chest[];
  onSwipe: (direction: number) => void;
  isChestOpening: boolean;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
}

const ChestCarousel: React.FC<ChestCarouselProps> = React.memo(({
  currentIndex,
  direction,
  chests,
  onSwipe,
  isChestOpening,
  setCurrentIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const variants = useMemo(() => ({
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
    }),
  }), []);

  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    if (info.offset.x > threshold) {
      onSwipe(-1);
    } else if (info.offset.x < -threshold) {
      onSwipe(1);
    }
  }, [onSwipe]);

  const currentChest = chests[currentIndex];

  return (
    <div
      ref={containerRef}
      className="relative h-[calc(100vh-120px)] w-full overflow-hidden touch-none select-none flex items-center justify-center pb-16"
      style={{ touchAction: 'pan-y' }}
    >
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          className="absolute inset-0 flex flex-col items-center justify-center"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto px-4 mb-20 mt-[365px]">
            <ChestImage src={currentChest.image} alt={currentChest.name} isOpening={isChestOpening} />
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="absolute bottom-4 left-0 right-0 z-50">
        <div className="flex justify-center gap-6">
          {chests.map((_, index) => (
            <motion.button
              key={index}
              className={`w-16 h-8 flex items-center justify-center rounded-full overflow-hidden border-2 ${
                index === currentIndex
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 border-yellow-300 shadow-lg'
                  : 'bg-gradient-to-r from-gray-600 to-gray-700 border-gray-500'
              }`}
              whileHover={{ 
                scale: 1.05,
                boxShadow: '0 0 12px rgba(250, 204, 21, 0.7)',
              }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                onSwipe(index > currentIndex ? 1 : -1);
                setCurrentIndex(index);
              }}
            >
              <span className="text-white font-bold text-sm">
                {index + 1}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
      <div className="h-[200px]"></div>
    </div>
  );
});

ChestCarousel.displayName = 'ChestCarousel';

export default ChestCarousel;

