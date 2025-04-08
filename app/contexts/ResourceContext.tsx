'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ResourceManager, GameResources, ResourceOperationResult } from '../services/resourceManager';
import { useGameState, useGameDispatch } from './game/hooks';
import { ANIMATION_DURATIONS } from '../constants/uiConstants';
import { saveGameState } from '../services/storage';
import { ExtendedGameState } from '../types/gameTypes';

// Константы для хранения
const STORAGE_PREFIX = 'snotcoin_';
const GAME_STATE_KEY = 'game_state_';
const BACKUP_KEY = 'backup_';

interface ResourceContextType {
  // Получение значений ресурсов
  getResource: (resourceType: keyof GameResources) => number;
  getAllResources: () => GameResources;
  
  // Управление ресурсами
  setResource: (resourceType: keyof GameResources, value: number) => ResourceOperationResult;
  addResource: (resourceType: keyof GameResources, amount: number) => ResourceOperationResult;
  subtractResource: (resourceType: keyof GameResources, amount: number, allowNegative?: boolean) => ResourceOperationResult;
  
  // Методы для контейнера
  collectContainer: () => ResourceOperationResult;
  updateContainerFilling: (elapsedTimeMs: number) => ResourceOperationResult;
  
  // Улучшения
  upgradeContainerCapacity: (newLevel: number, newCapacity: number) => ResourceOperationResult;
  upgradeFillingSpeed: (newLevel: number, newSpeed: number) => ResourceOperationResult;
  
  // Вспомогательные методы
  syncWithGameState: () => void;
  getContainerFillingPercentage: () => number;
  
  // Статус обновления
  lastOperationResult: ResourceOperationResult | null;
  isInitialized: boolean;
}

// Создаем контекст с начальными значениями
const ResourceContext = createContext<ResourceContextType>({
  getResource: () => 0,
  getAllResources: () => ({} as GameResources),
  setResource: () => ({ success: false, resourceType: 'snot', operation: 'set', timestamp: Date.now() }),
  addResource: () => ({ success: false, resourceType: 'snot', operation: 'add', timestamp: Date.now() }),
  subtractResource: () => ({ success: false, resourceType: 'snot', operation: 'subtract', timestamp: Date.now() }),
  collectContainer: () => ({ success: false, resourceType: 'containerSnot', operation: 'subtract', timestamp: Date.now() }),
  updateContainerFilling: () => ({ success: false, resourceType: 'containerSnot', operation: 'add', timestamp: Date.now() }),
  upgradeContainerCapacity: () => ({ success: false, resourceType: 'containerCapacity', operation: 'set', timestamp: Date.now() }),
  upgradeFillingSpeed: () => ({ success: false, resourceType: 'fillingSpeed', operation: 'set', timestamp: Date.now() }),
  syncWithGameState: () => {},
  getContainerFillingPercentage: () => 0,
  lastOperationResult: null,
  isInitialized: false
});

