'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { saveManager } from '../services/saveSystem/index';
import { LoadResult, SaveResult } from '../services/saveSystem/types';
import { ExtendedGameState } from '../types/gameTypes';

// Создаем контекст для менеджера сохранений
interface SaveManagerContextType {
  isInitialized: boolean;
  isSaving: boolean;
  isLoading: boolean;
  lastSaveResult: SaveResult | null;
  lastLoadResult: LoadResult | null;
  save: (userId: string, state: ExtendedGameState) => Promise<SaveResult>;
  load: (userId: string) => Promise<LoadResult>;
  createEmergencyBackup: (userId: string, state: ExtendedGameState) => void;
  deleteUserData: (userId: string) => Promise<boolean>;
}

// Значение контекста по умолчанию
const SaveManagerContext = createContext<SaveManagerContextType>({
  isInitialized: false,
  isSaving: false,
  isLoading: false,
  lastSaveResult: null,
  lastLoadResult: null,
  save: async () => ({ success: false, timestamp: Date.now(), error: 'Система сохранений не инициализирована' }),
  load: async () => ({ success: false, timestamp: Date.now(), error: 'Система сохранений не инициализирована' }),
  createEmergencyBackup: () => {},
  deleteUserData: async () => false
});

// Хук для использования контекста
export const useSaveManager = () => useContext(SaveManagerContext);

// Провайдер контекста
export const SaveManagerProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  // Используем глобальный экземпляр saveManager
  const saveManagerRef = useRef(saveManager);
  
  // Состояние для отслеживания инициализации и операций
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastSaveResult, setLastSaveResult] = useState<SaveResult | null>(null);
  const [lastLoadResult, setLastLoadResult] = useState<LoadResult | null>(null);
  
  // Инициализация менеджера сохранений при монтировании
  useEffect(() => {
    let mounted = true;
    const saveManager = saveManagerRef.current;
    
    const initialize = async () => {
      try {
        const result = await saveManager.initialize();
        if (mounted) {
          setIsInitialized(result);
        }
      } catch (error) {
        console.error('Ошибка инициализации системы сохранений:', error);
        if (mounted) {
          setIsInitialized(false);
        }
      }
    };
    
    initialize();
    
    // Очистка при размонтировании
    return () => {
      mounted = false;
    };
  }, []);
  
  // Функция сохранения с отслеживанием состояния
  const save = async (userId: string, state: ExtendedGameState): Promise<SaveResult> => {
    setIsSaving(true);
    const saveManager = saveManagerRef.current;
    
    try {
      const result = await saveManager.save(userId, state);
      setLastSaveResult(result);
      return result;
    } catch (error) {
      const errorResult: SaveResult = {
        success: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
      setLastSaveResult(errorResult);
      return errorResult;
    } finally {
      setIsSaving(false);
    }
  };
  
  // Функция загрузки с отслеживанием состояния
  const load = async (userId: string): Promise<LoadResult> => {
    setIsLoading(true);
    const saveManager = saveManagerRef.current;
    
    try {
      const result = await saveManager.load(userId);
      setLastLoadResult(result);
      return result;
    } catch (error) {
      const errorResult: LoadResult = {
        success: false,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
      setLastLoadResult(errorResult);
      return errorResult;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Функция создания экстренной резервной копии
  const createEmergencyBackup = (userId: string, state: ExtendedGameState): void => {
    const saveManager = saveManagerRef.current;
    
    try {
      saveManager.createEmergencyBackup(userId, state);
    } catch (error) {
      console.error('Ошибка при создании экстренной копии:', error);
    }
  };
  
  // Функция удаления данных пользователя
  const deleteUserData = async (userId: string): Promise<boolean> => {
    const saveManager = saveManagerRef.current;
    
    try {
      return await saveManager.deleteUserData(userId);
    } catch (error) {
      console.error('Ошибка при удалении данных:', error);
      return false;
    }
  };
  
  // Значение контекста
  const contextValue: SaveManagerContextType = {
    isInitialized,
    isSaving,
    isLoading,
    lastSaveResult,
    lastLoadResult,
    save,
    load,
    createEmergencyBackup,
    deleteUserData
  };
  
  return (
    <SaveManagerContext.Provider value={contextValue}>
      {children}
    </SaveManagerContext.Provider>
  );
};

export default SaveManagerProvider; 