'use client'

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

const SplashScreen: React.FC = () => {
  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative w-full h-full">
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/2-jdGFRrTDdfXFFiLdjaKZ0cFQUD3FqL.webp"
          alt="SnotCoin Splash Screen"
          layout="fill"
          objectFit="contain"
          priority
          loading="eager"
          className="transition-opacity duration-300"
          onLoadingComplete={(image) => {
            image.classList.remove('opacity-0');
          }}
        />
      </div>
    </motion.div>
  );
};

export default SplashScreen;

