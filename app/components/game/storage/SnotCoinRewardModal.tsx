import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { ICONS } from '@/app/constants/uiConstants';

interface SnotCoinRewardModalProps {
  amount: number;
}

export const SnotCoinRewardModal: React.FC<SnotCoinRewardModalProps> = ({ amount }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="bg-gradient-to-b from-gray-800 to-gray-900 p-8 rounded-2xl border-4 border-yellow-400 shadow-2xl max-w-xs w-full text-center"
            initial={{ scale: 0.8, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 50, opacity: 0 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <motion.div 
              className="mx-auto relative w-24 h-24 mb-4"
              animate={{ 
                rotate: [0, 10, -10, 10, 0],
                scale: [1, 1.1, 1, 1.1, 1]
              }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Image
                src={ICONS.COMMON.COINS.COIN}
                alt="SnotCoin"
                fill
                style={{ objectFit: 'contain' }}
              />
            </motion.div>
            
            <h2 className="text-2xl font-bold text-white mb-2">Награда!</h2>
            
            <motion.div 
              className="text-4xl font-extrabold text-yellow-400 mb-4"
              initial={{ scale: 0.5 }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              +{amount}
            </motion.div>
            
            <motion.p 
              className="text-gray-300 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              SnotCoin успешно добавлены в ваш баланс
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

SnotCoinRewardModal.displayName = 'SnotCoinRewardModal'; 