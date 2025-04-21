import React, { useEffect, useState } from 'react';
import { ICONS } from '../../../constants/uiConstants';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { StaticImageData } from 'next/image';

interface Quest {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  icon: string | StaticImageData;
  points?: number;
  date?: string;
  reward?: string;
}

const QUESTS: Quest[] = [
  {
    id: 'merge_1',
    title: 'Play Merge Game',
    description: 'Play one round of the Merge Game.',
    completed: false,
    icon: '/images/quests/Quests1.webp',
    points: 10,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'score_100',
    title: 'Score 100 Points',
    description: 'Reach a score of 100 in any game mode.',
    completed: false,
    icon: ICONS.KINGCOIN,
    points: 30,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'login_3',
    title: 'Login 3 Days',
    description: 'Log in on 3 different days.',
    completed: false,
    icon: ICONS.PROFILE.AVATAR.DEFAULT,
    points: 40,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'collect_10',
    title: 'Collect 10 KingCoins',
    description: 'Collect a total of 10 KingCoins.',
    completed: false,
    icon: ICONS.KINGCOIN,
    points: 10,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'combo_master',
    title: 'Combo Master',
    description: 'Create a combo of 5 or more items in Merge Game.',
    completed: false,
    icon: ICONS.LABORATORY.MACHINE,
    points: 50,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'collector',
    title: 'Collector',
    description: 'Discover all types of items in the Merge Game.',
    completed: false,
    icon: ICONS.SNOT,
    points: 75,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'persistent_player',
    title: 'Persistent Player',
    description: 'Play the game for 7 consecutive days.',
    completed: false,
    icon: ICONS.PROFILE.AVATAR.DEFAULT,
    points: 80,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'generous_donor',
    title: 'Generous Donor',
    description: 'Spend 100 KingCoins on upgrades.',
    completed: false,
    icon: ICONS.STORAGE.MAIN,
    points: 60,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'snot_millionaire',
    title: 'King Millionaire',
    description: 'Collect a total of 1000 KingCoins.',
    completed: false,
    icon: ICONS.KINGCOIN,
    points: 100,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'merge_master',
    title: 'Merge Master',
    description: 'Merge 50 elements in the Merge Game.',
    completed: false,
    icon: ICONS.LABORATORY.MACHINE,
    points: 45,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'snot_factory',
    title: 'Snot Factory',
    description: 'Produce 100 units of snot in the laboratory.',
    completed: false,
    icon: ICONS.SNOT,
    points: 55,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'daily_login_streak',
    title: 'Daily Player',
    description: 'Login to the game for 14 consecutive days.',
    completed: false,
    icon: ICONS.PROFILE.AVATAR.DEFAULT,
    points: 120,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'storage_upgrade',
    title: 'Extended Storage',
    description: 'Upgrade storage to the maximum level.',
    completed: false,
    icon: ICONS.STORAGE.MAIN,
    points: 85,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'high_score_champion',
    title: 'High Score Champion',
    description: 'Score 500 points in any game mode.',
    completed: false,
    icon: '/images/quests/Quests1.webp',
    points: 90,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'snot_investor',
    title: 'King Investor',
    description: 'Invest 500 KingCoins in upgrades.',
    completed: false,
    icon: ICONS.KINGCOIN,
    points: 70,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'laboratory_scientist',
    title: 'Laboratory Scientist',
    description: 'Unlock all laboratory upgrades.',
    completed: false,
    icon: ICONS.LABORATORY.MACHINE,
    points: 110,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'speed_merger',
    title: 'Speed Merger',
    description: 'Merge 10 elements in 30 seconds.',
    completed: false,
    icon: ICONS.LABORATORY.MACHINE,
    points: 65,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'community_player',
    title: 'Community Player',
    description: 'Invite a friend to play Snot Coin.',
    completed: false,
    icon: ICONS.PROFILE.AVATAR.DEFAULT,
    points: 60,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'snot_billionaire',
    title: 'Snot Billionaire',
    description: 'Collect 10000 SnotCoins.',
    completed: false,
    icon: ICONS.KINGCOIN,
    points: 150,
    date: '10/15/24',
    reward: '',
  },
  {
    id: 'collect-100-coins',
    title: 'Wealthy Wizard',
    description: 'Collect 100 coins',
    completed: false,
    icon: ICONS.KINGCOIN,
    points: 100,
    date: '10/15/24',
    reward: {
      type: 'currency',
      amount: 500,
      icon: ICONS.KINGCOIN,
    },
  },
  {
    id: 'collect-1000-coins',
    title: 'Fortune Hunter',
    description: 'Collect 1,000 coins',
    completed: false,
    icon: ICONS.KINGCOIN,
    points: 1000,
    date: '10/15/24',
    reward: {
      type: 'currency',
      amount: 2000,
      icon: ICONS.KINGCOIN,
    },
  },
  {
    id: 'spend-500-coins',
    title: 'Big Spender',
    description: 'Spend 500 coins on upgrades',
    completed: false,
    icon: ICONS.KINGCOIN,
    points: 500,
    date: '10/15/24',
    reward: {
      type: 'currency',
      amount: 1000,
      icon: ICONS.KINGCOIN,
    },
  },
  {
    id: 'daily-login-5',
    title: 'Loyal Citizen',
    description: 'Log in for 5 consecutive days',
    completed: false,
    icon: ICONS.KINGCOIN,
    points: 2500,
    date: '10/15/24',
    reward: {
      type: 'currency',
      amount: 2500,
      icon: ICONS.KINGCOIN,
    },
  },
  {
    id: 'open-20-chests',
    title: 'Treasure Hunter',
    description: 'Open 20 chests',
    completed: false,
    icon: ICONS.KINGCOIN,
    points: 5000,
    date: '10/15/24',
    reward: {
      type: 'currency',
      amount: 5000,
      icon: ICONS.KINGCOIN,
    },
  },
];

