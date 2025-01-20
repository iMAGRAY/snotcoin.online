import React from 'react';
import { Pause, Play } from 'lucide-react';
import { useTranslation } from '../../../../contexts/TranslationContext';
import { formatSnotValue } from '../../../../utils/gameUtils';

interface HeaderProps {
  score: number;
  snot: number;
  isPaused: boolean;
  isGameOver: boolean;
  togglePause: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  score, 
  snot, 
  isPaused, 
  isGameOver, 
  togglePause
}) => {
  const { t } = useTranslation();

  return (
    <div 
      className="fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-50"
      style={{
        backgroundImage: "url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Header-leT3WNEtgbLAz4Bn1x4G5aDS3JdXyS.webp')",
        backgroundSize: 'auto 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'repeat-x',
      }}
    >
      <button
        onClick={togglePause}
        disabled={isGameOver}
        className={`w-10 h-10 flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full shadow-lg border-2 border-white/30 hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 ${isGameOver ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isPaused ? 
          <Play size={24} color="white" className="ml-1" /> : 
          <Pause size={24} color="white" />
        }
      </button>
      <div className="flex space-x-2">
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 px-3 py-1 rounded-full shadow-md">
          <span className="text-white font-bold text-sm mr-1">{t('score')}:</span>
          <span className="text-white font-bold text-sm">{score}</span>
        </div>
        <div className="bg-gradient-to-r from-green-400 to-green-600 px-3 py-1 rounded-full shadow-md">
          <span className="text-white font-bold text-sm mr-1">SNOT:</span>
          <span className="text-white font-bold text-sm">{formatSnotValue(snot)}</span>
        </div>
      </div>
    </div>
  );
};

export default Header;

