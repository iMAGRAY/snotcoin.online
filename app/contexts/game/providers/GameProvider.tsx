'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { GameStateContext, SetGameStateContext } from '../contexts'
import { GameState, ExtendedGameState, createInitialGameState } from '../../../types/gameTypes'
import { updateResourcesBasedOnTimePassed } from '../../../utils/resourceUtils'
import { getFillingSpeedByLevel } from '../../../utils/gameUtils'

interface GameProviderProps {
  children: React.ReactNode
  userId?: string
}

/**
 * Создает дефолтное состояние игры
 */
function createDefaultGameState(userId: string): GameState {
  return {
    _userId: userId,
    inventory: {
      snot: 0,
      snotCoins: 0,
      containerCapacity: 1,
      containerSnot: 0.05,
      fillingSpeed: 0.01,
      containerCapacityLevel: 1,
      fillingSpeedLevel: 1,
      collectionEfficiency: 1,
      lastUpdateTimestamp: Date.now()
    },
    containers: [],
    resources: {
      water: 0
    },
    stats: {
      totalSnot: 0,
      totalSnotCoins: 0
    },
    _lastModified: Date.now(),
    _createdAt: new Date().toISOString(),
    _tempData: null,
    _lastActionTime: new Date().toISOString(),
    _lastAction: 'create_default_state'
  } as unknown as GameState;
}

export function GameProvider({
  children,
  userId
}: GameProviderProps) {
  // Инициализируем состояние игры
  const [state, setState] = useState<GameState>(createInitialGameState(userId || ''));
  
  // Создаем ref для хранения предыдущего значения containerSnot
  const prevContainerSnotRef = useRef(state?.inventory?.containerSnot ?? 0);

  // Обновление состояния игры каждый тик
  useEffect(() => {
    // Функция для обновления состояния игры
    const updateGameState = () => {
      setState(prevState => {
        // Пропустить обновление, если нет инвентаря
        if (!prevState || !prevState.inventory) return prevState;

        // Получаем текущее время
        const currentTime = Date.now();
        const lastUpdateTime = prevState.inventory.lastUpdateTimestamp || currentTime;
        const timePassed = (currentTime - lastUpdateTime) / 1000; // в секундах
        
        // Пропустить обновление, если прошло менее 0.1 секунды или более 1 часа (возможно, было приостановлено)
        if (timePassed < 0.1 || timePassed > 3600) {
          return {
            ...prevState,
            inventory: {
              ...prevState.inventory,
              lastUpdateTimestamp: currentTime
            }
          };
        }

        // Скорость наполнения из уровня
        const fillingSpeed = getFillingSpeedByLevel(prevState.inventory.fillingSpeedLevel);
        
        // Количество соплей, добавляемое за прошедшее время
        const snotToAdd = fillingSpeed * timePassed;
        
        // Текущее количество соплей в контейнере
        let newContainerSnot = (prevState.inventory.containerSnot || 0) + snotToAdd;
        
        // Ограничиваем количество соплей в контейнере его вместимостью
        if (newContainerSnot > prevState.inventory.containerCapacity) {
          newContainerSnot = prevState.inventory.containerCapacity;
        }
        
        // Обновляем значение в ref
        prevContainerSnotRef.current = newContainerSnot;

        // Обновляем только состояние игры без обновления ресурсов
        return {
          ...prevState,
          inventory: {
            ...prevState.inventory,
            fillingSpeed, // Обновляем скорость наполнения
            containerSnot: newContainerSnot,
            lastUpdateTimestamp: currentTime
          }
        };
      });
    };

    // Создаем интервал для обновления состояния игры
    const gameUpdateInterval = setInterval(updateGameState, 1000);

    // Очистка при размонтировании
    return () => {
      clearInterval(gameUpdateInterval);
    };
  }, []);

  // Обработчик для обновления состояния 
  const handleSetState = useCallback((newStateOrFunction: GameState | ((prevState: GameState) => GameState)) => {
    setState(prevState => {
      let newState: GameState;
      
      if (typeof newStateOrFunction === 'function') {
        newState = newStateOrFunction(prevState);
      } else {
        newState = newStateOrFunction;
      }
      
      return newState;
    });
  }, []);

  return (
    <GameStateContext.Provider value={state}>
      <SetGameStateContext.Provider value={handleSetState}>
        {children}
      </SetGameStateContext.Provider>
    </GameStateContext.Provider>
  );
} 