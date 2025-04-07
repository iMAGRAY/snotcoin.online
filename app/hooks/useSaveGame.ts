'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSaveManager } from '../contexts/SaveManagerProvider';
import { ExtendedGameState } from '../types/gameTypes';
import { SavePriority, SaveResult } from '../services/saveSystem/types';

interface UseSaveGameOptions {
  /**
   * Минимальный интервал между автосохранениями (в миллисекундах)
   * @default 60000 (1 минута)
   */
  autoSaveInterval?: number;
  
  /**
   * Включить автосохранение
   * @default true
   */
  autoSave?: boolean;
  
  /**
   * Функция для получения текущего состояния игры
   */
  getGameState: () => ExtendedGameState;
  
  /**
   * ID пользователя
   */
  userId: string;
  
  /**
   * Обработчик успешного сохранения
   */
  onSaveSuccess?: (result: SaveResult) => void;
  
  /**
   * Обработчик ошибки сохранения
   */
  onSaveError?: (result: SaveResult) => void;
}

export function useSaveGame({
  autoSaveInterval = 60000,
  autoSave = true,
  getGameState,
  userId,
  onSaveSuccess,
  onSaveError
}: UseSaveGameOptions) {
  // Получаем менеджер сохранений из контекста
  const { save, createEmergencyBackup, isInitialized } = useSaveManager();
  
  // Состояние для отслеживания операций сохранения
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaveTime, setLastSaveTime] = useState<number>(0);
  const [lastSaveResult, setLastSaveResult] = useState<SaveResult | null>(null);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Функция сохранения
  const saveGame = useCallback(async (priority: SavePriority = SavePriority.MEDIUM): Promise<SaveResult> => {
    if (!isInitialized || !userId) {
      const result: SaveResult = {
        success: false,
        timestamp: Date.now(),
        error: !isInitialized 
          ? 'Система сохранений не инициализирована' 
          : 'ID пользователя не указан'
      };
      return result;
    }
    
    try {
      setIsSaving(true);
      
      // Получаем текущее состояние игры
      const gameState = getGameState();
      
      // Создаем экстренную резервную копию перед сохранением
      createEmergencyBackup(userId, gameState);
      
      // Сохраняем игру
      const result = await save(userId, gameState);
      
      // Обновляем состояние
      setLastSaveTime(Date.now());
      setLastSaveResult(result);
      
      // Вызываем обработчики
      if (result.success) {
        onSaveSuccess?.(result);
      } else {
        onSaveError?.(result);
      }
      
      return result;
    } catch (error) {
      const errorResult: SaveResult = {
        success: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
      
      setLastSaveResult(errorResult);
      onSaveError?.(errorResult);
      
      return errorResult;
    } finally {
      setIsSaving(false);
    }
  }, [isInitialized, userId, getGameState, createEmergencyBackup, save, onSaveSuccess, onSaveError]);
  
  // Функция форсированного сохранения (высокий приоритет)
  const forceSave = useCallback(async (): Promise<SaveResult> => {
    return saveGame(SavePriority.HIGH);
  }, [saveGame]);
  
  // Функция экстренного сохранения (критический приоритет)
  const criticalSave = useCallback(async (): Promise<SaveResult> => {
    return saveGame(SavePriority.CRITICAL);
  }, [saveGame]);
  
  // Функция автосохранения
  const autoSaveHandler = useCallback(async () => {
    if (autoSave && isInitialized && userId) {
      const now = Date.now();
      
      // Проверяем, прошло ли достаточно времени с последнего сохранения
      if (now - lastSaveTime >= autoSaveInterval) {
        await saveGame(SavePriority.LOW);
      }
    }
  }, [autoSave, isInitialized, userId, lastSaveTime, autoSaveInterval, saveGame]);
  
  // Настраиваем автосохранение
  useEffect(() => {
    if (autoSave && isInitialized && userId) {
      // Очищаем предыдущий таймер если есть
      if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
      }
      
      // Создаем новый таймер
      const timer = setInterval(autoSaveHandler, Math.min(30000, autoSaveInterval / 2));
      setAutoSaveTimer(timer);
      
      // Создаем обработчик события перед выгрузкой страницы
      let backupCreated = false;
      const handleBeforeUnload = () => {
        if (backupCreated) return null;
        
        // Устанавливаем флаг для предотвращения повторных вызовов
        backupCreated = true;
        
        // Получаем текущее состояние
        const gameState = getGameState();
        
        // Создаем экстренную резервную копию
        createEmergencyBackup(userId, gameState);
        
        // Возвращаем null, чтобы не блокировать закрытие страницы
        return null;
      };
      
      // Регистрируем обработчик
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      // Очистка при размонтировании
      return () => {
        clearInterval(timer);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    } else if (autoSaveTimer) {
      // Если автосохранение отключено, очищаем таймер
      clearInterval(autoSaveTimer);
      setAutoSaveTimer(null);
    }
    
    return undefined;
  }, [autoSave, isInitialized, userId, autoSaveInterval, autoSaveHandler, getGameState, createEmergencyBackup]);
  
  // Возвращаем методы и состояние сохранения
  return {
    saveGame,       // Обычное сохранение
    forceSave,      // Форсированное сохранение (высокий приоритет)
    criticalSave,   // Критическое сохранение (максимальный приоритет)
    isSaving,       // Флаг процесса сохранения
    lastSaveTime,   // Время последнего сохранения
    lastSaveResult, // Результат последнего сохранения
    isInitialized   // Флаг инициализации системы сохранений
  };
} 