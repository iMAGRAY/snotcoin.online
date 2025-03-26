"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SaveSystem, SaveSystemOptions, SaveResult, SaveInfo } from '../services/saveSystem';
import { ExtendedGameState } from '../types/gameTypes';
import { useGameContext } from './game/hooks';

/**
 * Интерфейс контекста сохранения
 */
interface SaveContextType {
  // Система сохранения
  saveSystem: SaveSystem | null;
  
  // Состояние инициализации
  isInitialized: boolean;
  isInitializing: boolean;
  
  // Состояние сохранения
  isSaving: boolean;
  isLoading: boolean;
  
  // Результаты операций
  lastSaveResult: SaveResult | null;
  lastLoadResult: SaveResult | null;
  
  // Информация о сохранениях
  saveInfo: SaveInfo | null;
  
  // Методы
  saveState: (state: ExtendedGameState) => Promise<SaveResult>;
  loadState: () => Promise<SaveResult>;
  resetAllData: () => Promise<SaveResult>;
  exportStateToString: () => Promise<string | null>;
  importStateFromString: (exportedState: string) => Promise<SaveResult>;
  
  // Опции
  setAutoSave: (enabled: boolean) => void;
  setSyncWithServer: (enabled: boolean) => void;
}

/**
 * Контекст сохранения
 */
export const SaveContext = createContext<SaveContextType | undefined>(undefined);

/**
 * Хук для использования контекста сохранения
 */
export const useSaveContext = (): SaveContextType => {
  const context = useContext(SaveContext);
  
  if (!context) {
    throw new Error('useSaveContext must be used within a SaveProvider');
  }
  
  return context;
};

/**
 * Свойства провайдера сохранения
 */
interface SaveProviderProps {
  children: ReactNode;
  userId: string;
  options?: Partial<SaveSystemOptions>;
}

/**
 * Провайдер контекста сохранения
 */
