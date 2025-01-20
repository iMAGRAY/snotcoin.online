import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '../../../contexts/TranslationContext';
import { formatSnotValue } from '../../../utils/gameUtils';

interface StatusBarProps {
  score: number;
  snot: number;
}

const StatusBar: React.FC<StatusBarProps> = ({ score, snot }) => {
  const { t } = useTranslation();

  return (
    <motion.div
      className="w-full h-[36px] grid grid-cols-3 items-center z-20 relative px-4 bg-transparent"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div /> {/* Empty div for left column */}
      <div className="justify-self-center text-white font-bold text-sm drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
        {t('score')}: {score}
      </div>
      <div className="justify-self-end text-white font-bold text-sm drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
        SNOT: {formatSnotValue(snot)}
      </div>
    </motion.div>
  );
};

export default StatusBar;

