import React from 'react';
import { motion } from 'framer-motion';
import { Wallet } from 'lucide-react';
import { useTranslation } from '../../../../contexts/TranslationContext';

const SubmitButton: React.FC = React.memo(() => {
  const { t } = useTranslation();

  return (
    <motion.button
      type="submit"
      className="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg flex items-center justify-center space-x-2"
      whileHover={{ scale: 1.02, boxShadow: "0 0 15px rgba(255,255,255,0.3)" }}
      whileTap={{ scale: 0.98 }}
    >
      <Wallet className="w-5 h-5" />
      <span>{t('Withdraw')}</span>
    </motion.button>
  );
});

export default SubmitButton;

