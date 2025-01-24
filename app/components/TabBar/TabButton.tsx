import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useTranslation } from '../../contexts/TranslationContext';
import { TabButtonProps } from './types';

const TabButton: React.FC<TabButtonProps> = ({ id, icon, label, isActive, onClick }) => {
  const { t } = useTranslation();

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'relative h-full flex flex-col items-center justify-between overflow-visible transition-all duration-300 isolate pointer-events-auto',
        isActive
          ? 'w-[28%] before:absolute before:inset-0 before:bg-gradient-to-t before:from-[#3a5c82] before:via-[#4a7a9e] before:to-[#5889ae] before:z-10 before:shadow-[inset_0_1px_3px_rgba(255,255,255,0.3),0_-2px_4px_rgba(0,0,0,0.1)]'
          : 'w-[24%] bg-transparent'
      )}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      aria-label={t(label)}
      aria-selected={isActive}
      role="tab"
    >
      <motion.div
        animate={{ scale: isActive ? 1.3 : 1, y: isActive ? -14 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className='relative z-30 mt-1 isolate select-none'
      >
        <Image src={icon || '/placeholder.svg'} width={44} height={44} alt="" className={`w-11 h-11 ${isActive ? '' : 'opacity-50 grayscale'} pointer-events-none`} />
      </motion.div>
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 10 }}
        exit={{ opacity: 0, y: 10 }}
        className='text-xs font-semibold text-white absolute bottom-1 left-0 right-0 text-center text-outline z-20'
        style={{ textShadow: '-1px -1px 0 rgba(0,0,0,0.7), 1px -1px 0 rgba(0,0,0,0.7), -1px 1px 0 rgba(0,0,0,0.7), 1px 1px 0 rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,0.5)' }}
      >
        {t(label)}
      </motion.span>
    </motion.button>
  );
};

export default React.memo(TabButton);

