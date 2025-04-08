'use client';

import { useContext, useCallback } from 'react';
import { GameContext } from '../contexts/game/GameContext';

/**
 * Хук для работы со snot (соплями)
 * @returns Объект с данными о snot и методами для работы с ними
 */
export const useSnot = () => {
  const gameContext = useContext(GameContext);
  
  // Убеждаемся, что контекст и необходимые данные доступны
  if (!gameContext) {
    // Вместо выбрасывания ошибки, возвращаем объект-заглушку
    console.warn('useSnot: GameContext не доступен');
    
    return {
      snot: 0,
      getSnot: () => 0,
      addSnot: () => {},
      setSnot: () => {},
      resetContainerSnot: () => false,
      collectContainerSnot: () => false
    };
  }
  
  const { state, dispatch } = gameContext;
  
  const getSnot = useCallback(() => {
    return state?.inventory?.snot || 0;
  }, [state]);
  
  const addSnot = useCallback((amount: number) => {
    if (!dispatch || !state || !state.inventory) return;
    
    dispatch({
      type: 'UPDATE_INVENTORY',
      payload: {
        snot: state.inventory.snot + amount
      }
    });
  }, [state, dispatch]);
  
  const setSnot = useCallback((value: number) => {
    if (!dispatch || !state || !state.inventory) return;
    
    dispatch({
      type: 'UPDATE_INVENTORY',
      payload: {
        snot: value
      }
    });
  }, [state, dispatch]);
  
  const resetContainerSnot = useCallback(() => {
    if (!dispatch || !state || !state.inventory) return false;
    
    dispatch({
      type: 'UPDATE_INVENTORY',
      payload: {
        containerSnot: 0
      }
    });
    
    return true;
  }, [state, dispatch]);
  
  const collectContainerSnot = useCallback(() => {
    if (!dispatch || !state || !state.inventory) return false;
    
    const containerSnot = state.inventory.containerSnot || 0;
    if (containerSnot <= 0) return false;
    
    // Добавляем snot и сбрасываем containerSnot
    dispatch({
      type: 'UPDATE_INVENTORY',
      payload: {
        snot: state.inventory.snot + containerSnot,
        containerSnot: 0
      }
    });
    
    return true;
  }, [state, dispatch]);
  
  return {
    snot: getSnot(),
    getSnot,
    addSnot,
    setSnot,
    resetContainerSnot,
    collectContainerSnot
  };
}; 