'use client'

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface FirstVisitScreenProps {
  onComplete: () => void;
}

const FirstVisitScreen: React.FC<FirstVisitScreenProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isVisible) {
      onComplete();
    }
  }, [isVisible, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative w-full h-full">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/2-AcG5rGY5Pum3qkP9U5IaGJQQQEmsry.webp"
              alt="SnotCoin Welcome Screen"
              layout="fill"
              objectFit="cover"
              priority
              className="transition-opacity duration-300"
              style={{
                objectPosition: 'center',
                width: '100vw',
                height: '100vh',
              }}
              onLoadingComplete={(image) => {
                image.classList.remove('opacity-0');
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FirstVisitScreen;

