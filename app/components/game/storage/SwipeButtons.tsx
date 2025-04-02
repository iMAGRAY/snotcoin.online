import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SwipeButtonsProps {
  activeIndex: number;
  totalItems: number;
  onPrev: () => void;
  onNext: () => void;
}

export const SwipeButtons: React.FC<SwipeButtonsProps> = ({ 
  activeIndex, 
  totalItems,
  onPrev, 
  onNext 
}) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-30">
      <div className="relative w-full h-full">
        <div className="pointer-events-auto">
          {/* Кнопка "назад" */}
          <motion.button
            onClick={onPrev}
            className="absolute top-2/3 -translate-y-1/2 left-2 w-12 h-16 flex items-center justify-center 
                      bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-full shadow-lg overflow-hidden 
                      border-2 border-yellow-300 focus:outline-none"
            whileHover={{
              boxShadow: "0 0 12px rgba(250, 204, 21, 0.7)",
            }}
            initial={false}
          >
            <motion.div
              className="w-full h-full flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <ChevronLeft className="w-8 h-8 text-white" />
            </motion.div>
          </motion.button>

          {/* Кнопка "вперед" */}
          <motion.button
            onClick={onNext}
            className="absolute top-2/3 -translate-y-1/2 right-2 w-12 h-16 flex items-center justify-center 
                      bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-full shadow-lg overflow-hidden 
                      border-2 border-yellow-300 focus:outline-none"
            whileHover={{
              boxShadow: "0 0 12px rgba(250, 204, 21, 0.7)",
            }}
            initial={false}
          >
            <motion.div
              className="w-full h-full flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <ChevronRight className="w-8 h-8 text-white" />
            </motion.div>
          </motion.button>
        </div>

        {/* Индикаторы положения */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-auto">
          <div className="flex gap-4">
            {Array.from({ length: totalItems }).map((_, index) => (
              <motion.div
                key={index}
                className={`w-3 h-3 rounded-full ${
                  index === activeIndex
                    ? "bg-yellow-400"
                    : "bg-gray-400 opacity-50"
                }`}
                whileHover={{ scale: 1.2 }}
                onClick={() => {
                  if (index < activeIndex) {
                    for (let i = 0; i < activeIndex - index; i++) {
                      onPrev();
                    }
                  } else if (index > activeIndex) {
                    for (let i = 0; i < index - activeIndex; i++) {
                      onNext();
                    }
                  }
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

SwipeButtons.displayName = 'SwipeButtons'; 