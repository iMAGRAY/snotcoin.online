import React from 'react';
import { useTranslation } from '../../../../contexts/TranslationContext';

interface AmountInputProps {
  amount: string;
  onAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedCurrency: 'ETH' | 'SnotCoin';
}

const AmountInput: React.FC<AmountInputProps> = React.memo(({ amount, onAmountChange, selectedCurrency }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <label htmlFor="amount" className="block text-sm font-medium text-gray-300">
        {t('amount')}
      </label>
      <input
        type="number"
        id="amount"
        value={amount}
        onChange={onAmountChange}
        className="w-full bg-gray-700 rounded-xl py-3 px-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition duration-200"
        placeholder={`Enter ${selectedCurrency} amount`}
        required
      />
    </div>
  );
});

export default AmountInput;