export const ResourceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const gameState = useGameState();
  const setState = useGameDispatch();
  
  // Создаем менеджер ресурсов
  const [resourceManager, setResourceManager] = useState<ResourceManager | null>(null);
  // Состояние последней операции
  const [lastOperationResult, setLastOperationResult] = useState<ResourceOperationResult | null>(null);
  // Состояние инициализации
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  // Инициализация ресурсов из gameState
  useEffect(() => {
    if (gameState && gameState.inventory) {
      console.log('[ResourceContext] Инициализация ресурсов из gameState:', {
        userId: gameState._userId,
        hasInventory: !!gameState.inventory,
        inventoryKeys: Object.keys(gameState.inventory)
      });
      
      try {
        // Создаем ресурсы из gameState
        const initialResources = ResourceManager.fromGameState(gameState);
        console.log('[ResourceContext] Созданы начальные ресурсы:', initialResources);
        
        // Создаем менеджер ресурсов с начальными значениями
        const manager = new ResourceManager(initialResources);
        setResourceManager(manager);
        
        // Проверяем, что менеджер создан правильно
        const resources = manager.getAllResources();
        console.log('[ResourceContext] Результат инициализации ResourceManager:', {
          isValid: !!manager,
          resourcesSize: Object.keys(resources).length,
          snot: resources.snot,
          containerSnot: resources.containerSnot
        });
        
        // Инициализация завершена
        setIsInitialized(true);
      } catch (error) {
        console.error('[ResourceContext] Ошибка при инициализации ResourceManager:', error);
      }
    } else {
      console.warn('[ResourceContext] Не удалось инициализировать ресурсы: gameState или inventory отсутствуют');
    }
  }, [gameState]);
  
  // Синхронизация с игровым состоянием
  const syncWithGameState = useCallback(() => {
    if (!resourceManager || !gameState) {
      console.warn('[ResourceContext] syncWithGameState: resourceManager или gameState не доступен');
      return;
    }
    
    // Обновляем состояние игры из ресурсов
    setState(prevState => {
      const updatedState = resourceManager.updateGameState(prevState) as ExtendedGameState;
      // Сохраняем обновленное состояние
      saveGameState(updatedState);
      return updatedState;
    });
    
    console.log('[ResourceContext] Состояние синхронизировано и сохранено');
  }, [resourceManager, gameState, setState]);
  
  // Запускаем синхронизацию после любой операции
  useEffect(() => {
    if (lastOperationResult && lastOperationResult.success) {
      syncWithGameState();
    }
  }, [lastOperationResult, syncWithGameState]);
  
  // Обработчик периодического обновления контейнера
  useEffect(() => {
    if (!resourceManager || !isInitialized) return;
    
    const updateContainerInterval = setInterval(() => {
      // Проверяем timestamp последнего обновления
      const resources = resourceManager.getAllResources();
      const now = Date.now();
      const lastUpdate = resources.lastUpdateTimestamp || now;
      const elapsedTime = now - lastUpdate;
      
      if (elapsedTime > 0) {
        const result = resourceManager.updateContainerFilling(elapsedTime);
        setLastOperationResult(result);
      }
    }, ANIMATION_DURATIONS.RESOURCE_UPDATE_INTERVAL || 1000);
    
    return () => clearInterval(updateContainerInterval);
  }, [resourceManager, isInitialized]);
  
  // Методы для работы с ресурсами
  const getResource = useCallback((resourceType: keyof GameResources): number => {
    if (!resourceManager) {
      console.warn(`[ResourceContext] getResource(${resourceType}): ResourceManager не инициализирован, возвращаем 0`);
      return 0;
    }
    
    // Получаем все ресурсы для проверки
    const allResources = resourceManager.getAllResources();
    
    // Проверка: если ресурсы пустые, но gameState доступен, принудительно инициализируем
    if (Object.keys(allResources).length === 0 && gameState && gameState.inventory) {
      console.log('[ResourceContext] Обнаружен пустой ResourceManager, выполняем принудительную инициализацию');
      
      // Создаем новый менеджер ресурсов с начальными значениями из gameState
      const newManager = new ResourceManager(ResourceManager.fromGameState(gameState));
      setResourceManager(newManager);
      
      // Инициализация завершена
      setIsInitialized(true);
      
      // Используем значение из gameState, если доступно
      if (gameState.inventory && typeof gameState.inventory[resourceType] === 'number') {
        return gameState.inventory[resourceType] as number;
      }
      
      // Если всё ещё нет значения, возвращаем значение по умолчанию
      if (resourceType === 'snot') return 0;
      if (resourceType === 'containerSnot') return 0.05;
      return 0;
    }
    
    return resourceManager.getResource(resourceType);
  }, [resourceManager, gameState]);
  
  const getAllResources = useCallback((): GameResources => {
    if (!resourceManager) {
      console.warn('[ResourceContext] getAllResources: ResourceManager не инициализирован, возвращаем пустой объект');
      return {} as GameResources;
    }
    
    // Получаем ресурсы
    const resources = resourceManager.getAllResources();
    
    // Проверка: если ресурсы пустые, но gameState доступен
    if (Object.keys(resources).length === 0 && gameState && gameState.inventory) {
      console.log('[ResourceContext] getAllResources: Обнаружен пустой ResourceManager, выполняем принудительную инициализацию');
      
      // Создаем новый менеджер ресурсов с начальными значениями из gameState
      const newManager = new ResourceManager(ResourceManager.fromGameState(gameState));
      setResourceManager(newManager);
      
      // Инициализация завершена
      setIsInitialized(true);
      
      // Возвращаем ресурсы из новой инициализации
      return newManager.getAllResources();
    }
    
    return resources;
  }, [resourceManager, gameState]);
  
  const setResource = useCallback((resourceType: keyof GameResources, value: number): ResourceOperationResult => {
    // Проверяем наличие ResourceManager
    if (!resourceManager) {
      console.warn(`[ResourceContext] setResource(${resourceType}, ${value}): ResourceManager не инициализирован`);
      
      // Если есть gameState, создаем новый ResourceManager
      if (gameState && gameState.inventory) {
        console.log('[ResourceContext] setResource: создаем новый ResourceManager');
        
        try {
          // Создаем ресурсы и новый ResourceManager
          const initialResources = ResourceManager.fromGameState(gameState);
          const newManager = new ResourceManager(initialResources);
          
          // Устанавливаем созданный ResourceManager
          setResourceManager(newManager);
          setIsInitialized(true);
          
          // Вызываем setResource у нового менеджера
          console.log(`[ResourceContext] setResource: вызываем метод у нового менеджера: ${resourceType}=${value}`);
          const result = newManager.setResource(resourceType, value);
          setLastOperationResult(result);
          return result;
        } catch (error) {
          console.error('[ResourceContext] Ошибка при создании нового ResourceManager в setResource:', error);
        }
      }
      
      // Если не удалось создать новый ResourceManager, возвращаем ошибку
      const result: ResourceOperationResult = {
        success: false,
        error: 'ResourceManager не инициализирован',
        resourceType,
        operation: 'set',
        timestamp: Date.now()
      };
      setLastOperationResult(result);
      return result;
    }
    
    // Проверяем, инициализированы ли ресурсы
    const allResources = resourceManager.getAllResources();
    if (Object.keys(allResources).length === 0 && gameState && gameState.inventory) {
      console.log('[ResourceContext] setResource: обнаружены пустые ресурсы, выполняем принудительную инициализацию');
      
      try {
        // Создаем новый ResourceManager с начальными ресурсами
        const initialResources = ResourceManager.fromGameState(gameState);
        const newManager = new ResourceManager(initialResources);
        
        // Устанавливаем созданный ResourceManager
        setResourceManager(newManager);
        setIsInitialized(true);
        
        // Вызываем setResource у нового менеджера
        console.log(`[ResourceContext] setResource: вызываем метод у нового менеджера после инициализации: ${resourceType}=${value}`);
        const result = newManager.setResource(resourceType, value);
        setLastOperationResult(result);
        return result;
      } catch (error) {
        console.error('[ResourceContext] Ошибка при инициализации ResourceManager в setResource:', error);
      }
    }
    
    // Стандартный путь: вызываем метод у существующего ResourceManager
    const result = resourceManager.setResource(resourceType, value);
    setLastOperationResult(result);
    return result;
  }, [resourceManager, gameState]);
  
  const addResource = useCallback((resourceType: keyof GameResources, amount: number): ResourceOperationResult => {
    // Проверяем наличие ResourceManager
    if (!resourceManager) {
      console.warn(`[ResourceContext] addResource(${resourceType}, ${amount}): ResourceManager не инициализирован`);
      
      // Если есть gameState, создаем новый ResourceManager
      if (gameState && gameState.inventory) {
        console.log('[ResourceContext] addResource: создаем новый ResourceManager');
        
        try {
          // Создаем ресурсы и новый ResourceManager
          const initialResources = ResourceManager.fromGameState(gameState);
          const newManager = new ResourceManager(initialResources);
          
          // Устанавливаем созданный ResourceManager
          setResourceManager(newManager);
          setIsInitialized(true);
          
          // Вызываем addResource у нового менеджера
          console.log(`[ResourceContext] addResource: вызываем метод у нового менеджера: ${resourceType}+=${amount}`);
          
          // Проверяем параметры перед вызовом addResource
          if (isNaN(amount)) {
            const error = `Некорректное значение amount: ${amount}`;
            console.error(`[ResourceContext] ${error}`);
            const errorResult: ResourceOperationResult = {
              success: false,
              error,
              resourceType,
              operation: 'add',
              timestamp: Date.now()
            };
            setLastOperationResult(errorResult);
            return errorResult;
          }
          
          // Убеждаемся, что у нас есть корректное начальное значение
          const currentValue = typeof initialResources[resourceType] === 'number' 
            ? initialResources[resourceType] 
            : (resourceType === 'snot' ? 0.1 : 0);
          
          if (isNaN(currentValue as number)) {
            const error = `Некорректное текущее значение: ${currentValue}`;
            console.error(`[ResourceContext] ${error}`);
            const errorResult: ResourceOperationResult = {
              success: false,
              error,
              resourceType,
              operation: 'add',
              timestamp: Date.now()
            };
            setLastOperationResult(errorResult);
            return errorResult;
          }
          
          try {
            // Пробуем сначала использовать стандартный путь
            const result = newManager.addResource(resourceType, amount);
            
            // Проверка результата
            if (!result.success) {
              console.warn(`[ResourceContext] Метод addResource у нового менеджера вернул ошибку:`, result);
              
              // Если не удалось добавить ресурс, пробуем использовать setResource
              const currentValue = newManager.getResource(resourceType) || 0;
              const newValue = currentValue + amount;
              const fallbackResult = newManager.setResource(resourceType, newValue);
              
              if (fallbackResult.success) {
                console.log(`[ResourceContext] Использован fallback через setResource: ${currentValue} -> ${newValue}`);
                setLastOperationResult(fallbackResult);
                return fallbackResult;
              } else {
                // Если и setResource не сработал, обновляем напрямую через геймстейт
                console.warn(`[ResourceContext] Оба метода не сработали, пробуем обновить gameState напрямую`);
                
                setState(prevState => {
                  const updatedInventory = { 
                    ...prevState.inventory,
                    [resourceType]: (prevState.inventory?.[resourceType] as number || 0) + amount 
                  };
                  
                  return {
                    ...prevState,
                    inventory: updatedInventory
                  };
                });
                
                // Возвращаем успешный результат
                const manualResult: ResourceOperationResult = {
                  success: true,
                  resourceType,
                  operation: 'add',
                  timestamp: Date.now(),
                  newValue: (gameState.inventory?.[resourceType] as number || 0) + amount,
                  oldValue: gameState.inventory?.[resourceType] as number || 0
                };
                
                setLastOperationResult(manualResult);
                return manualResult;
              }
            }
            
            setLastOperationResult(result);
            return result;
          } catch (callError) {
            console.error(`[ResourceContext] Ошибка при вызове addResource у нового менеджера:`, callError);
            
            // Прямое обновление gameState как запасной вариант
            setState(prevState => {
              const updatedInventory = { 
                ...prevState.inventory,
                [resourceType]: (prevState.inventory?.[resourceType] as number || 0) + amount 
              };
              
              return {
                ...prevState,
                inventory: updatedInventory
              };
            });
            
            // Возвращаем успешный результат после прямого обновления
            const emergencyResult: ResourceOperationResult = {
              success: true,
              resourceType,
              operation: 'add',
              timestamp: Date.now(),
              newValue: (gameState.inventory?.[resourceType] as number || 0) + amount,
              oldValue: gameState.inventory?.[resourceType] as number || 0
            };
            
            setLastOperationResult(emergencyResult);
            return emergencyResult;
          }
        } catch (error) {
          console.error('[ResourceContext] Ошибка при создании нового ResourceManager в addResource:', error);
        }
      }
      
      // Если не удалось создать новый ResourceManager, обновляем gameState напрямую как запасной вариант
      if (gameState && setState) {
        console.warn(`[ResourceContext] addResource: РесурсМенеджер недоступен, обновляем напрямую через gameState`);
        
        try {
          setState(prevState => {
            const updatedInventory = { 
              ...prevState.inventory,
              [resourceType]: (prevState.inventory?.[resourceType] as number || 0) + amount 
            };
            
            return {
              ...prevState,
              inventory: updatedInventory
            };
          });
          
          // Возвращаем успешный результат
          const directResult: ResourceOperationResult = {
            success: true,
            resourceType,
            operation: 'add',
            timestamp: Date.now(),
            newValue: (gameState.inventory?.[resourceType] as number || 0) + amount,
            oldValue: gameState.inventory?.[resourceType] as number || 0
          };
          
          setLastOperationResult(directResult);
          return directResult;
        } catch (stateError) {
          console.error(`[ResourceContext] Ошибка при прямом обновлении gameState:`, stateError);
        }
      }
      
      // Если не удалось создать новый ResourceManager и обновить gameState, возвращаем ошибку
      const result: ResourceOperationResult = {
        success: false,
        error: 'ResourceManager не инициализирован',
        resourceType,
        operation: 'add',
        timestamp: Date.now()
      };
      setLastOperationResult(result);
      return result;
    }
    
    // Проверяем, инициализированы ли ресурсы
    const allResources = resourceManager.getAllResources();
    if (Object.keys(allResources).length === 0 && gameState && gameState.inventory) {
      console.log('[ResourceContext] addResource: обнаружены пустые ресурсы, выполняем принудительную инициализацию');
      
      try {
        // Создаем новый ResourceManager с начальными ресурсами
        const initialResources = ResourceManager.fromGameState(gameState);
        const newManager = new ResourceManager(initialResources);
        
        // Устанавливаем созданный ResourceManager
        setResourceManager(newManager);
        setIsInitialized(true);
        
        // Проверяем параметры перед вызовом addResource
        if (isNaN(amount)) {
          const error = `Некорректное значение amount: ${amount}`;
          console.error(`[ResourceContext] ${error}`);
          const errorResult: ResourceOperationResult = {
            success: false,
            error,
            resourceType,
            operation: 'add',
            timestamp: Date.now()
          };
          setLastOperationResult(errorResult);
          return errorResult;
        }
        
        // Убеждаемся, что у нас есть корректное начальное значение
        const currentValue = typeof initialResources[resourceType] === 'number' 
          ? initialResources[resourceType] 
          : (resourceType === 'snot' ? 0.1 : 0);
        
        if (isNaN(currentValue as number)) {
          const error = `Некорректное текущее значение: ${currentValue}`;
          console.error(`[ResourceContext] ${error}`);
          const errorResult: ResourceOperationResult = {
            success: false,
            error,
            resourceType,
            operation: 'add',
            timestamp: Date.now()
          };
          setLastOperationResult(errorResult);
          return errorResult;
        }
        
        // Вызываем addResource у нового менеджера
        console.log(`[ResourceContext] addResource: вызываем метод у нового менеджера после инициализации: ${resourceType}+=${amount}`);
        try {
          const result = newManager.addResource(resourceType, amount);
          
          // Проверка результата
          if (!result.success) {
            console.warn(`[ResourceContext] Метод addResource у нового менеджера вернул ошибку:`, result);
            
            // Если не удалось добавить ресурс, пробуем использовать setResource
            const currentValue = newManager.getResource(resourceType) || 0;
            const newValue = currentValue + amount;
            const fallbackResult = newManager.setResource(resourceType, newValue);
            
            if (fallbackResult.success) {
              console.log(`[ResourceContext] Использован fallback через setResource: ${currentValue} -> ${newValue}`);
              setLastOperationResult(fallbackResult);
              return fallbackResult;
            } else {
              // Если и setResource не сработал, обновляем напрямую через геймстейт
              console.warn(`[ResourceContext] Оба метода не сработали, пробуем обновить gameState напрямую`);
              
              setState(prevState => {
                const updatedInventory = { 
                  ...prevState.inventory,
                  [resourceType]: (prevState.inventory?.[resourceType] as number || 0) + amount 
                };
                
                return {
                  ...prevState,
                  inventory: updatedInventory
                };
              });
              
              // Возвращаем успешный результат
              const manualResult: ResourceOperationResult = {
                success: true,
                resourceType,
                operation: 'add',
                timestamp: Date.now(),
                newValue: (gameState.inventory?.[resourceType] as number || 0) + amount,
                oldValue: gameState.inventory?.[resourceType] as number || 0
              };
              
              setLastOperationResult(manualResult);
              return manualResult;
            }
          }
          
          setLastOperationResult(result);
          return result;
        } catch (callError) {
          console.error(`[ResourceContext] Ошибка при вызове addResource у нового менеджера:`, callError);
          
          // Прямое обновление gameState как запасной вариант
          setState(prevState => {
            const updatedInventory = { 
              ...prevState.inventory,
              [resourceType]: (prevState.inventory?.[resourceType] as number || 0) + amount 
            };
            
            return {
              ...prevState,
              inventory: updatedInventory
            };
          });
          
          // Возвращаем успешный результат после прямого обновления
          const emergencyResult: ResourceOperationResult = {
            success: true,
            resourceType,
            operation: 'add',
            timestamp: Date.now(),
            newValue: (gameState.inventory?.[resourceType] as number || 0) + amount,
            oldValue: gameState.inventory?.[resourceType] as number || 0
          };
          
          setLastOperationResult(emergencyResult);
          return emergencyResult;
        }
      } catch (error) {
        console.error('[ResourceContext] Ошибка при инициализации ResourceManager в addResource:', error);
      }
    }
    
    // Стандартный путь: вызываем метод у существующего ResourceManager
    try {
      // Проверяем параметры перед вызовом
      if (isNaN(amount)) {
        const error = `Некорректное значение amount: ${amount}`;
        console.error(`[ResourceContext] ${error}`);
        const errorResult: ResourceOperationResult = {
          success: false,
          error,
          resourceType,
          operation: 'add',
          timestamp: Date.now()
        };
        setLastOperationResult(errorResult);
        return errorResult;
      }
      
      // Получаем текущее значение для проверки
      const currentValue = resourceManager.getResource(resourceType);
      if (isNaN(currentValue)) {
        const error = `Некорректное текущее значение: ${currentValue}`;
        console.error(`[ResourceContext] ${error}`);
        const errorResult: ResourceOperationResult = {
          success: false,
          error,
          resourceType,
          operation: 'add',
          timestamp: Date.now()
        };
        setLastOperationResult(errorResult);
        return errorResult;
      }
      
      // Вызываем метод у существующего ResourceManager
      const result = resourceManager.addResource(resourceType, amount);
      console.log(`[ResourceContext] Результат addResource:`, {
        success: result.success,
        resourceType,
        amount,
        oldValue: result.oldValue,
        newValue: result.newValue
      });
      
      // Если метод не сработал, делаем ручное добавление
      if (!result.success) {
        console.warn(`[ResourceContext] Стандартный addResource не сработал, пробуем ручное добавление`);
        
        // Получаем текущее значение 
        const currentVal = resourceManager.getResource(resourceType);
        // Вычисляем новое значение
        const newVal = currentVal + amount;
        // Устанавливаем новое значение
        const setResult = resourceManager.setResource(resourceType, newVal);
        
        if (setResult.success) {
          console.log(`[ResourceContext] Ручное добавление успешно: ${currentVal} + ${amount} = ${newVal}`);
          setLastOperationResult(setResult);
          return setResult;
        }
        
        // Если и ручное добавление не сработало, пробуем прямое обновление gameState
        console.warn(`[ResourceContext] Ручное добавление через setResource тоже не сработало, обновляем gameState напрямую`);
        
        setState(prevState => {
          const updatedInventory = { 
            ...prevState.inventory,
            [resourceType]: (prevState.inventory?.[resourceType] as number || 0) + amount 
          };
          
          return {
            ...prevState,
            inventory: updatedInventory
          };
        });
        
        // Возвращаем успешный результат
        const manualResult: ResourceOperationResult = {
          success: true,
          resourceType,
          operation: 'add',
          timestamp: Date.now(),
          newValue: (gameState.inventory?.[resourceType] as number || 0) + amount,
          oldValue: gameState.inventory?.[resourceType] as number || 0
        };
        
        setLastOperationResult(manualResult);
        return manualResult;
      }
      
      setLastOperationResult(result);
      return result;
    } catch (error) {
      console.error(`[ResourceContext] Ошибка при вызове addResource:`, error);
      
      // Прямое обновление gameState как запасной вариант при любой ошибке
      try {
        setState(prevState => {
          const updatedInventory = { 
            ...prevState.inventory,
            [resourceType]: (prevState.inventory?.[resourceType] as number || 0) + amount 
          };
          
          return {
            ...prevState,
            inventory: updatedInventory
          };
        });
        
        // Возвращаем успешный результат после прямого обновления
        const emergencyResult: ResourceOperationResult = {
          success: true,
          resourceType,
          operation: 'add',
          timestamp: Date.now(),
          newValue: (gameState.inventory?.[resourceType] as number || 0) + amount,
          oldValue: gameState.inventory?.[resourceType] as number || 0
        };
        
        setLastOperationResult(emergencyResult);
        return emergencyResult;
      } catch (stateError) {
        console.error(`[ResourceContext] Ошибка при прямом обновлении gameState:`, stateError);
        
        // Возвращаем оригинальную ошибку, если не смогли обновить напрямую
        const errorResult: ResourceOperationResult = {
          success: false,
          error: String(error),
          resourceType,
          operation: 'add',
          timestamp: Date.now()
        };
        
        setLastOperationResult(errorResult);
        return errorResult;
      }
    }
  }, [resourceManager, gameState, setState]);
  
  const subtractResource = useCallback((
    resourceType: keyof GameResources, 
    amount: number, 
    allowNegative = false
  ): ResourceOperationResult => {
    if (!resourceManager) {
      const result: ResourceOperationResult = {
        success: false,
        error: 'ResourceManager не инициализирован',
        resourceType,
        operation: 'subtract',
        timestamp: Date.now()
      };
      setLastOperationResult(result);
      return result;
    }
    
    const result = resourceManager.subtractResource(resourceType, amount, allowNegative);
    setLastOperationResult(result);
    return result;
  }, [resourceManager]);
  
  const collectContainer = useCallback((): ResourceOperationResult => {
    if (!resourceManager) {
      const result: ResourceOperationResult = {
        success: false,
        error: 'ResourceManager не инициализирован',
        resourceType: 'containerSnot',
        operation: 'subtract',
        timestamp: Date.now()
      };
      setLastOperationResult(result);
      return result;
    }
    
    const result = resourceManager.collectContainer();
    setLastOperationResult(result);
    return result;
  }, [resourceManager]);
  
  const updateContainerFilling = useCallback((elapsedTimeMs: number): ResourceOperationResult => {
    if (!resourceManager) {
      const result: ResourceOperationResult = {
        success: false,
        error: 'ResourceManager не инициализирован',
        resourceType: 'containerSnot',
        operation: 'add',
        timestamp: Date.now()
      };
      setLastOperationResult(result);
      return result;
    }
    
    const result = resourceManager.updateContainerFilling(elapsedTimeMs);
    setLastOperationResult(result);
    return result;
  }, [resourceManager]);
  
  const upgradeContainerCapacity = useCallback((newLevel: number, newCapacity: number): ResourceOperationResult => {
    if (!resourceManager) {
      const result: ResourceOperationResult = {
        success: false,
        error: 'ResourceManager не инициализирован',
        resourceType: 'containerCapacity',
        operation: 'set',
        timestamp: Date.now()
      };
      setLastOperationResult(result);
      return result;
    }
    
    const result = resourceManager.upgradeContainerCapacity(newLevel, newCapacity);
    setLastOperationResult(result);
    return result;
  }, [resourceManager]);
  
  const upgradeFillingSpeed = useCallback((newLevel: number, newSpeed: number): ResourceOperationResult => {
    if (!resourceManager) {
      const result: ResourceOperationResult = {
        success: false,
        error: 'ResourceManager не инициализирован',
        resourceType: 'fillingSpeed',
        operation: 'set',
        timestamp: Date.now()
      };
      setLastOperationResult(result);
      return result;
    }
    
    const result = resourceManager.upgradeFillingSpeed(newLevel, newSpeed);
    setLastOperationResult(result);
    return result;
  }, [resourceManager]);
  
  // Вспомогательный метод для получения процента заполнения контейнера
  const getContainerFillingPercentage = useCallback((): number => {
    if (!resourceManager) return 0;
    
    const resources = resourceManager.getAllResources();
    const containerSnot = resources.containerSnot || 0;
    const containerCapacity = resources.containerCapacity || 1;
    
    return (containerSnot / containerCapacity) * 100;
  }, [resourceManager]);
  
  const value = {
    getResource,
    getAllResources,
    setResource,
    addResource,
    subtractResource,
    collectContainer,
    updateContainerFilling,
    upgradeContainerCapacity,
    upgradeFillingSpeed,
    syncWithGameState,
    getContainerFillingPercentage,
    lastOperationResult,
    isInitialized
  };
  
  return (
    <ResourceContext.Provider value={value}>
      {children}
    </ResourceContext.Provider>
  );
};

