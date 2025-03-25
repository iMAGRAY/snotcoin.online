"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { SaveSystem } from '../services/saveSystem';
import { GameState } from '../types/gameTypes';
import { useGameContext } from '../contexts/GameContext';

interface SaveContextType {
  saveGame: (options?: { forceFull?: boolean }) => Promise<boolean>;
  loadGame: () => Promise<GameState | null>;
  isSaving: boolean;
  lastSaved: Date | null;
  resetGame: () => Promise<GameState>;
}

// Создаем контекст с начальными значениями
const SaveContext = createContext<SaveContextType>({
  saveGame: async () => false,
  loadGame: async () => null,
  isSaving: false,
  lastSaved: null,
  resetGame: async () => ({} as GameState)
});

// Хук для использования контекста
export const useSaveContext = () => useContext(SaveContext);

export const SaveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Состояние сохранения
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveSystem] = useState(() => new SaveSystem());
  
  // Доступ к состоянию игры и диспетчеру
  const { state, dispatch } = useGameContext();
  
  // Функция загрузки игры (объявляем до эффектов, использующих её)
  const loadGame = useCallback(async (): Promise<GameState | null> => {
    if (!saveSystem.isInitialized()) {
      console.warn('Система сохранения не инициализирована');
      return null;
    }
    
    try {
      const savedState = await saveSystem.load();
      
      if (savedState) {
        // Обновляем состояние игры через диспетчер
        dispatch({ type: "LOAD_GAME_STATE", payload: savedState });
        return savedState;
      }
      
      return null;
    } catch (error) {
      console.error('Ошибка при загрузке игры:', error);
      return null;
    }
  }, [dispatch, saveSystem]);
  
  // Функция сохранения игры (объявляем до эффектов, использующих её)
  const saveGame = useCallback(async (options = {}): Promise<boolean> => {
    if (!saveSystem.isInitialized()) {
      console.warn('Система сохранения не инициализирована');
      return false;
    }
    
    setIsSaving(true);
    
    try {
      const success = await saveSystem.save(state, options);
      
      if (success) {
        setLastSaved(new Date());
      }
      
      return success;
    } catch (error) {
      console.error('Ошибка при сохранении игры:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [state, saveSystem]);
  
  // Инициализация системы сохранения
  useEffect(() => {
    if (state.user?.farcaster_fid || state.user?.fid) {
      // Используем farcaster_fid как идентификатор для сохранений
      saveSystem.setUserData(
        (state.user.farcaster_fid || state.user.fid || '').toString(),
        state.user.id || ""
      );
      
      // Запускаем автосохранение через систему сохранения
      saveSystem.startAutoSave();
      
      // Загружаем сохраненную игру при инициализации
      loadGame().then(loadedState => {
        if (loadedState) {
          console.log('Игра успешно загружена');
        }
      }).catch(err => {
        console.error('Ошибка при загрузке игры:', err);
      });
      
      return () => {
        // Останавливаем автосохранение при размонтировании
        saveSystem.stopAutoSave();
      };
    }
  }, [state.user?.farcaster_fid, state.user?.fid, state.user?.id, loadGame]);
  
  // Сохраняем при выходе со страницы
  useEffect(() => {
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      if (saveSystem.isInitialized()) {
        // Предотвращаем стандартное поведение браузера, чтобы успеть сохранить данные
        event.preventDefault();
        
        try {
          // Пытаемся сохранить игру перед выходом
          await saveGame({ forceFull: true });
        } catch (error) {
          console.error('Ошибка при сохранении игры перед выходом:', error);
        }
        
        // В современных браузерах это сообщение игнорируется, но нужно для старых
        event.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveGame]);
  
  // Сброс игры до начального состояния
  const resetGame = useCallback(async (): Promise<GameState> => {
    if (!saveSystem.isInitialized()) {
      throw new Error('Система сохранения не инициализирована');
    }
    
    try {
      const initialState = await saveSystem.resetToInitial();
      
      if (initialState) {
        // Обновляем состояние игры через диспетчер
        dispatch({ type: "LOAD_GAME_STATE", payload: initialState });
        return initialState;
      }
      
      throw new Error('Не удалось сбросить игру');
    } catch (error) {
      console.error('Ошибка при сбросе игры:', error);
      throw error;
    }
  }, [dispatch, saveSystem]);
  
  // Сохраняем контекст
  const contextValue = {
    saveGame,
    loadGame,
    isSaving,
    lastSaved,
    resetGame
  };
  
  return (
    <SaveContext.Provider value={contextValue}>
      {children}
    </SaveContext.Provider>
  );
}; 