'use client'

import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '../../../contexts/TranslationContext';
import Image from 'next/image';

interface FusionMenuProps {
  onStartGame: () => void;
  attemptsUsed: number;
  timeUntilNextGame: string;
}

const FusionMenu: React.FC<FusionMenuProps> = React.memo(({ onStartGame, attemptsUsed, timeUntilNextGame }) => {
  const { t } = useTranslation();

  return (
    <div className="h-full w-full relative overflow-hidden flex flex-col items-center justify-center bg-gray-900 pb-24">
      <motion.div 
        className="absolute inset-0 w-full h-full"
        animate={{
          x: [0, -10, 0],
          y: [0, -5, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "linear"
        }}
        style={{
          backgroundImage: "url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Back1-lvfTpdrhCvoYprU5YoYg9FJHNjXpSV.webp')",
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          opacity: 0.6,
        }}
      />

      <motion.div 
        className="absolute inset-0 w-full h-full"
        animate={{
          x: [0, 10, 0],
          y: [0, 5, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "linear"
        }}
        style={{
          backgroundImage: "url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Front1-NOYxwGoncrpEr7BsPJKkNHkRwU39YF.webp')",
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          opacity: 0.8,
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-20"
        >
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-center">
            {t('fusion')}
          </h1>
        </motion.div>
      </div>

      <motion.div
        className="absolute top-[10%] left-[10%] w-16 h-16 sm:w-20 sm:h-20"
        animate={{
          rotate: 360,
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-neeYJErOWGAzaaJdDtovrdm0YlupVX.webp"
          alt="Decorative microbe rotating clockwise"
          width={80}
          height={80}
        />
      </motion.div>

      <motion.div
        className="absolute bottom-[20%] right-[10%] w-20 h-20 sm:w-24 sm:h-24"
        animate={{
          rotate: -360,
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/3-NNIdHZndK9MgqCBTHzjdP2I6lamp7F.webp"
          alt="Decorative microbe rotating counter-clockwise"
          width={96}
          height={96}
        />
      </motion.div>

      <div className="absolute inset-x-0 bottom-0 z-10 pb-8 flex justify-center items-center">
        <motion.button
          onClick={attemptsUsed < 2 ? onStartGame : undefined}
          className={`h-auto py-3 sm:py-4 rounded-full relative ${
            attemptsUsed < 2
              ? 'w-3/4 mx-auto bg-gradient-to-b from-yellow-400 to-yellow-600 border-yellow-300 hover:from-yellow-500 hover:to-yellow-700'
              : 'w-auto px-8 bg-gradient-to-b from-gray-400 to-gray-600 border-gray-300'
          } text-white text-2xl sm:text-3xl font-bold flex items-center justify-center shadow-lg transition-all duration-300 overflow-hidden border-2`}
          whileHover={attemptsUsed < 2 ? { scale: 1.05 } : {}}
          whileTap={attemptsUsed < 2 ? { scale: 0.95 } : {}}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          aria-label={attemptsUsed >= 2 ? `Next game available in ${timeUntilNextGame}` : undefined}
        >
          {attemptsUsed < 2 ? (
            <div className="flex flex-col items-center justify-center">
              <span>{t('play')}</span>
              <span className="text-sm">{t('attemptsLeft')}: {2 - attemptsUsed}/2</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <span className="text-xl">{timeUntilNextGame}</span>
              <span className="text-sm">{t('attemptsLeft')}: 0/2</span>
            </div>
          )}
        </motion.button>
      </div>
    </div>
  );
});

FusionMenu.displayName = 'FusionMenu';

export default FusionMenu;

