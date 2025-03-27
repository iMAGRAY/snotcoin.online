import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { createInitialGameState } from '../constants/gameConstants';

// Тип для состояния игры
export interface GameState {
  _userId?: string;
  _provider?: string;
  _saveVersion?: number;
  _lastSaved?: string;
  _saveReason?: string;
  _lastModified?: number;
  _createdAt?: string;
  _batchId?: string;
  _batchSize?: number;
  _isBeforeUnloadSave?: boolean;
  [key: string]: any;
}

// Интерфейс контекста игры
interface GameContextType {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  updateGameState: (updates: Partial<GameState>) => void;
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
  initialState?: GameState;
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
  const [gameState, setGameState] = useState<GameState>(() => {
    // Используем переданное начальное состояние или создаем новое
    const state = initialState || createInitialGameState(userId || 'unknown');
    
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
  const updateGameState = (updates: Partial<GameState>) => {
    setGameState(currentState => ({
      ...currentState,
      ...updates,
      _lastModified: Date.now()
    }));
  };
  
  // Функция для сброса состояния
  const resetGameState = () => {
    setGameState(createInitialGameState(userId || 'unknown'));
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