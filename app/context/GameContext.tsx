import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { createInitialGameState } from '../constants/gameConstants';
import { ExtendedGameState } from '../types/gameTypes';
import { saveGameState, loadGameState } from '../services/storage';

// Интерфейс контекста игры
interface GameContextType {
  gameState: ExtendedGameState;
  setGameState: React.Dispatch<React.SetStateAction<ExtendedGameState>>;
  updateGameState: (updates: Partial<ExtendedGameState>) => void;
  resetGameState: () => void;
}

// Создаем контекст с начальными значениями
const GameContext = createContext<GameContextType | null>(null);

// Хук для использования контекста игры
export const useGameState = (): GameContextType => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameState должен использоваться внутри GameProvider');
  }
  return context;
};

// Пропсы для провайдера
interface GameProviderProps {
  children: ReactNode;
  initialState?: ExtendedGameState;
  userId?: string;
  provider?: string;
}

// Провайдер контекста игры
export const GameProvider: React.FC<GameProviderProps> = ({ 
  children, 
  initialState,
  userId,
  provider
}) => {
  // Инициализируем состояние игры
  const [gameState, setGameState] = useState<ExtendedGameState>(() => {
    // Пытаемся загрузить сохраненное состояние
    const savedState = loadGameState();
    if (savedState) {
      return savedState;
    }
    
    // Используем переданное начальное состояние или создаем новое
    const state = initialState || createInitialGameState(userId || 'unknown') as ExtendedGameState;
    
    // Добавляем userId и provider, если они предоставлены
    if (userId && !state._userId) {
      state._userId = userId;
    }
    
    if (provider && !state._provider) {
      state._provider = provider;
    }
    
    return state;
  });
  
  // Функция для частичного обновления состояния
  const updateGameState = (updates: Partial<ExtendedGameState>) => {
    setGameState((currentState: ExtendedGameState) => {
      const updatedState = {
        ...currentState,
        ...updates,
        _lastModified: Date.now()
      };
      
      // Сохраняем обновленное состояние
      saveGameState(updatedState);
      
      return updatedState;
    });
  };
  
  // Функция для сброса состояния
  const resetGameState = () => {
    const newState = createInitialGameState(userId || 'unknown') as ExtendedGameState;
    setGameState(newState);
    saveGameState(newState);
  };
  
  // Обновляем userId в состоянии игры при его изменении
  useEffect(() => {
    if (userId && gameState._userId !== userId) {
      updateGameState({ _userId: userId });
    }
  }, [userId, gameState._userId]);
  
  // Обновляем provider в состоянии игры при его изменении
  useEffect(() => {
    if (provider && gameState._provider !== provider) {
      updateGameState({ _provider: provider });
    }
  }, [provider, gameState._provider]);
  
  return (
    <GameContext.Provider value={{ 
      gameState, 
      setGameState, 
      updateGameState,
      resetGameState
    }}>
      {children}
    </GameContext.Provider>
  );
};

export default GameProvider; 