const QUESTS_STORAGE_KEY = 'kingcoin_quests_progress';

const Quests: React.FC = () => {
  const [quests, setQuests] = useState<Quest[]>(QUESTS);
  const [activeTab, setActiveTab] = useState<'Achievements' | 'Statistics'>('Achievements');

  useEffect(() => {
    const saved = localStorage.getItem(QUESTS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setQuests(
          QUESTS.map(q => ({ ...q, completed: parsed[q.id] || false }))
        );
      } catch {}
    }
  }, []);

  const handleComplete = (id: string) => {
    const updated = quests.map(q =>
      q.id === id ? { ...q, completed: true } : q
    );
    setQuests(updated);
    const progress: Record<string, boolean> = {};
    updated.forEach(q => (progress[q.id] = q.completed));
    localStorage.setItem(QUESTS_STORAGE_KEY, JSON.stringify(progress));
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#181510]" style={{fontFamily: 'Friz Quadrata, serif'}}>
      {/* Background WoW-style (только градиент, без изображения) */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.92) 100%)'
      }} />
      <div className="relative z-10 w-full h-screen flex flex-col p-0 m-0">
        <div className="absolute inset-0 z-10 flex flex-col bg-gradient-to-b from-[#2a2112]/95 via-[#3a2c0a]/90 to-[#181510]/98">
          {/* Декоративные уголки только снизу */}
          <div className="pointer-events-none absolute z-20 -bottom-2 -left-2 w-10 h-10 bg-[url('/images/ui/corner-bl.webp')] bg-no-repeat bg-contain" />
          <div className="pointer-events-none absolute z-20 -bottom-2 -right-2 w-10 h-10 bg-[url('/images/ui/corner-br.webp')] bg-no-repeat bg-contain" />
          {/* Tabs */}
          <div className="w-full flex flex-row justify-between border-b-4 border-[#7a5c2b] bg-gradient-to-b from-[#2a2112]/95 to-[#181510]/95">
            <button
              onClick={() => setActiveTab('Achievements')}
              className={`w-1/2 py-2 rounded-t-lg font-bold text-lg tracking-wide transition-all duration-200 text-center ${activeTab === 'Achievements'
                ? 'bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-300 text-[#2a1c0a] shadow-[0_0_8px_2px_#FFD70099] border-x-2 border-t-2 border-yellow-600 -mb-1 z-10'
                : 'bg-gradient-to-r from-[#2a2112]/80 to-[#181510]/80 text-yellow-200/80 hover:bg-yellow-900/30 border-x-2 border-t-2 border-transparent -mb-1'}`}
              style={{textShadow: activeTab === 'Achievements' ? '0 1px 2px #fff8, 0 0 2px #000' : '0 1px 2px #0008'}}
            >
              Achievements
            </button>
            <button
              onClick={() => setActiveTab('Statistics')}
              className={`w-1/2 py-2 rounded-t-lg font-bold text-lg tracking-wide transition-all duration-200 text-center ${activeTab === 'Statistics'
                ? 'bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-300 text-[#2a1c0a] shadow-[0_0_8px_2px_#FFD70099] border-x-2 border-t-2 border-yellow-600 -mb-1 z-10'
                : 'bg-gradient-to-r from-[#2a2112]/80 to-[#181510]/80 text-yellow-200/80 hover:bg-yellow-900/30 border-x-2 border-t-2 border-transparent -mb-1'}`}
              style={{textShadow: activeTab === 'Statistics' ? '0 1px 2px #fff8, 0 0 2px #000' : '0 1px 2px #0008'}}
            >
              Statistics
            </button>
          </div>
          {/* Content */}
          <div className="flex-1 flex flex-col py-4 sm:py-6 w-full bg-gradient-to-b from-[#23221a]/95 to-[#181510]/95 relative">
            {activeTab === 'Achievements' && (
              <>
                <div className="flex flex-col sm:flex-row items-center mb-4 gap-2">
                  <div className="text-xl sm:text-2xl font-extrabold text-yellow-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] tracking-wide">Achievement Points <span className="ml-2 text-yellow-600 text-2xl sm:text-3xl align-middle">2410</span></div>
                </div>
                <div className="flex flex-col gap-3 px-4 sm:px-6 md:px-8">
                  <AnimatePresence>
                    {quests.map((quest, idx) => (
                      <motion.div
                        key={quest.id}
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 40 }}
                        transition={{ duration: 0.1, type: 'tween' }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className={`relative flex flex-row items-center gap-3 sm:gap-4 py-2 sm:py-2 w-full rounded-xl border-2
                          ${quest.completed
                            ? 'bg-gradient-to-r from-yellow-900/90 via-yellow-950/90 to-yellow-900/90 border-yellow-700 shadow-yellow-700/20'
                            : 'bg-gradient-to-r from-gray-800/90 via-gray-900/95 to-gray-950/95 border-gray-700 text-gray-400 opacity-80 hover:opacity-95 hover:border-gray-500'}
                          transition-all duration-100 group before:absolute before:inset-0 before:rounded-xl before:shadow-[inset_0_2px_6px_#fff1,0_2px_6px_#000c] before:pointer-events-none`}
                        style={{boxShadow: quest.completed ? '0 0 12px 3px #FFD70022' : '0 2px 8px #000', minHeight: 64}}
                      >
                        {/* Icon */}
                        <div className="flex items-center justify-center min-w-[64px] min-h-[64px] mr-4 ml-2 rounded-full">
                          <Image src={quest.icon} alt="quest icon" width={64} height={64} className={`rounded-full border-2 ${quest.completed ? 'border-yellow-900 shadow bg-yellow-900/40' : 'border-gray-600 bg-gray-900/60 grayscale'}`} />
                        </div>
                        {/* Main info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-lg sm:text-xl font-bold ${quest.completed ? 'text-yellow-100' : 'text-gray-300'} truncate`}>{quest.title}</span>
                          </div>
                          <div className={`${quest.completed ? 'text-yellow-200/80' : 'text-gray-400'} text-base italic mt-0.5 truncate sm:whitespace-normal`}>{quest.description}</div>
                          {quest.reward && quest.reward.length > 0 && (
                            <div className="text-yellow-400 text-sm mt-1">Reward: <span className="font-bold">{quest.reward}</span></div>
                          )}
                        </div>
                        {/* Points (справа) */}
                        <div className="flex items-center justify-center min-w-[70px]">
                          <span className={`ml-2 font-extrabold text-2xl ${quest.completed ? 'text-amber-300' : 'text-gray-400'}`}>{quest.points}</span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </>
            )}
            {activeTab === 'Statistics' && (
              <div className="flex flex-col items-center justify-center h-full w-full text-yellow-200 text-xl font-bold mt-12">
                Statistics coming soon...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Quests; 