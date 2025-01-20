import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useTranslation } from '../../../contexts/TranslationContext';
import { useRouter } from 'next/navigation';

interface UpgradeButtonProps {
  className?: string;
}

const UpgradeButton: React.FC<UpgradeButtonProps> = ({ className }) => {
  const { t } = useTranslation();
  const router = useRouter();

  const handleUpgradeClick = () => {
    router.push('/upgrade');
  };

  return (
    <motion.button 
      onClick={handleUpgradeClick}
      className={`
        relative bg-gradient-to-r from-green-400 to-green-600 text-white font-bold p-2 rounded-xl 
        shadow-lg overflow-hidden border-2 border-green-300 hover:from-green-500 hover:to-green-700 
        transition-all duration-300 flex items-center justify-center
        w-14 h-full 
        ${className}
      `}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
    >
      <span className="relative z-10 flex items-center justify-center">
        <Image 
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Upgrades-tJUxwEwDZDwL1g970CNm6sZmUwYMui.webp"
          alt={t('upgrade')}
          width={40}
          height={40}
          className="w-4/5 h-4/5 object-contain" 
        />
      </span>
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
      <div className="absolute inset-0 rounded-xl" style={{ boxShadow: '0 0 15px 5px rgba(34,197,94,0.5)' }} />
    </motion.button>
  );
};

export default React.memo(UpgradeButton);

