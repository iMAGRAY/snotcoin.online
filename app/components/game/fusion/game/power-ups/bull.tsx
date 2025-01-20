import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface BullProps {
  onClick: () => void;
}

const Bull: React.FC<BullProps> = ({ onClick }) => {
  return (
    <motion.button
      onClick={onClick}
      className="w-12 h-12 rounded-full overflow-hidden shadow-md bg-gray-800/50"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Bull Power-up"
    >
      <div className="relative w-full h-full">
        <Image 
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Bull-o3IGleDJ5srQlgx6uBygThiBrxkBTO.webp"
          alt="Bull Power-up" 
          fill
          className="object-contain"
        />
      </div>
    </motion.button>
  );
};

export default Bull;

