'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { GameStateContext, SetGameStateContext } from '../contexts'
import { GameState, ExtendedGameState, createInitialGameState } from '../../../types/gameTypes'
import { updateResourcesBasedOnTimePassed } from '../../../utils/resourceUtils'
import { getFillingSpeedByLevel } from '../../../utils/gameUtils'
import { getGameProgressService } from '../../../services/gameProgressService'
import DebugPanel from '@/app/components/DebugPanel'
import { initialState, FILL_RATES } from '../../../constants/gameConstants'

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
      fillingSpeed: 1,
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
  userId = 'anonymous'
}: GameProviderProps) {
  // Получаем сервис для работы с прогрессом игры
  const progressService = userId ? getGameProgressService(userId) : null;
  
  // Инициализируем состояние игры
  const [state, setState] = useState<ExtendedGameState>(() => {
    // Пытаемся загрузить сохраненное состояние, если есть userId
    if (userId && progressService) {
      const savedState = progressService.loadGameState();
      console.log('[GameProvider] Загружено сохраненное состояние игры:', {
        dataSource: savedState._dataSource || 'unknown',
        hideInterface: savedState.hideInterface,
        activeTab: savedState.activeTab,
        isLoading: savedState.isLoading
      });
      // Принудительно показываем интерфейс при загрузке состояния
      return {
        ...savedState,
        hideInterface: false
      };
    }
    
    // Иначе создаем новое состояние
    const initialState = createInitialGameState(userId);
    console.log('[GameProvider] Создано новое состояние игры:', {
      dataSource: initialState._dataSource,
      hideInterface: initialState.hideInterface,
      activeTab: initialState.activeTab,
      isLoading: initialState.isLoading
    });
    return {
      ...initialState,
      hideInterface: false
    };
  });
  
  // Создаем ref для хранения предыдущего значения containerSnot
  const prevContainerSnotRef = useRef(state?.inventory?.containerSnot ?? 0);

  // Флаг, указывающий, что произошли изменения, которые нужно сохранить
  const stateChangedRef = useRef(false);

  // Добавляем эффект для отслеживания изменений важных свойств состояния
  useEffect(() => {
    console.log('[GameProvider] Изменение состояния игры:', {
      hideInterface: state.hideInterface,
      activeTab: state.activeTab,
      isLoading: state.isLoading,
      dataSource: state._dataSource
    });
  }, [state.hideInterface, state.activeTab, state.isLoading, state._dataSource]);

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
        
        // Количество соплей, добавляемое за прошедшее время с учетом базовой скорости
        const fillRatePerSecond = FILL_RATES.BASE_CONTAINER_FILL_RATE * fillingSpeed;
        const snotToAdd = fillRatePerSecond * timePassed;
        
        // Текущее количество соплей в контейнере
        let newContainerSnot = (prevState.inventory.containerSnot || 0) + snotToAdd;
        
        // Ограничиваем количество соплей в контейнере его вместимостью
        if (newContainerSnot > prevState.inventory.containerCapacity) {
          newContainerSnot = prevState.inventory.containerCapacity;
        }
        
        // Логируем информацию о накоплении для отладки
        if (process.env.NODE_ENV === 'development') {
          console.log('[GameProvider] Накопление снота:', {
            timePassed,
            fillRatePerSecond,
            snotToAdd,
            newContainerSnot,
            fillingSpeed
          });
        }
        
        // Обновляем значение в ref
        prevContainerSnotRef.current = newContainerSnot;

        // Обновляем только состояние игры без обновления ресурсов
        const updatedState = {
          ...prevState,
          inventory: {
            ...prevState.inventory,
            fillingSpeed, // Обновляем скорость наполнения
            containerSnot: newContainerSnot,
            lastUpdateTimestamp: currentTime
          }
        };
        
        // Отмечаем, что произошли изменения в игре
        stateChangedRef.current = true;
        
        return updatedState;
      });
    };

    // Создаем интервал для обновления состояния игры
    const gameUpdateInterval = setInterval(updateGameState, 1000);
    
    // Создаем интервал для сохранения прогресса
    const saveProgressInterval = setInterval(() => {
      // Если произошли изменения и есть сервис прогресса - сохраняем
      if (stateChangedRef.current && progressService) {
        setState(currentState => {
          // Сохраняем текущее состояние игры
          const savedState = progressService.saveGameState(currentState);
          // Сбрасываем флаг изменений
          stateChangedRef.current = false;
          
          console.log('[GameProvider] Автоматическое сохранение прогресса');
          return savedState;
        });
      }
    }, 30000); // Каждые 30 секунд

    // Очистка при размонтировании
    return () => {
      clearInterval(gameUpdateInterval);
      clearInterval(saveProgressInterval);
    };
  }, [progressService]);
  
  // Обработчик для ручного сохранения прогресса
  const saveProgress = useCallback(() => {
    if (progressService) {
      setState(currentState => {
        const savedState = progressService.saveGameState(currentState);
        console.log('[GameProvider] Ручное сохранение прогресса');
        return savedState;
      });
      
      // Запускаем синхронизацию с базой данных
      progressService.syncWithDatabase(true);
    }
  }, [progressService]);

  // Обработчик для обновления состояния 
  const handleSetState = useCallback((newStateOrFunction: GameState | ((prevState: GameState) => GameState)) => {
    setState(prevState => {
      let newState: GameState;
      
      if (typeof newStateOrFunction === 'function') {
        newState = newStateOrFunction(prevState);
      } else {
        newState = newStateOrFunction;
      }
      
      // Отмечаем, что произошли изменения
      stateChangedRef.current = true;
      
      // Немедленно сохраняем прогресс при изменении состояния
      if (progressService) {
        const savedState = progressService.saveGameState(newState);
        console.log('[GameProvider] Автоматическое сохранение при изменении состояния');
        return savedState;
      }
      
      return newState;
    });
  }, [progressService]);
  
  // Добавляем функцию сохранения в контекст
  const contextState = {
    ...state,
    saveProgress
  };

  // Возвращаем провайдер с компонентами игры
  return (
    <>
      <GameStateContext.Provider value={contextState}>
        <SetGameStateContext.Provider value={handleSetState}>
          {children}
        </SetGameStateContext.Provider>
      </GameStateContext.Provider>
      
      {/* Добавляем отладочную панель для мониторинга синхронизации */}
      {userId !== 'anonymous' && <DebugPanel userId={userId} />}
    </>
  );
}