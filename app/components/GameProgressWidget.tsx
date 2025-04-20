'use client';

import { useState, useEffect } from 'react';
import { useGameState } from '../contexts/game/hooks/useGameState';
import { getGameProgressService } from '../services/gameProgressService';

interface ProgressHistoryItem {
  id: number;
  user_id: string;
  client_id: string;
  save_type: string;
  save_reason: string;
  created_at: string | Date;
}

interface GameProgressWidgetProps {
  userId: string;
  className?: string;
  showControls?: boolean;
}

export default function GameProgressWidget({
  userId,
  className = '',
  showControls = true
}: GameProgressWidgetProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<ProgressHistoryItem[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  
  const gameState = useGameState();
  const gameProgressService = getGameProgressService(userId);

  // Обновление информации каждые 5 секунд
  useEffect(() => {
    const updateInfo = () => {
      // Получаем время последней синхронизации из localStorage
      if (typeof window !== 'undefined') {
        const lastSync = localStorage.getItem('snotcoin_last_sync');
        if (lastSync) {
          const lastSyncDate = new Date(parseInt(lastSync, 10));
          setLastSyncTime(lastSyncDate.toLocaleString());
        }

        // Получаем ошибки синхронизации
        const syncQueue = localStorage.getItem('snotcoin_sync_queue');
        if (syncQueue) {
          try {
            const queue = JSON.parse(syncQueue);
            const errors = queue
              .filter((item: any) => item.status === 'failed')
              .map((item: any) => item.error || 'Неизвестная ошибка');
            
            setSyncErrors(errors);
            setSyncStatus(errors.length > 0 ? 'error' : 'idle');
          } catch (e) {
            console.error('Ошибка при обработке очереди синхронизации:', e);
          }
        }
      }
    };

    // Запускаем немедленное обновление
    updateInfo();
    
    // Создаем интервал для обновления
    const intervalId = setInterval(updateInfo, 5000);
    
    // Очищаем интервал при размонтировании
    return () => clearInterval(intervalId);
  }, []);

  // Функция для принудительной синхронизации
  const handleForceSync = async () => {
    setIsLoading(true);
    setSyncStatus('syncing');
    setMessage({ text: 'Синхронизация с сервером...', type: 'info' });
    
    try {
      await gameProgressService.syncWithDatabase(true);
      
      setSyncStatus('idle');
      setSyncErrors([]);
      setMessage({ text: 'Синхронизация завершена успешно', type: 'success' });
      
      // Обновляем время последней синхронизации
      const lastSync = localStorage.getItem('snotcoin_last_sync');
      if (lastSync) {
        const lastSyncDate = new Date(parseInt(lastSync, 10));
        setLastSyncTime(lastSyncDate.toLocaleString());
      }
    } catch (error) {
      console.error('Ошибка при синхронизации:', error);
      setSyncStatus('error');
      setMessage({ text: 'Ошибка при синхронизации с сервером', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Обработчик для создания резервной копии
  const handleCreateBackup = async () => {
    setIsLoading(true);
    setMessage({ text: 'Создание резервной копии...', type: 'info' });
    
    try {
      // Сохраняем текущий прогресс
      if (gameState.saveProgress) {
        gameState.saveProgress();
      }
      
      // Создаем резервную копию
      const success = await gameProgressService.saveGameState(gameState);
      
      if (success) {
        setMessage({ text: 'Резервная копия успешно создана', type: 'success' });
        
        // Обновляем время последней синхронизации
        const lastSync = localStorage.getItem('snotcoin_last_sync');
        if (lastSync) {
          const lastSyncDate = new Date(parseInt(lastSync, 10));
          setLastSyncTime(lastSyncDate.toLocaleString());
        }
      } else {
        setMessage({ text: 'Не удалось создать резервную копию', type: 'error' });
      }
    } catch (error) {
      console.error('Ошибка при создании резервной копии:', error);
      setMessage({ text: 'Ошибка при создании резервной копии', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Обработчик для загрузки истории
  const handleLoadHistory = async () => {
    setIsLoading(true);
    setMessage({ text: 'Загрузка истории...', type: 'info' });
    
    try {
      // Загружаем историю прогресса
      const history = await gameProgressService.getProgressHistory(20);
      setHistoryItems(history);
      setShowHistory(true);
      setMessage(null);
    } catch (error) {
      console.error('Ошибка при загрузке истории:', error);
      setMessage({ text: 'Ошибка при загрузке истории', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Форматирование даты
  const formatDate = (date: string | Date) => {
    try {
      return new Date(date).toLocaleString();
    } catch (e) {
      return String(date);
    }
  };

  // Форматирование типа сохранения
  const formatSaveType = (type: string, reason: string) => {
    switch (type) {
      case 'auto':
        return 'Автоматическое';
      case 'manual':
        return 'Ручное';
      case 'auto_backup':
        return 'Авто-бэкап';
      case 'system_restore':
        return 'Системное (перед восстановлением)';
      default:
        return type;
    }
  };

  return (
    <div className={`game-progress-widget rounded-lg p-4 ${className}`} style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
      <h3 className="text-lg font-semibold mb-2">Прогресс игры</h3>
      
      <div className="flex items-center mb-2">
        <div className={`w-3 h-3 rounded-full mr-2 ${
          syncStatus === 'idle' ? 'bg-green-500' : 
          syncStatus === 'syncing' ? 'bg-blue-500 animate-pulse' : 
          'bg-red-500'
        }`}></div>
        <p className="text-sm">
          {syncStatus === 'idle' ? 'Синхронизировано' : 
           syncStatus === 'syncing' ? 'Синхронизация...' : 
           'Ошибка синхронизации'}
        </p>
      </div>
      
      {lastSyncTime && (
        <p className="text-gray-600 text-sm mb-2">
          Последняя синхронизация: {lastSyncTime}
        </p>
      )}
      
      {syncErrors.length > 0 && (
        <div className="bg-red-100 p-2 rounded mb-3 text-sm">
          <p className="font-medium text-red-800">Ошибки синхронизации:</p>
          <ul className="list-disc pl-5 mt-1">
            {syncErrors.slice(0, 3).map((error, index) => (
              <li key={index} className="text-red-700">{error}</li>
            ))}
            {syncErrors.length > 3 && (
              <li className="text-red-700">...и еще {syncErrors.length - 3}</li>
            )}
          </ul>
          <button 
            onClick={handleForceSync}
            disabled={isLoading || syncStatus === 'syncing'}
            className="mt-2 px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:opacity-50"
          >
            Повторить синхронизацию
          </button>
        </div>
      )}
      
      {message && (
        <div className={`message p-2 my-2 rounded ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 
          message.type === 'error' ? 'bg-red-100 text-red-800' : 
          'bg-blue-100 text-blue-800'
        }`}>
          {message.text}
        </div>
      )}
      
      {showControls && !showHistory && (
        <div className="flex flex-wrap gap-2 mt-3">
          <button 
            onClick={handleCreateBackup} 
            disabled={isLoading}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Создание...' : 'Создать копию'}
          </button>
          
          <button 
            onClick={handleLoadHistory} 
            disabled={isLoading}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            {isLoading ? 'Загрузка...' : 'История копий'}
          </button>
          
          <button 
            onClick={handleForceSync}
            disabled={isLoading || syncStatus === 'syncing'}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {syncStatus === 'syncing' ? 'Синхронизация...' : 'Синхронизировать'}
          </button>
        </div>
      )}
      
      {showHistory && (
        <div className="history-list mt-3">
          <h4 className="font-medium mb-2">История сохранений</h4>
          {historyItems.length === 0 ? (
            <p className="text-gray-500">История сохранений пуста</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {historyItems.map((item) => (
                <li key={item.id} className="py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(item.created_at)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatSaveType(item.save_type, item.save_reason)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button 
            onClick={() => setShowHistory(false)} 
            className="mt-3 px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Назад
          </button>
        </div>
      )}
    </div>
  );
} 