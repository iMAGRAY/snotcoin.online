'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '../contexts/game/hooks/useGameState';
import GameProgressWidget from '../components/GameProgressWidget';
import { useFarcaster } from '../contexts/FarcasterContext';

// Создаем простые компоненты заголовка и футера, если они не существуют
function Header() {
  return (
    <header className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold">SnotCoin Game</h1>
        <nav>
          <ul className="flex space-x-4">
            <li><a href="/" className="hover:underline">Игра</a></li>
            <li><a href="/profile" className="hover:underline">Профиль</a></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-800 text-white p-4 mt-auto">
      <div className="container mx-auto text-center">
        <p>© 2023 SnotCoin Game. Все права защищены.</p>
      </div>
    </footer>
  );
}

export default function ProfilePage() {
  const gameStateContext = useGameState();
  const { sdkUser } = useFarcaster();
  const [userId, setUserId] = useState<string>('');
  
  // Используем контекст игры напрямую, так как он возвращает GameState
  const state = gameStateContext || {
    inventory: { snotCoins: 0 },
    stats: { totalSnot: 0, clickCount: 0, playTime: 0 },
    achievements: { unlockedAchievements: [] }
  };
  
  useEffect(() => {
    // Получаем FID пользователя или используем локальный ID
    if (sdkUser?.fid) {
      setUserId(String(sdkUser.fid));
    } else if (typeof window !== 'undefined') {
      const localUserId = localStorage.getItem('snotcoin_persistent_user_id');
      if (localUserId) {
        setUserId(localUserId);
      }
    }
  }, [sdkUser]);
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Профиль игрока</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Статистика игрока */}
          <div className="col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Статистика</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-gray-600">Игровая валюта</h3>
                <p className="text-2xl font-bold">{state.inventory.snotCoins.toFixed(1)} SC</p>
              </div>
              
              <div>
                <h3 className="text-gray-600">Собрано соплей</h3>
                <p className="text-2xl font-bold">{state.stats.totalSnot.toFixed(1)}</p>
              </div>
              
              <div>
                <h3 className="text-gray-600">Кликов</h3>
                <p className="text-2xl font-bold">{state.stats.clickCount}</p>
              </div>
              
              <div>
                <h3 className="text-gray-600">Время в игре</h3>
                <p className="text-2xl font-bold">{Math.floor(state.stats.playTime / 60)} мин</p>
              </div>
            </div>
          </div>
          
          {/* Виджет управления прогрессом */}
          {userId && (
            <div className="col-span-1">
              <GameProgressWidget userId={userId} />
            </div>
          )}
        </div>
        
        {/* Достижения */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Достижения</h2>
          
          {state.achievements.unlockedAchievements.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {state.achievements.unlockedAchievements.map((achievementId: string) => (
                <div key={achievementId} className="bg-gray-100 p-3 rounded">
                  <h3 className="font-medium">{achievementId}</h3>
                  <p className="text-xs text-gray-600">Разблокировано</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">У вас пока нет достижений. Продолжайте играть, чтобы разблокировать их.</p>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
} 