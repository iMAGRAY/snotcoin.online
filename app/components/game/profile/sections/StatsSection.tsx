import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Trophy, Award, Zap, Clock } from 'lucide-react';
import { useTranslation } from '../../../../contexts/TranslationContext';
import { useGameState } from '../../../../contexts/GameContext';
import { formatSnotValue } from '../../../../utils/gameUtils';

interface StatsSectionProps {}

const StatsSection: React.FC<StatsSectionProps> = () => {
  const { t } = useTranslation();
  const gameState = useGameState();

  const stats = [
    { label: 'Total playtime', value: `${gameState.fusionGamesPlayed * 5 || 0}m`, icon: Clock },
    { label: 'Total SNOT collected', value: formatSnotValue(gameState.inventory?.snot || 0), icon: Trophy },
    { label: 'Successful fusions', value: gameState.fusionGamesPlayed?.toString() || '0', icon: Zap },
    { label: 'Highest level reached', value: gameState.highestLevel?.toString() || '1', icon: Award },
  ];

  return (
    <motion.div 
      className="text-white space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h4 className="font-bold text-xl mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Game Statistics</h4>
        <div className="grid grid-cols-2 gap-4">
          {stats.map((item, index) => (
            <motion.div 
              key={item.label}
              className="bg-gradient-to-br from-[#3a5c82]/60 to-[#4a7a9e]/60 rounded-xl p-4 flex flex-col items-center justify-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <item.icon className="w-8 h-8 text-emerald-400 mb-2" />
              <p className="text-sm text-gray-300 mb-1">{t(item.label)}</p>
              <p className="text-lg font-bold text-emerald-400">{item.value}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h4 className="font-bold text-xl mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Achievements Progress</h4>
        {[
          { label: 'Total achievements', value: 5, max: 30 },
          { label: 'Rare achievements', value: 2, max: 10 },
          { label: 'Legendary achievements', value: 1, max: 5 },
        ].map((item, index) => (
          <motion.div 
            key={item.label}
            className="mb-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.05 }}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-300">{t(item.label)}:</span>
              <span className="font-semibold text-emerald-400">{item.value}/{item.max}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <motion.div 
                className="bg-gradient-to-r from-blue-400 to-emerald-400 h-2.5 rounded-full" 
                style={{ width: `${(item.value / item.max) * 100}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${(item.value / item.max) * 100}%` }}
                transition={{ duration: 1, delay: 0.5 + index * 0.1 }}
              />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
};

StatsSection.displayName = 'StatsSection';

export default StatsSection;

