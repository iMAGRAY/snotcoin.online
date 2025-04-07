'use client';

import { useCallback, useState } from 'react';
import { useSaveManager } from '../contexts/SaveManagerProvider';
import { ExtendedGameState } from '../types/gameTypes';
import { LoadResult } from '../services/saveSystem/types';

interface UseLoadGameOptions {
  /**
   * ID пользователя
   */
  userId: string;
  
  /**
   * Функция для обработки загруженного состояния
   */
  onLoadSuccess?: (state: ExtendedGameState) => void;
  
  /**
   * Обработчик ошибки загрузки
   */
  onLoadError?: (result: LoadResult) => void;
  
  /**
   * Автоматически загружать при инициализации хука
   * @default false
   */
  autoLoad?: boolean;
}

export function useLoadGame({
  userId,
  onLoadSuccess,
  onLoadError,
  autoLoad = false
}: UseLoadGameOptions) {
  // Получаем менеджер сохранений из контекста
  const { load, isInitialized } = useSaveManager();
  
  // Состояние для отслеживания операций загрузки
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadedState, setLoadedState] = useState<ExtendedGameState | null>(null);
  const [lastLoadResult, setLastLoadResult] = useState<LoadResult | null>(null);
  
  // Функция загрузки состояния
  const loadGame = useCallback(async (): Promise<LoadResult> => {
    if (!isInitialized || !userId) {
      const result: LoadResult = {
        success: false,
        timestamp: Date.now(),
        error: !isInitialized 
          ? 'Система сохранений не инициализирована' 
          : 'ID пользователя не указан'
      };
      
      setLastLoadResult(result);
      onLoadError?.(result);
      
      return result;
    }
    
    try {
      setIsLoading(true);
      
      // Загружаем состояние
      const result = await load(userId);
      
      // Обновляем состояние
      setLastLoadResult(result);
      
      // Если успешно загружено и есть данные
      if (result.success && result.data) {
        setLoadedState(result.data);
        onLoadSuccess?.(result.data);
      } else {
        onLoadError?.(result);
      }
      
      return result;
    } catch (error) {
      const errorResult: LoadResult = {
        success: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
      
      setLastLoadResult(errorResult);
      onLoadError?.(errorResult);
      
      return errorResult;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, userId, load, onLoadSuccess, onLoadError]);
  
  // Автоматическая загрузка при инициализации
  useState(() => {
    if (autoLoad && isInitialized && userId) {
      loadGame();
    }
  });
  
  // Возвращаем методы и состояние загрузки
  return {
    loadGame,       // Функция загрузки
    isLoading,      // Флаг процесса загрузки
    loadedState,    // Загруженное состояние
    lastLoadResult, // Результат последней загрузки
    isInitialized   // Флаг инициализации системы сохранений
  };
} 