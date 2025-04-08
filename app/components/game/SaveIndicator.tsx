'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '../../contexts/game/hooks/useGameState';

interface SaveIndicatorProps {
  className?: string;
}

export default function SaveIndicator({ className = '' }: SaveIndicatorProps) {
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [showDetails, setShowDetails] = useState(false);
  const [hasErrors, setHasErrors] = useState(false);
  
  const gameState = useGameState();

  // Обновление информации каждые 2 секунды
  useEffect(() => {
    const updateStatus = () => {
      if (typeof window === 'undefined') return;
      
      // Проверяем время последней синхронизации
      const lastSync = localStorage.getItem('snotcoin_last_sync');
      if (lastSync) {
        const lastSyncDate = new Date(parseInt(lastSync, 10));
        setLastSyncTime(lastSyncDate.toLocaleString());
      }
      
      // Проверяем наличие ошибок в очереди синхронизации
      const syncQueue = localStorage.getItem('snotcoin_sync_queue');
      if (syncQueue) {
        try {
          const queue = JSON.parse(syncQueue);
          const hasSyncErrors = queue.some((item: any) => item.status === 'failed');
          const isSyncing = queue.some((item: any) => item.status === 'processing');
          
          setHasErrors(hasSyncErrors);
          setSyncStatus(isSyncing ? 'syncing' : (hasSyncErrors ? 'error' : 'idle'));
        } catch (e) {
          console.error('Ошибка при обработке очереди синхронизации:', e);
        }
      }
    };
    
    // Запускаем немедленное обновление
    updateStatus();
    
    // Создаем интервал для обновления
    const intervalId = setInterval(updateStatus, 2000);
    
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