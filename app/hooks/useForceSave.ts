/**
 * Хук для принудительного сохранения состояния игры
 * Полезен для защиты от потери данных при закрытии страницы
 */

import { useState, useEffect, useCallback } from 'react';
import { useSaveManager, SavePriority } from '../contexts/SaveManagerProvider';
import { useGameState } from '../contexts/game/hooks';

/**
 * Хук для принудительного сохранения состояния игры
 * @returns функция для принудительного сохранения, принимает опциональную задержку в мс
 */
export const useForceSave = (): ((delay?: number) => void) => {
  const [isSaving, setIsSaving] = useState(false);
  const gameState = useGameState();
  const saveManager = useSaveManager();

  // Функция для принудительного сохранения с опциональной задержкой
  const forceSave = useCallback((delay?: number) => {
    if (isSaving) return;
    
    const userId = gameState._userId;
    if (!userId) return;
    
    setIsSaving(true);
    
    const saveAction = () => {
      try {
        // Используем createEmergencyBackup для быстрого сохранения
        saveManager.createEmergencyBackup(userId, gameState);
        
        // Также запускаем полноценное сохранение
        saveManager.save(userId, gameState, SavePriority.CRITICAL)
          .finally(() => {
            setIsSaving(false);
          });
      } catch (error) {
        setIsSaving(false);
      }
    };
    
    // Если указана задержка, используем setTimeout
    if (delay && delay > 0) {
      setTimeout(saveAction, delay);
    } else {
      saveAction();
    }
  }, [gameState, isSaving, saveManager]);

  // Регистрируем обработчики событий для перехвата закрытия страницы
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      forceSave();
      
      // Старый способ предотвращения закрытия - оставляем для совместимости
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    
    // Добавляем обработчик события закрытия страницы
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Удаляем обработчик при размонтировании компонента
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [forceSave]);

  return forceSave;
}; 