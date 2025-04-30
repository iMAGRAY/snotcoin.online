'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '../../contexts/game/hooks/useGameState';

interface SaveIndicatorProps {
  className?: string;
}

export default function SaveIndicator({ className = '' }: SaveIndicatorProps) {
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'none' | 'pending' | 'error'>('idle');
  const [showDetails, setShowDetails] = useState(false);
  const [hasErrors, setHasErrors] = useState(false);
  
  const gameState = useGameState();

  // Обновление информации каждые 2 секунды
  useEffect(() => {
    const checkSyncStatus = () => {
      // Получаем дату последней синхронизации из localStorage
      const lastSync = localStorage.getItem('royaleway_last_sync');
      
      // Если дата синхронизации есть и прошло не больше 2 секунд
      setSyncStatus(lastSync && (Date.now() - parseInt(lastSync)) < 2000 ? 'saved' : 'none');
      
      // Проверяем наличие очереди синхронизации
      const syncQueue = localStorage.getItem('royaleway_sync_queue');
      
      // Если есть очередь синхронизации, показываем соответствующий статус
      if (syncQueue && syncQueue !== '[]') {
        setSyncStatus('pending');
      }
    };
    
    // Запускаем немедленное обновление
    checkSyncStatus();
    
    // Создаем интервал для обновления
    const intervalId = setInterval(checkSyncStatus, 2000);
    
    // Очищаем интервал при размонтировании
    return () => clearInterval(intervalId);
  }, []);
  
  // Обработчик для ручного сохранения
  const handleSave = () => {
    if (gameState.saveProgress) {
      setSyncStatus('syncing');
      gameState.saveProgress();
      
      // Возвращаем статус в исходное состояние через некоторое время
      setTimeout(() => {
        setSyncStatus('idle');
      }, 1500);
    }
  };
  
  return (
    <div 
      className={`save-indicator fixed bottom-3 right-3 z-50 ${className}`}
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <button 
        onClick={handleSave}
        className="flex items-center px-3 py-2 bg-gray-800 bg-opacity-80 text-white rounded-full shadow-lg hover:bg-opacity-90 transition-all"
      >
        <div className={`w-3 h-3 rounded-full mr-2 ${
          syncStatus === 'idle' ? 'bg-green-500' : 
          syncStatus === 'syncing' ? 'bg-blue-500 animate-pulse' : 
          'bg-red-500 animate-ping'
        }`}></div>
        
        <span className="text-sm whitespace-nowrap">
          {syncStatus === 'idle' ? 'Сохранено' : 
           syncStatus === 'syncing' ? 'Сохранение...' : 
           'Ошибка сохранения'}
        </span>
      </button>
      
      {showDetails && (
        <div className="absolute bottom-full right-0 mb-2 p-3 bg-white rounded shadow-lg text-sm w-64">
          {lastSyncTime && (
            <p className="text-gray-800">
              Последнее сохранение: {lastSyncTime}
            </p>
          )}
          
          {hasErrors && (
            <p className="text-red-600 mt-1">
              Обнаружены ошибки синхронизации. Проверьте профиль для получения подробностей.
            </p>
          )}
          
          <p className="text-gray-600 mt-2 text-xs">
            Нажмите для ручного сохранения.
          </p>
        </div>
      )}
    </div>
  );
} 