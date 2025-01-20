import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, CheckCircle, QrCode } from 'lucide-react';
import { useTranslation } from '../../../../contexts/TranslationContext';
import Image from 'next/image';

interface DepositModalProps {
  userEthAddress: string | undefined;
}

const DepositModal: React.FC<DepositModalProps> = ({ userEthAddress }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      className="text-white space-y-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="bg-gradient-to-br from-[#3a5c82]/80 to-[#4a7a9e]/80 rounded-xl p-4 shadow-lg border border-[#5889ae]/50 backdrop-blur-sm"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className="flex items-center justify-center mb-4">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Ethereum-QViFDhOKalXUOAnEWs5bdKcdknmDIP.webp"
            alt="ETH"
            width={32}
            height={32}
            className="mr-2"
          />
          <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Deposit ETH</h3>
        </div>
        <p className="text-gray-300 mb-3 text-center text-sm">{t('depositInstructions')}</p>
        <div className="bg-[#2a3b4d]/50 rounded-lg p-3 mb-3">
          <p className="text-gray-300 mb-2 text-xs">{t('yourEthAddress')}:</p>
          <div className="flex items-center justify-between bg-[#1a2b3d]/50 rounded-lg p-2">
            <span className="text-emerald-400 text-xs font-medium break-all mr-2">{userEthAddress}</span>
            <motion.button
              onClick={() => copyToClipboard(userEthAddress || '')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-emerald-500 p-1.5 rounded-md hover:bg-emerald-600 transition-colors"
            >
              {copied ? <CheckCircle className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-white" />}
            </motion.button>
          </div>
        </div>
        <motion.button
          onClick={() => setShowQR(!showQR)}
          className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-bold py-2 px-3 rounded-lg shadow-md hover:from-blue-600 hover:to-emerald-600 transition-colors flex items-center justify-center text-sm"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <QrCode className="w-4 h-4 mr-2" />
          {showQR ? t('hideQRCode') : t('showQRCode')}
        </motion.button>
        <AnimatePresence>
          {showQR && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-3 flex justify-center"
            >
              <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${userEthAddress}`}
                alt="QR Code"
                width={150}
                height={150}
                className="rounded-lg shadow-lg"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <p className="text-xs text-gray-400 text-center">{t('depositDisclaimer')}</p>
    </motion.div>
  );
};

DepositModal.displayName = 'DepositModal';

export default DepositModal;

