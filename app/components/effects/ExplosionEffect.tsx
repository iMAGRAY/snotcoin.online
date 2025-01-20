import React from 'react';
import { motion } from 'framer-motion';

const ExplosionEffect: React.FC = () => {
  const particles = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {particles.map((i) => {
        const angle = (Math.PI * 2 * i) / particles.length;
        const x = Math.cos(angle) * 30;
        const y = Math.sin(angle) * 30;

        return (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-yellow-400 rounded-full"
            initial={{ opacity: 1, x: 0, y: 0, scale: 0 }}
            animate={{
              opacity: [1, 0],
              x: [0, x],
              y: [0, y],
              scale: [0, 1.5, 0],
            }}
            transition={{
              duration: 0.6,
              ease: "easeOut",
              times: [0, 0.7, 1],
            }}
            style={{ 
              boxShadow: '0 0 8px rgba(255,215,0,0.7)',
            }}
          />
        );
      })}
    </div>
  );
};

export default ExplosionEffect;

