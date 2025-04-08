"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SaveSystem, SaveResult, SaveInfo } from '../services/saveSystem';
import { ExtendedGameState } from '../types/gameTypes';

// Расширим тип SaveResult для внутреннего использования
type EnhancedSaveResult = SaveResult & {
  source?: string;
  isNewUser?: boolean;
  wasRepaired?: boolean;
  dataSize?: number;
  duration?: number;
};

// Приоритеты сохранения (определим здесь, чтобы избежать проблем с импортом)
export enum SavePriority {
  LOW = 'low',           // Низкий приоритет
  MEDIUM = 'medium',     // Средний приоритет
  HIGH = 'high',         // Высокий приоритет
  CRITICAL = 'critical'  // Критический приоритет
}

// Интерфейс контекста менеджера сохранений
interface SaveManagerContextType {
  // Состояние
  isInitialized: boolean;
  isLoading: boolean;
  isSaving: boolean;
  lastSaveResult: EnhancedSaveResult | null;
  lastLoadResult: EnhancedSaveResult | null;

  // Методы для управления сохранениями
  save: (userId: string, state: ExtendedGameState, priority?: SavePriority) => Promise<EnhancedSaveResult>;
  load: (userId: string) => Promise<EnhancedSaveResult>;
  createEmergencyBackup: (userId: string, state: ExtendedGameState) => void;
  exportToString: (userId: string, state: ExtendedGameState) => Promise<string | null>;
  importFromString: (userId: string, saveData: string) => Promise<EnhancedSaveResult>;
}

// Создаем контекст
const SaveManagerContext = createContext<SaveManagerContextType | null>(null);

// Свойства провайдера
interface SaveManagerProviderProps {
  children: ReactNode;
}

// Префикс для экстренных сохранений
const EMERGENCY_SAVE_PREFIX = 'emergency_save_';

/**
 * Провайдер для управления сохранениями игры
 */
