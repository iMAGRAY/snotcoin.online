import React, { useEffect, useState } from 'react';

interface Quest {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

const QUESTS: Quest[] = [
  {
    id: 'merge_1',
    title: 'Play Merge Game',
    description: 'Play one round of the Merge Game.',
    completed: false,
  },
  {
    id: 'score_100',
    title: 'Score 100 Points',
    description: 'Reach a score of 100 in any game mode.',
    completed: false,
  },
  {
    id: 'login_3',
    title: 'Login 3 Days',
    description: 'Log in on 3 different days.',
    completed: false,
  },
  {
    id: 'collect_10',
    title: 'Collect 10 SnotCoins',
    description: 'Collect a total of 10 SnotCoins.',
    completed: false,
  },
];

const QUESTS_STORAGE_KEY = 'snotcoin_quests_progress';

const QuestsPage: React.FC = () => {
  const [quests, setQuests] = useState<Quest[]>(QUESTS);

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
    <div className="max-w-xl mx-auto my-10 p-6 bg-white bg-opacity-90 rounded-2xl shadow-xl">
      <h1 className="text-3xl font-bold mb-6 text-center">Quests</h1>
      <ul className="space-y-4">
        {quests.map(quest => (
          <li key={quest.id} className={`flex items-center justify-between p-4 rounded-xl border ${quest.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
            <div>
              <div className="text-lg font-semibold">{quest.title}</div>
              <div className="text-sm text-gray-500 mt-1">{quest.description}</div>
            </div>
            {quest.completed ? (
              <span className="text-green-600 font-bold text-lg">Done</span>
            ) : (
              <button onClick={() => handleComplete(quest.id)} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-base hover:bg-blue-700 transition">Mark as done</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default QuestsPage; 