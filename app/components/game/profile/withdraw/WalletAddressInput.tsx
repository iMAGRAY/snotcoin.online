import React from 'react';
import { useTranslation } from '../../../../contexts/TranslationContext';

interface WalletAddressInputProps {
  walletAddress: string;
  onWalletAddressChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const WalletAddressInput: React.FC<WalletAddressInputProps> = React.memo(({ walletAddress, onWalletAddressChange }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <label htmlFor="walletAddress" className="block text-sm font-medium text-gray-300">
        {t('walletAddress')}
      </label>
      <div className="relative">
        <input
          type="text"
          id="walletAddress"
          value={walletAddress}
          onChange={onWalletAddressChange}
          className="w-full bg-gray-700 rounded-xl py-3 px-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition duration-200"
          placeholder="Enter wallet address"
          required
        />
      </div>
    </div>
  );
});

export default WalletAddressInput;