export const SaveManagerProvider: React.FC<SaveManagerProviderProps> = ({ children }) => {
  // Состояние операций сохранения
  const [isInitialized, setIsInitialized] = useState<boolean>(true); // Всегда инициализировано при использовании localStorage
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaveResult, setLastSaveResult] = useState<EnhancedSaveResult | null>(null);
  const [lastLoadResult, setLastLoadResult] = useState<EnhancedSaveResult | null>(null);

  // Создаем локальные экземпляры SaveSystem по требованию
  const getSaveSystem = (userId: string) => {
    return new SaveSystem(userId);
  };

  /**
   * Сохраняет состояние игры
   */
  const save = async (
    userId: string, 
    state: ExtendedGameState, 
    priority: SavePriority = SavePriority.MEDIUM
  ): Promise<EnhancedSaveResult> => {
    if (!userId) {
      return {
        success: false,
        error: "ID пользователя не указан",
        message: "Невозможно сохранить: не указан ID пользователя",
        timestamp: Date.now(),
        metrics: { duration: 0 },
        source: "none"
      };
    }

    try {
      setIsSaving(true);
      const startTime = Date.now();
      const saveSystem = getSaveSystem(userId);
      const result = await saveSystem.save(state);
      const duration = Date.now() - startTime;
      
      // Добавляем дополнительные поля для совместимости
      const enhancedResult: EnhancedSaveResult = {
        ...result,
        source: "localStorage",
        duration: duration,
        dataSize: result.metrics?.dataSize || 0
      };
      
      setLastSaveResult(enhancedResult);
      return enhancedResult;
    } catch (error) {
      const errorResult: EnhancedSaveResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: "Ошибка при сохранении",
        timestamp: Date.now(),
        metrics: { duration: 0 },
        source: "error"
      };
      setLastSaveResult(errorResult);
      return errorResult;
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Загружает состояние игры
   */
  const load = async (userId: string): Promise<EnhancedSaveResult> => {
    if (!userId) {
      return {
        success: false,
        error: "ID пользователя не указан",
        message: "Невозможно загрузить: не указан ID пользователя",
        timestamp: Date.now(),
        metrics: { duration: 0 },
        source: "none",
        isNewUser: true
      };
    }

    try {
      setIsLoading(true);
      const startTime = Date.now();
      const saveSystem = getSaveSystem(userId);
      const result = await saveSystem.load();
      const duration = Date.now() - startTime;
      
      // Добавляем дополнительные поля для совместимости
      const enhancedResult: EnhancedSaveResult = {
        ...result,
        source: "localStorage",
        isNewUser: !result.success || !result.data,
        wasRepaired: false,
        duration: duration,
        dataSize: result.metrics?.dataSize || 0
      };
      
      setLastLoadResult(enhancedResult);
      return enhancedResult;
    } catch (error) {
      const errorResult: EnhancedSaveResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: "Ошибка при загрузке",
        timestamp: Date.now(),
        metrics: { duration: 0 },
        source: "error",
        isNewUser: true
      };
      setLastLoadResult(errorResult);
      return errorResult;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Создаёт экстренную резервную копию состояния игры
   */
  const createEmergencyBackup = (userId: string, state: ExtendedGameState): void => {
    if (!userId) {
      console.error("[SaveManager] Не удалось создать экстренную копию: не указан ID пользователя");
      return;
    }

    try {
      if (typeof localStorage !== 'undefined') {
        // Создаем ключ для экстренного сохранения
        const emergencyKey = `${EMERGENCY_SAVE_PREFIX}${userId}`;
        
        // Сохраняем состояние с временной меткой
        localStorage.setItem(emergencyKey, JSON.stringify({
          state,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error("[SaveManager] Ошибка при создании экстренной копии:", error);
    }
  };

  /**
   * Экспортирует состояние игры в строку
   */
  const exportToString = async (userId: string, state: ExtendedGameState): Promise<string | null> => {
    if (!userId) {
      return null;
    }

    try {
      const saveSystem = getSaveSystem(userId);
      return saveSystem.exportToString();
    } catch (error) {
      console.error("[SaveManager] Ошибка при экспорте:", error);
      return null;
    }
  };

  /**
   * Импортирует состояние игры из строки
   */
  const importFromString = async (userId: string, saveData: string): Promise<EnhancedSaveResult> => {
    if (!userId) {
      return {
        success: false,
        error: "ID пользователя не указан",
        message: "Невозможно импортировать: не указан ID пользователя",
        timestamp: Date.now(),
        metrics: { duration: 0 },
        source: "none"
      };
    }

    try {
      setIsLoading(true);
      const startTime = Date.now();
      const saveSystem = getSaveSystem(userId);
      const result = await saveSystem.importFromString(saveData);
      const duration = Date.now() - startTime;
      
      // Добавляем дополнительные поля для совместимости
      const enhancedResult: EnhancedSaveResult = {
        ...result,
        source: "import",
        duration: duration,
        dataSize: result.metrics?.dataSize || 0
      };
      
      setLastLoadResult(enhancedResult);
      return enhancedResult;
    } catch (error) {
      const errorResult: EnhancedSaveResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: "Ошибка при импорте",
        timestamp: Date.now(),
        metrics: { duration: 0 },
        source: "error"
      };
      setLastLoadResult(errorResult);
      return errorResult;
    } finally {
      setIsLoading(false);
    }
  };

  // Значение контекста
  const contextValue: SaveManagerContextType = {
    isInitialized,
    isLoading,
    isSaving,
    lastSaveResult,
    lastLoadResult,
    save,
    load,
    createEmergencyBackup,
    exportToString,
    importFromString
  };

  return (
    <SaveManagerContext.Provider value={contextValue}>
      {children}
    </SaveManagerContext.Provider>
  );
};

/**
 * Хук для использования менеджера сохранений
 */
export const useSaveManager = (): SaveManagerContextType => {
  const context = useContext(SaveManagerContext);
  
  if (!context) {
    throw new Error('useSaveManager должен использоваться внутри SaveManagerProvider');
  }
  
  return context;
}; 