// Хук для использования контекста ресурсов
export const useResources = () => {
  const context = useContext(ResourceContext);
  
  if (context === undefined) {
    throw new Error('useResources должен использоваться внутри ResourceProvider');
  }
  
  return context;
};

// Хук для получения конкретного ресурса
export const useResource = (resourceType: keyof GameResources) => {
  const { getResource } = useResources();
  
  // Получаем текущее значение ресурса
  const value = getResource(resourceType);
  
  return value;
};

// Хук для работы с контейнером
export const useContainer = () => {
  const {
    getResource,
    collectContainer,
    getContainerFillingPercentage
  } = useResources();
  
  return {
    containerSnot: getResource('containerSnot'),
    containerCapacity: getResource('containerCapacity'),
    containerCapacityLevel: getResource('containerCapacityLevel'),
    fillingSpeed: getResource('fillingSpeed'),
    fillingSpeedLevel: getResource('fillingSpeedLevel'),
    collect: collectContainer,
    getFillingPercentage: getContainerFillingPercentage
  };
};

// Хук для получения snot (основной ресурс)
export const useSnot = () => {
  const { getResource, addResource, subtractResource } = useResources();
  
  return {
    amount: getResource('snot'),
    add: (amount: number) => addResource('snot', amount),
    subtract: (amount: number, allowNegative = false) => subtractResource('snot', amount, allowNegative),
    set: (amount: number) => subtractResource('snot', amount)
  };
};

export default ResourceContext; 