import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '../../../contexts/TranslationContext';

const Header: React.FC = () => {
  const { t } = useTranslation();

  return (
    <motion.div
      className="w-full h-12 bg-gray-800 bg-opacity-80 flex items-center justify-center z-30 relative"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h1 className="text-xl font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
        {t('fusionGame')}
      </h1>
    </motion.div>
  );
};

export default Header;

