'use client';

import React, { useState, useEffect } from 'react';
import { getGameProgressService } from '@/app/services/gameProgressService';
import { Button } from '@/app/components/ui/button';

interface DebugPanelProps {
  userId: string;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ userId }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  useEffect(() => {
    if (!userId || userId === 'anonymous') return;
    
    try {
      const progressService = getGameProgressService(userId);
      setQueueSize(progressService.getSyncQueueSize());

      const interval = setInterval(() => {
        setQueueSize(progressService.getSyncQueueSize());
      }, 5000);

      return () => clearInterval(interval);
    } catch (error) {
      console.error('Error in DebugPanel:', error);
    }
    return;
  }, [userId, lastRefresh]);

  const handleClearQueue = () => {
    try {
      const progressService = getGameProgressService(userId);
      progressService.clearSyncQueue();
      setQueueSize(0);
      setLastRefresh(Date.now());
    } catch (error) {
      console.error('Error clearing queue:', error);
    }
  };

  const handleEmergencyReset = () => {
    try {
      const progressService = getGameProgressService(userId);
      const success = progressService.emergencyReset();
      if (success) {
        alert('Аварийный сброс выполнен успешно');
      } else {
        alert('Ошибка при выполнении аварийного сброса');
      }
      setLastRefresh(Date.now());
    } catch (error) {
      console.error('Error during emergency reset:', error);
      alert('Ошибка при выполнении аварийного сброса: ' + error);
    }
  };

  const handleForceSyncNow = () => {
    try {
      const progressService = getGameProgressService(userId);
      progressService.syncWithDatabase(true);
      setTimeout(() => {
        setQueueSize(progressService.getSyncQueueSize());
      }, 1000);
    } catch (error) {
      console.error('Error forcing sync:', error);
    }
  };

  // Не показываем панель, если очередь синхронизации не превышает лимит
  // или если нет userId
  if (queueSize < 100 || !userId || userId === 'anonymous') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-red-100 border border-red-400 rounded p-3 shadow-lg">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-red-800">
            Проблема синхронизации: {queueSize} элементов в очереди
          </p>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-red-700 hover:text-red-900"
          >
            {isExpanded ? '↑' : '↓'}
          </button>
        </div>

        {isExpanded && (
          <>
            <p className="text-xs text-red-700">
              Большое количество элементов в очереди синхронизации может привести к потере данных.
            </p>
            <div className="flex gap-2 mt-2">
              <Button
                onClick={handleClearQueue}
                variant="destructive"
                size="sm"
              >
                Очистить очередь
              </Button>
              <Button
                onClick={handleEmergencyReset}
                variant="outline"
                size="sm"
              >
                Аварийный сброс
              </Button>
              <Button
                onClick={handleForceSyncNow}
                variant="default"
                size="sm"
              >
                Синхронизировать
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DebugPanel; 