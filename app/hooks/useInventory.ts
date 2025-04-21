'use client';

import { useContext } from 'react';
import { GameContext } from '../contexts/game/GameContext';

/**
 * Хук для работы с инвентарем
 * @returns {Object} - объект с данными инвентаря и методами для их изменения
 */
export const useInventory = () => {
  const { state, dispatch } = useContext(GameContext);

  if (!state || !state.inventory) {
    throw new Error('useInventory должен использоваться внутри GameProvider');
  }

  const { inventory } = state;

  /**
   * Добавляет сопли (snot) в инвентарь
   * @param amount - количество соплей для добавления
   */
  const addSnot = (amount: number) => {
    dispatch({
      type: 'UPDATE_INVENTORY',
      payload: {
        snot: inventory.snot + amount
      }
    });
  };

  /**
   * Добавляет монеты (kingCoins) в инвентарь
   * @param amount - количество монет для добавления
   */
  const addKingCoins = (amount: number) => {
    dispatch({
      type: 'UPDATE_INVENTORY',
      payload: {
        kingCoins: inventory.kingCoins + amount
      }
    });
  };

  /**
   * Тратит монеты (kingCoins) из инвентаря
   * @param amount - количество монет для траты
   * @returns {boolean} - true если монеты успешно потрачены, false если недостаточно монет
   */
  const spendKingCoins = (amount: number): boolean => {
    if (inventory.kingCoins >= amount) {
      dispatch({
        type: 'UPDATE_INVENTORY',
        payload: {
          kingCoins: inventory.kingCoins - amount
        }
      });
      return true;
    }
    return false;
  };

  /**
   * Обновляет вместимость контейнера
   * @param capacity - новая вместимость контейнера
   * @param level - новый уровень вместимости контейнера
   */
  const updateContainerCapacity = (capacity: number, level: number) => {
    dispatch({
      type: 'UPDATE_INVENTORY',
      payload: {
        containerCapacity: capacity,
        containerCapacityLevel: level
      }
    });
  };

  /**
   * Обновляет скорость наполнения контейнера
   * @param speed - новая скорость наполнения
   * @param level - новый уровень скорости наполнения
   */
  const updateFillingSpeed = (speed: number, level: number) => {
    dispatch({
      type: 'UPDATE_INVENTORY',
      payload: {
        fillingSpeed: speed,
        fillingSpeedLevel: level
      }
    });
  };

  return {
    inventory,
    addSnot,
    addKingCoins,
    spendKingCoins,
    updateContainerCapacity,
    updateFillingSpeed
  };
}; 