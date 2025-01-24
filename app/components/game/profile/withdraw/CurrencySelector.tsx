import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '../../../../contexts/TranslationContext';

interface CurrencySelectorProps {
  selectedCurrency: 'ETH' | 'SnotCoin';
  onCurrencyChange: (currency: 'ETH' | 'SnotCoin') => void;
}

const CurrencySelector: React.FC<CurrencySelectorProps> = React.memo(({ selectedCurrency, onCurrencyChange }) => {
  const { t } = useTranslation();

  return (
    <div className="flex space-x-4">
      <motion.button
        type="button"
        className={`flex-1 py-3 px-4 rounded-xl font-bold text-lg shadow-lg ${
          selectedCurrency === 'ETH'
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
            : 'bg-gray-700 text-gray-300'
        }`}
        onClick={() => onCurrencyChange('ETH')}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        ETH
      </motion.button>
      <motion.button
        type="button"
        className={`flex-1 py-3 px-4 rounded-xl font-bold text-lg shadow-lg ${
          selectedCurrency === 'SnotCoin'
            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
            : 'bg-gray-700 text-gray-300'
        }`}
        onClick={() => onCurrencyChange('SnotCoin')}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        SnotCoin
      </motion.button>
    </div>
  );
});

export default CurrencySelector;

