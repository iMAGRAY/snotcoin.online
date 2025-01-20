import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useTranslation } from '../../../contexts/TranslationContext';

interface CollectButtonProps {
  onCollect: () => void;
  containerSnot: number;
  className?: string;
}

const CollectButton: React.FC<CollectButtonProps> = ({ onCollect, containerSnot, className }) => {
  const { t } = useTranslation();
  const canCollect = containerSnot > 0;

  return (
    <motion.button 
      onClick={onCollect}
      disabled={!canCollect}
      className={`
        relative bg-gradient-to-r text-white font-bold py-4 rounded-xl shadow-lg overflow-hidden border-2 
        transition-all duration-300 w-full flex items-center justify-center
        ${canCollect 
          ? 'from-yellow-400 to-yellow-600 border-yellow-300 hover:from-yellow-500 hover:to-yellow-700' 
          : 'from-gray-400 to-gray-500 border-gray-400 opacity-50 cursor-not-allowed'}
        ${className}
      `}
      whileHover={canCollect ? { scale: 1.02 } : {}}
      whileTap={canCollect ? { scale: 0.98 } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
    >
      <span className="relative z-10 flex items-center justify-center tracking-wide text-lg" style={{ textShadow: '1px 1px 0 rgba(0,0,0,0.3)' }}>
        <Image 
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Claim-3Ctw9xE3JgbtUqIalf2y5jArm28PFi.webp"
          alt="Claim"
          width={32}
          height={32}
          className="w-8 h-8 mr-2"
        />
        {t('collect')}
      </span>
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
      {canCollect && (
        <div className="absolute inset-0 rounded-xl" style={{ boxShadow: '0 0 15px 5px rgba(255,215,0,0.5)' }} />
      )}
    </motion.button>
  );
};

export default React.memo(CollectButton);