export const SaveProvider: React.FC<SaveProviderProps> = ({
  children,
  userId,
  options
}) => {
  // Состояние системы сохранения
  const [saveSystem, setSaveSystem] = useState<SaveSystem | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  
  // Состояние операций
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Результаты операций
  const [lastSaveResult, setLastSaveResult] = useState<SaveResult | null>(null);
  const [lastLoadResult, setLastLoadResult] = useState<SaveResult | null>(null);
  
  // Информация о сохранениях
  const [saveInfo, setSaveInfo] = useState<SaveInfo | null>(null);
  
  // Доступ к состоянию игры и диспетчеру
  const { state, dispatch } = useGameContext();
  
  // Инициализируем систему сохранения при монтировании компонента
  useEffect(() => {
    // Проверяем, имеем ли мы пользователя
    if (!userId) {
      console.warn('[SaveContext] userId не указан, система сохранения не инициализирована');
      return;
    }
    
    // Создаем и инициализируем систему сохранения
    const initializeSaveSystem = async () => {
      try {
        setIsInitializing(true);
        
        // Создаем систему сохранения с указанными опциями
        const saveSystemInstance = new SaveSystem(userId, options);
        setSaveSystem(saveSystemInstance);
        
        // Инициализируем систему сохранения
        const initResult = await saveSystemInstance.initialize();
        setLastLoadResult(initResult);
        
        // Получаем информацию о сохранениях
        const info = await saveSystemInstance.getSaveInfo();
        setSaveInfo(info);
        
        setIsInitialized(true);
      } catch (error) {
        console.error('[SaveContext] Ошибка инициализации системы сохранения:', error);
      } finally {
        setIsInitializing(false);
      }
    };
    
    initializeSaveSystem();
    
    // Очистка при размонтировании
    return () => {
      if (saveSystem) {
        saveSystem.destroy();
      }
    };
  }, [userId, options]);
  
  // Обновляем информацию о сохранении после сохранения
  useEffect(() => {
    if (saveSystem && isInitialized && lastSaveResult?.success) {
      saveSystem.getSaveInfo().then(info => {
        setSaveInfo(info);
      });
    }
  }, [saveSystem, isInitialized, lastSaveResult]);
  
  /**
   * Сохраняет состояние игры
   * @param state Состояние для сохранения
   * @returns Результат сохранения
   */
  const saveState = async (state: ExtendedGameState): Promise<SaveResult> => {
    if (!saveSystem || !isInitialized) {
      const errorResult: SaveResult = {
        success: false,
        message: "Система сохранения не инициализирована",
        error: "SaveSystem не инициализирована",
        timestamp: Date.now(),
        metrics: { duration: 0 }
      };
      setLastSaveResult(errorResult);
      return errorResult;
    }
    
    try {
      setIsSaving(true);
      
      // Сохраняем состояние
      const result = await saveSystem.save(state);
      setLastSaveResult(result);
      
      // Обновляем информацию о сохранениях
      const info = await saveSystem.getSaveInfo();
      setSaveInfo(info);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const errorResult: SaveResult = {
        success: false,
        message: "Ошибка при сохранении состояния",
        error: errorMessage,
        timestamp: Date.now(),
        metrics: { duration: 0 }
      };
      
      setLastSaveResult(errorResult);
      return errorResult;
    } finally {
      setIsSaving(false);
    }
  };
  
  /**
   * Загружает состояние игры
   * @returns Результат загрузки
   */
  const loadState = async (): Promise<SaveResult> => {
    if (!saveSystem || !isInitialized) {
      const errorResult: SaveResult = {
        success: false,
        message: "Система сохранения не инициализирована",
        error: "SaveSystem не инициализирована",
        timestamp: Date.now(),
        metrics: { duration: 0 }
      };
      setLastLoadResult(errorResult);
      return errorResult;
    }
    
    try {
      setIsLoading(true);
      
      // Загружаем состояние
      const result = await saveSystem.load();
      setLastLoadResult(result);
      
      // Обновляем информацию о сохранениях
      const info = await saveSystem.getSaveInfo();
      setSaveInfo(info);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const errorResult: SaveResult = {
        success: false,
        message: "Ошибка при загрузке состояния",
        error: errorMessage,
        timestamp: Date.now(),
        metrics: { duration: 0 }
      };
      
      setLastLoadResult(errorResult);
      return errorResult;
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Сбрасывает все данные
   * @returns Результат операции
   */
  const resetAllData = async (): Promise<SaveResult> => {
    if (!saveSystem || !isInitialized) {
      const errorResult: SaveResult = {
        success: false,
        message: "Система сохранения не инициализирована",
        error: "SaveSystem не инициализирована",
        timestamp: Date.now(),
        metrics: { duration: 0 }
      };
      return errorResult;
    }
    
    try {
      // Очищаем все данные
      const result = await saveSystem.resetAll();
      
      // Обновляем информацию о сохранениях
      const info = await saveSystem.getSaveInfo();
      setSaveInfo(info);
      
      // Загружаем новое состояние (будет создано по умолчанию)
      const loadResult = await saveSystem.load();
      setLastLoadResult(loadResult);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        message: "Ошибка при сбросе данных",
        error: errorMessage,
        timestamp: Date.now(),
        metrics: { duration: 0 }
      };
    }
  };
  
  /**
   * Экспортирует состояние в строку
   * @returns Строка с экспортированным состоянием или null
   */
  const exportStateToString = async (): Promise<string | null> => {
    if (!saveSystem || !isInitialized) {
      return null;
    }
    
    return await saveSystem.exportToString();
  };
  
  /**
   * Импортирует состояние из строки
   * @param exportedState Строка с экспортированным состоянием
   * @returns Результат операции
   */
  const importStateFromString = async (exportedState: string): Promise<SaveResult> => {
    if (!saveSystem || !isInitialized) {
      const errorResult: SaveResult = {
        success: false,
        message: "Система сохранения не инициализирована",
        error: "SaveSystem не инициализирована",
        timestamp: Date.now(),
        metrics: { duration: 0 }
      };
      return errorResult;
    }
    
    try {
      // Импортируем состояние
      const result = await saveSystem.importFromString(exportedState);
      setLastLoadResult(result);
      
      // Обновляем информацию о сохранениях
      const info = await saveSystem.getSaveInfo();
      setSaveInfo(info);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        message: "Ошибка при импорте состояния",
        error: errorMessage,
        timestamp: Date.now(),
        metrics: { duration: 0 }
      };
    }
  };
  
  /**
   * Включает или выключает автосохранение
   * @param enabled Включено ли автосохранение
   */
  const setAutoSave = (enabled: boolean): void => {
    if (saveSystem && isInitialized) {
      saveSystem.setAutoSave(enabled);
    }
  };
  
  /**
   * Включает или выключает синхронизацию с сервером
   * @param enabled Включена ли синхронизация
   */
  const setSyncWithServer = (enabled: boolean): void => {
    if (saveSystem && isInitialized) {
      saveSystem.setSyncWithServer(enabled);
    }
  };
  
  // Значение контекста
  const contextValue: SaveContextType = {
    saveSystem,
    isInitialized,
    isInitializing,
    isSaving,
    isLoading,
    lastSaveResult,
    lastLoadResult,
    saveInfo,
    saveState,
    loadState,
    resetAllData,
    exportStateToString,
    importStateFromString,
    setAutoSave,
    setSyncWithServer
  };
  
  return (
    <SaveContext.Provider value={contextValue}>
      {children}
    </SaveContext.Provider>
  );
}; 