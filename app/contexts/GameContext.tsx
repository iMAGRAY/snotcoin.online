"use client"

import React, { createContext, useContext, useReducer, useEffect, useCallback, useState, useMemo, type ReactNode } from 'react'
import type { GameState, Action, ExtendedGameState } from '../types/gameTypes'
import { gameReducer } from '../reducers/gameReducer'
import { initialState } from '../constants/gameConstants'
import { debounce } from 'lodash'
import * as dataService from '../services/dataService'

// Типизация для глобального объекта window
declare global {
  interface Window {
    // Используем более точное определение типов для предотвращения ошибок TypeScript
    __unmountInProgress: Record<string, boolean>;
    __unmountEffects: Record<string, boolean>;
    __initializeInProgress: Record<string, boolean>;
    __lastLoadAttempts?: Record<string, number>;
    [key: string]: any; // Для остальных динамических свойств
  }
}

// Функция для безопасной инициализации глобальных объектов
function ensureGlobalObject(key: string): void {
  if (typeof window !== 'undefined') {
    if (!window[key]) {
      window[key] = {};
    }
  }
}

// Функция для безопасного доступа к глобальным объектам
function safeGetGlobalObject<T>(key: string): Record<string, T> {
  if (typeof window === 'undefined') return {} as Record<string, T>;
  
  // Инициализируем объект, если он не существует
  if (!window[key]) {
    window[key] = {};
  }
  
  return window[key] as Record<string, T>;
}

const GameStateContext = createContext<ExtendedGameState | null>(null)
const GameDispatchContext = createContext<((action: Action) => void) | null>(null)
const IsSavingContext = createContext<boolean>(false)

export function useGameState() {
  const context = useContext(GameStateContext)
  if (!context) {
    throw new Error('useGameState must be used within a GameProvider')
  }
  return context
}

export function useGameDispatch() {
  const context = useContext(GameDispatchContext)
  if (!context) {
    throw new Error('useGameDispatch must be used within a GameProvider')
  }
  return context
}

export function useIsSaving() {
  return useContext(IsSavingContext)
}

export function useGameContext() {
  return {
    state: useGameState(),
    dispatch: useGameDispatch()
  }
}

interface GameProviderProps {
  children: ReactNode
}

// Единое хранилище для данных в памяти
export const memoryStore: Record<string, any> = {};

export function GameProvider({ children }: GameProviderProps) {
  const [state, dispatch] = useReducer<(state: ExtendedGameState, action: Action) => ExtendedGameState>(
    gameReducer as any, 
    initialState as ExtendedGameState
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Инициализация глобальных объектов, используемых компонентом
  if (typeof window !== 'undefined') {
    window.__unmountInProgress = window.__unmountInProgress || {};
    window.__unmountEffects = window.__unmountEffects || {};
    window.__initializeInProgress = window.__initializeInProgress || {};
    window.__lastLoadAttempts = window.__lastLoadAttempts || {};
  }

  // Оптимизированная функция для синхронизации ресурсов
  const synchronizeResources = useCallback((state: ExtendedGameState) => {
    try {
      // Создаем снимок текущего состояния ресурсов
      const currentResources = {
        snot: state.inventory.snot,
        snotCoins: state.inventory.snotCoins,
        timestamp: Date.now()
      };
      
      // Получаем предыдущий снимок из памяти
      const savedResources = memoryStore.resourcesSnapshot ? 
        JSON.parse(memoryStore.resourcesSnapshot) : null;
      
      // Если нет предыдущего снимка, сохраняем текущий и выходим
      if (!savedResources) {
        memoryStore.resourcesSnapshot = JSON.stringify(currentResources);
        return state;
      }
      
      // Проверяем, нужно ли обновлять состояние
      let needsUpdate = false;
      let updatedInventory = { ...state.inventory };
      
      // Используем текущие ресурсы или сохраненные, в зависимости от того, 
      // какие из них новее (по временной метке)
      const useCurrentResources = currentResources.timestamp > savedResources.timestamp;
      const sourceResources = useCurrentResources ? currentResources : savedResources;
      
      // Проверяем только основные ресурсы для синхронизации
      const keysToCheck = ['snot', 'snotCoins'] as const;
      
      keysToCheck.forEach(key => {
        if (state.inventory[key] !== sourceResources[key]) {
          updatedInventory[key] = sourceResources[key];
          needsUpdate = true;
        }
      });
      
      // Обновляем снимок ресурсов
      memoryStore.resourcesSnapshot = JSON.stringify({
        snot: state.inventory.snot,
        snotCoins: state.inventory.snotCoins,
        timestamp: Date.now()
      });
      
      if (needsUpdate) {
        return {
          ...state,
          inventory: updatedInventory
        };
      }
      
      return state;
    } catch (error) {
      return state;
    }
  }, []);

  // Создаем функцию для сохранения состояния
  const saveState = useCallback(async (state: ExtendedGameState, isForced = false) => {
    try {
      if (!state.user?.id) {
        console.error("[GameContext] Отсутствует ID пользователя, сохранение невозможно");
        return;
      }
      
      // Проверяем, не выполняется ли уже сохранение
      if (state._isSavingInProgress && !isForced) {
        console.log("[GameContext] Сохранение уже выполняется, пропускаем");
        return;
      }
      
      // Проверяем состояние документа, пропускаем сохранение если страница выгружается
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && !isForced) {
        console.log("[GameContext] Страница не активна, пропускаем обычное сохранение");
        return;
      }
      
      // Получаем ID пользователя из localStorage, если он там есть
      // Это гарантирует, что мы используем ID, полученный с сервера
      let userId = state.user.id;
      if (typeof window !== 'undefined') {
        const storedUserId = localStorage.getItem('user_id');
        if (storedUserId) {
          userId = storedUserId;
          console.log(`[GameContext] Используем ID пользователя из localStorage: ${userId}`);
        }
      }
      
      console.log(`[GameContext] Начинаем сохранение для пользователя ${userId}, isForced=${isForced}`);
      
      // Устанавливаем флаг сохранения
      setIsSaving(true);
      
      // Помечаем состояние как сохраняемое, чтобы избежать двойных сохранений
      const stateToSave = {
        ...state,
        _isSavingInProgress: true
      };
      
      // Обновляем состояние для отражения процесса сохранения
      if (!isForced) {
        dispatch({ 
          type: "LOAD_GAME_STATE", 
          payload: stateToSave 
        });
      }
      
      try {
        console.log(`[GameContext] Вызываем ${isForced ? 'forceSaveGameState' : 'saveGameState'} для пользователя ${userId}`);
        isForced 
          ? await dataService.forceSaveGameState(userId, stateToSave)
          : await dataService.saveGameState(userId, stateToSave);
        
        console.log(`[GameContext] Сохранение успешно для пользователя ${userId}`);
        
        // Сбрасываем флаг сохранения в состоянии
        if (!isForced) {
          dispatch({ 
            type: "LOAD_GAME_STATE", 
            payload: {
              ...stateToSave,
              _isSavingInProgress: false,
            } 
          });
        }
      } catch (error) {
        console.error(`[GameContext] Ошибка при сохранении состояния:`, error);
        
        // Сбрасываем флаг сохранения даже при ошибке
        if (!isForced) {
          dispatch({ 
            type: "LOAD_GAME_STATE", 
            payload: {
              ...stateToSave,
              _isSavingInProgress: false,
              _lastSaveError: String(error)
            } 
          });
        }
      } finally {
        setIsSaving(false);
      }
    } catch (finalError) {
      console.error("[GameContext] Критическая ошибка в saveState:", finalError);
      setIsSaving(false);
    }
  }, [dispatch]);
  
  // Принудительное сохранение (для использования в диспетчере)
  const forceSaveState = useCallback(async () => {
    try {
      if (!state.user?.id) {
        console.error("[GameContext] Отсутствует ID пользователя, принудительное сохранение невозможно");
        return;
      }
      
      // Проверяем минимальный интервал между принудительными сохранениями
      const now = Date.now();
      const lastForceSaveAttempt = memoryStore.lastForceSaveAttempt || 0;
      const MIN_FORCE_SAVE_INTERVAL = 5000; // 5 секунд между принудительными сохранениями
      
      if (now - lastForceSaveAttempt < MIN_FORCE_SAVE_INTERVAL) {
        console.log(`[GameContext] Слишком частые принудительные сохранения, ожидаем ${MIN_FORCE_SAVE_INTERVAL}мс`);
        return;
      }
      
      // Обновляем время последнего принудительного сохранения
      memoryStore.lastForceSaveAttempt = now;
      
      // Получаем ID пользователя из localStorage, если он там есть
      let userId = state.user.id;
      if (typeof window !== 'undefined') {
        const storedUserId = localStorage.getItem('user_id');
        if (storedUserId) {
          userId = storedUserId;
          console.log(`[GameContext] Используем ID пользователя из localStorage для принудительного сохранения: ${userId}`);
        }
      }
      
      setIsSaving(true);
      
      try {
        await dataService.forceSaveGameState(userId, state);
        console.log(`[GameContext] Принудительное сохранение успешно для пользователя ${userId}`);
      } catch (error) {
        console.error("[GameContext] Ошибка при принудительном сохранении:", error);
      } finally {
        setIsSaving(false);
      }
    } catch (finalError) {
      console.error("[GameContext] Критическая ошибка в forceSaveState:", finalError);
      setIsSaving(false);
    }
  }, [state]);

  // Загрузка сохраненного состояния
  useEffect(() => {
    // Флаг для предотвращения повторных загрузок
    if (memoryStore.isLoadingInProgress) {
      console.log("[GameContext] Загрузка прогресса уже выполняется, пропускаем повторный запрос");
      return;
    }
    
    const loadSavedState = async () => {
      if (state.user?.id && !isInitialized) {
        try {
          // Проверяем глобальный флаг инициализации
          const userId = state.user.id;
          const initializeInProgress = safeGetGlobalObject<boolean>('initializeInProgress');
          
          if (initializeInProgress[userId]) {
            console.log(`[GameContext] Инициализация для пользователя ${userId} уже выполняется в другом экземпляре`);
            
            // Ждем немного и пробуем снова, возможно другой экземпляр уже завершил инициализацию
            setTimeout(() => {
              if (!isInitialized) {
                console.log(`[GameContext] Повторная попытка инициализации после ожидания для ${userId}`);
                
                initializeInProgress[userId] = false;
                
                // Попытка повторно запустить загрузку
                loadSavedState();
              }
            }, 3000);
            
            return;
          }
          
          // Устанавливаем глобальный флаг инициализации
          initializeInProgress[userId] = true;
          
          // Устанавливаем флаг загрузки
          memoryStore.isLoadingInProgress = true;
          console.log(`[GameContext] Начинаем загрузку прогресса для пользователя ${state.user.id}`);
          
          // Защита от множественных запросов со стороны нескольких экземпляров GameContext
          const loadingKey = `loading_${userId}`;
          
          // Проверяем глобальный флаг загрузки с временной отметкой
          const now = Date.now();
          const lastLoadAttempts = safeGetGlobalObject<number>('lastLoadAttempts');
          const lastLoadAttempt = lastLoadAttempts[loadingKey] || 0;
          const MIN_LOAD_INTERVAL = 2000; // 2 секунды между запросами загрузки
          
          if (now - lastLoadAttempt < MIN_LOAD_INTERVAL) {
            console.log(`[GameContext] Слишком частые загрузки для пользователя ${userId}, ожидаем ${MIN_LOAD_INTERVAL}мс`);
            memoryStore.isLoadingInProgress = false;
            initializeInProgress[userId] = false;
            return;
          }
          
          // Устанавливаем глобальный флаг загрузки
          lastLoadAttempts[loadingKey] = now;
          
          // Проверяем, был ли этот пользователь уже аутентифицирован
          const isAuthenticated = memoryStore.authenticatedUserIds?.includes(state.user.id);
          
          if (isAuthenticated) {
            // Загружаем состояние с сервера для обеспечения актуальности данных
            const savedState = await dataService.loadGameState(state.user.id);
            
            if (savedState) {
              // Синхронизируем ресурсы
              const syncedServerState = synchronizeResources(savedState);
              
              // Убедимся, что стартовые значения установлены правильно
              const finalState = {
                ...syncedServerState,
                activeTab: "laboratory", // Всегда начинаем с лаборатории
                hideInterface: false
              };
              
              dispatch({ type: "LOAD_GAME_STATE", payload: finalState });
            } else {
              const syncedState = synchronizeResources(state);
              
              // Если состояние было синхронизировано, применяем его
              if (syncedState !== state) {
                const finalState = {
                  ...syncedState,
                  activeTab: "laboratory",
                  hideInterface: false
                };
                
                dispatch({ type: "LOAD_GAME_STATE", payload: finalState });
              } else {
                // Сбрасываем состояние игры в любом случае
                dispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" });
                dispatch({ type: "SET_HIDE_INTERFACE", payload: false });
              }
            }
            
            setIsInitialized(true);
            memoryStore.isLoadingInProgress = false;
            
            // Помечаем пользователя как аутентифицированного
            if (!memoryStore.authenticatedUserIds) {
              memoryStore.authenticatedUserIds = [];
            }
            memoryStore.authenticatedUserIds.push(state.user.id);
            
            return;
          }
          
          // Загружаем состояние напрямую с сервера
          const savedState = await dataService.loadGameState(state.user.id);
          
          if (savedState) {
            // Синхронизируем ресурсы сервера с локальными
            const syncedServerState = synchronizeResources(savedState);
            
            dispatch({ type: "LOAD_GAME_STATE", payload: syncedServerState });
            
            // Проверяем версии для обновления состояния
            const localVersion = state._saveVersion || 0;
            const serverVersion = savedState._saveVersion || 0;
            
            if (localVersion > serverVersion) {
              // Объединяем и сохраняем более новое локальное состояние
              const mergedState = {
                ...syncedServerState,
                _saveVersion: localVersion + 1,
                _lastSaved: new Date().toISOString(),
                _isMerged: true
              };
              
              await saveState(mergedState, true);
            }
          } else {
            // Создаем начальное состояние для нового пользователя
            const initialExtendedState: ExtendedGameState = {
              ...initialState as ExtendedGameState,
              _saveVersion: 1,
              _lastSaved: new Date().toISOString(),
              _isInitialState: true,
              user: state.user
            };
            
            dispatch({ type: "INITIALIZE_NEW_USER", payload: initialExtendedState });
            
            // Сохраняем начальное состояние
            await saveState(initialExtendedState);
          }
          
          // Помечаем пользователя как аутентифицированного
          if (!memoryStore.authenticatedUserIds) {
            memoryStore.authenticatedUserIds = [];
          }
          memoryStore.authenticatedUserIds.push(state.user.id);
          
          setIsInitialized(true);
        } catch (error) {
          // Создаем начальное состояние даже при ошибке
          const initialExtendedState: ExtendedGameState = {
            ...initialState as ExtendedGameState,
            _saveVersion: 1,
            _lastSaved: new Date().toISOString(),
            _isInitialState: true,
            _isError: true,
            user: state.user
          };
          
          dispatch({ type: "INITIALIZE_NEW_USER", payload: initialExtendedState });
          setIsInitialized(true);
        } finally {
          // Сбрасываем флаг загрузки в любом случае
          memoryStore.isLoadingInProgress = false;
          
          // Очищаем глобальный флаг инициализации
          if (state.user?.id) {
            safeGetGlobalObject<boolean>('initializeInProgress')[state.user.id] = false;
          }
        }
      }
    };

    loadSavedState();
  }, [state.user?.id, isInitialized, dispatch, state, synchronizeResources, saveState]);

  // Сохранение состояния с debounce
  const debouncedSaveState = useMemo(
    () => {
      // Флаг, показывающий, выполняется ли в данный момент сохранение
      let isSavingInProgress = false;
      // Очередь состояний, ожидающих сохранения
      let pendingSaveState: ExtendedGameState | null = null;
      
      // Функция для сохранения с повторными попытками
      const saveWithRetries = async (state: ExtendedGameState, retryCount = 0) => {
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 3000; // 3 секунды задержки между попытками
        
        if (retryCount > MAX_RETRIES) {
          console.error("[GameContext] Превышено максимальное количество попыток сохранения");
          isSavingInProgress = false;
          return;
        }
        
        try {
          // Попытка сохранения
          await saveState(state);
          
          // После успешного сохранения
          isSavingInProgress = false;
          
          // Если есть ожидающее состояние, сохраняем его с задержкой
          if (pendingSaveState) {
            const stateToSave = pendingSaveState;
            pendingSaveState = null;
            
            // Небольшая задержка перед сохранением следующего состояния
            setTimeout(() => {
              saveWithRetries(stateToSave);
            }, 1000);
          }
        } catch (error) {
          console.error(`[GameContext] Ошибка при сохранении (попытка ${retryCount + 1}):`, error);
          
          // Если это не последняя попытка, повторяем через некоторое время
          if (retryCount < MAX_RETRIES) {
            setTimeout(() => {
              saveWithRetries(state, retryCount + 1);
            }, RETRY_DELAY);
          } else {
            // Если все попытки исчерпаны, снимаем флаг и логируем ошибку
            isSavingInProgress = false;
            console.error("[GameContext] Не удалось сохранить состояние после всех попыток");
          }
        }
      };
      
      // Функция debounce
      return debounce(async (state: ExtendedGameState) => {
        console.log("[GameContext] Вызов отложенного сохранения");
        
        // Если сохранение уже выполняется, сохраняем состояние в очередь
        if (isSavingInProgress) {
          console.log("[GameContext] Сохранение уже выполняется, состояние будет сохранено позже");
          pendingSaveState = state;
          return;
        }
        
        // Устанавливаем флаг, что сохранение выполняется
        isSavingInProgress = true;
        
        // Запускаем сохранение с повторными попытками
        await saveWithRetries(state);
      }, 10000); // 10 секунд дебаунс
    }, 
    [saveState]
  );

  // Обработчик beforeunload для сохранения при закрытии
  useEffect(() => {
    if (!state.user?.id || !isInitialized) return;
    
    // Настраиваем обработчик для сохранения при закрытии
    const removeHandler = dataService.setupBeforeUnloadHandler(
      state.user.id,
      () => ({ 
        ...state, 
        _saveVersion: (state._saveVersion || 0) + 1,
        _lastSaved: new Date().toISOString(),
        _isBeforeUnloadSave: true
      })
    );
    
    return removeHandler;
  }, [state.user?.id, isInitialized, state]);

  // Отслеживание изменений состояния с улучшенной логикой предотвращения лишних сохранений
  useEffect(() => {
    // Пропускаем сохранение, если нет ID пользователя или система не инициализирована
    if (!state.user?.id || !isInitialized) return;
    
    // Проверяем, нужно ли сохранять состояние - пропускаем, если есть специальные флаги
    if (state._skipSave || state._isSavingInProgress) return;
    
    // Пропускаем сохранение, если происходит размонтирование компонента
    if (memoryStore.isUnmountSaveInProgress) {
      console.log("[GameContext] Пропускаем сохранение состояния из-за активного процесса размонтирования");
      return;
    }
    
    // Проверяем минимальный интервал между сохранениями для предотвращения слишком частых запросов
    const now = Date.now();
    const lastSaveAttempt = memoryStore.lastSaveAttempt || 0;
    const MIN_SAVE_INTERVAL = 10000; // Увеличиваем до 10 секунд между попытками сохранения
    
    if (now - lastSaveAttempt < MIN_SAVE_INTERVAL) {
      // Слишком рано для нового сохранения, пропускаем
      return;
    }
    
    // Определяем пороги значимости изменений для каждого типа данных
    const THRESHOLDS = {
      snot: 10,             // 10 единиц slime
      snotCoins: 1,         // 1 монета
      containerAmount: 5    // 5% от емкости контейнера
    };
    
    // Получаем предыдущий снимок данных, если он есть
    const previousStateRaw = memoryStore.lastStateRaw;
    
    // Функция для проверки существенности изменений с учетом порогов
    const hasSignificantChanges = () => {
      if (!previousStateRaw) return true; // Если нет предыдущего состояния, считаем изменения существенными
      
      // Проверка изменений уровня или улучшений - это всегда существенные изменения
      if (previousStateRaw.container?.level !== state.container.level ||
          previousStateRaw.upgrades?.containerLevel !== state.upgrades.containerLevel ||
          previousStateRaw.upgrades?.fillingSpeedLevel !== state.upgrades.fillingSpeedLevel) {
        return true;
      }
      
      // Проверка изменений количества ресурсов с учетом порогов
      const snotDiff = Math.abs((previousStateRaw.inventory?.snot || 0) - state.inventory.snot);
      const coinsDiff = Math.abs((previousStateRaw.inventory?.snotCoins || 0) - state.inventory.snotCoins);
      
      // Расчет процента изменения количества в контейнере относительно его емкости
      const containerCapacity = state.container.capacity;
      const previousAmount = previousStateRaw.container?.currentAmount || 0;
      const currentAmount = state.container.currentAmount;
      const containerAmountPercent = Math.abs(currentAmount - previousAmount) / containerCapacity * 100;
      
      // Проверяем, преодолевают ли изменения пороги значимости
      return snotDiff >= THRESHOLDS.snot ||
             coinsDiff >= THRESHOLDS.snotCoins ||
             containerAmountPercent >= THRESHOLDS.containerAmount;
    };
    
    // Если изменения не значительные, пропускаем сохранение
    if (previousStateRaw && !hasSignificantChanges()) {
      return;
    }
    
    // Сохраняем текущий снимок состояния для следующего сравнения
    memoryStore.lastStateRaw = {
      inventory: { ...state.inventory },
      container: { ...state.container },
      upgrades: { ...state.upgrades }
    };
    
    // Создаем полное представление о состоянии для сохранения в виде JSON строки
    const stateSnapshot = JSON.stringify({
      inventory: {
        snot: state.inventory.snot,
        snotCoins: state.inventory.snotCoins,
        containerCapacity: state.inventory.containerCapacity,
        fillingSpeed: state.inventory.fillingSpeed,
        containerCapacityLevel: state.inventory.containerCapacityLevel,
        fillingSpeedLevel: state.inventory.fillingSpeedLevel
      },
      container: {
        level: state.container.level,
        capacity: state.container.capacity,
        currentAmount: Math.floor(state.container.currentAmount)
      },
      upgrades: {
        containerLevel: state.upgrades.containerLevel,
        fillingSpeedLevel: state.upgrades.fillingSpeedLevel
      }
    });
    
    // Проверяем, отличается ли JSON-представление от предыдущего
    const previousStateSnapshot = memoryStore.lastStateSnapshot;
    if (previousStateSnapshot && previousStateSnapshot === stateSnapshot) {
      // JSON представления идентичны, не сохраняем
      return;
    }
    
    // Обновляем время последней попытки сохранения и снимок состояния
    memoryStore.lastSaveAttempt = now;
    memoryStore.lastStateSnapshot = stateSnapshot;
    
    console.log("[GameContext] Обнаружены значимые изменения в состоянии игры, планируем сохранение");
    
    // Используем debounced-функцию для сохранения с увеличенной версией
    debouncedSaveState({
      ...state,
      _saveVersion: (state._saveVersion || 0) + 1,
      _lastSaved: new Date().toISOString()
    } as ExtendedGameState);
  }, [state, isInitialized, debouncedSaveState]);

  // Обработка кастомных экшенов
  const wrappedDispatch = useCallback((action: Action) => {
    // Игнорируем повторные установки того же пользователя
    if (action.type === "SET_USER" && 
        action.payload?.id === state.user?.id) {
      return;
    }
    
    // Игнорируем повторные вызовы LOGIN, если пользователь уже загружен
    if (action.type === "LOGIN" && state.user) {
      return;
    }
    
    // Обработка принудительного сохранения
    if (action.type === "FORCE_SAVE_GAME_STATE") {
      forceSaveState();
      return;
    }
    
    // Специальная обработка для RESET_GAME_STATE - сброс всех флагов и переменных
    if (action.type === "RESET_GAME_STATE") {
      // Сбрасываем флаг инициализации
      setIsInitialized(false);
      
      // Очищаем все данные в memoryStore
      Object.keys(memoryStore).forEach(key => {
        delete memoryStore[key];
      });
      
      // Сбрасываем состояние сохранения
      setIsSaving(false);
      
      // Если открыты какие-то сетевые соединения, закрываем их
      try {
        dataService.cancelAllRequests();
      } catch (error) {
        console.error("Error cancelling requests:", error);
      }
    }
    
    dispatch(action);
    
    // Индикация сохранения для UI только для действий, которые визуально влияют на игру
    if (!action.type.startsWith('_') && 
        !action.type.includes('LOAD_GAME_STATE') && 
        !action.type.includes('INITIALIZE')) {
      
      // Используем глобальный флаг вместо useState, чтобы избежать циклических обновлений
      const savingIndicatorKey = state.user?.id ? `saving_indicator_${state.user.id}` : 'saving_indicator_global';
      const unmountInProgress = safeGetGlobalObject<boolean>('unmountInProgress');
      
      // Безопасно устанавливаем индикатор сохранения, только если компонент не размонтирован
      if (typeof window !== 'undefined' && 
          !unmountInProgress[state.user?.id || 'global']) {
        setIsSaving(true);
        
        // Очищаем предыдущий таймер, если он существует
        if (window[savingIndicatorKey]) {
          window.clearTimeout(window[savingIndicatorKey]);
        }
        
        // Устанавливаем новый таймер
        window[savingIndicatorKey] = window.setTimeout(() => {
          // Проверяем, не размонтирован ли компонент перед обновлением состояния
          if (!unmountInProgress[state.user?.id || 'global']) {
            setIsSaving(false);
          }
          // Очищаем ссылку на таймер
          if (window[savingIndicatorKey]) {
            delete window[savingIndicatorKey];
          }
        }, 1000);
      }
    }
  }, [state, dispatch, forceSaveState]);

  // Форсированное сохранение при размонтировании компонента
  useEffect(() => {
    // Защита от повторной инициализации эффекта
    const unmountEffectId = `unmountEffect_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Оптимизация: сохраняем ссылку на ID пользователя, чтобы использовать его даже после размонтирования
    const userId = state.user?.id;
    const isComponentInitialized = isInitialized;
    
    if (typeof window !== 'undefined') {
      if (!window.__unmountEffects) {
        window.__unmountEffects = {};
      }
      window.__unmountEffects[unmountEffectId] = true;
    }
    
    return () => {
      if (typeof window === 'undefined') return;
      
      // Защита от дублирующих вызовов
      if (!window.__unmountEffects || !window.__unmountEffects[unmountEffectId]) {
        return;
      }
      
      // Отмечаем этот эффект как "использованный", чтобы предотвратить повторные вызовы
      window.__unmountEffects[unmountEffectId] = false;
      
      if (!userId || !isComponentInitialized) {
        // Нет смысла сохранять, если нет пользователя или компонент не был инициализирован
        if (window.__unmountEffects) {
          delete window.__unmountEffects[unmountEffectId];
        }
        return;
      }
      
      const unmountKey = `unmount_${userId}`;
        
      // Инициализируем объект при необходимости
      if (!window.__unmountInProgress) {
        window.__unmountInProgress = {};
      }
      
      // Проверяем, не выполняется ли уже размонтирование
      if (window.__unmountInProgress[unmountKey]) {
        console.log(`[GameContext] Размонтирование уже выполняется для ${userId}, пропускаем дублирующий вызов`);
        if (window.__unmountEffects) {
          delete window.__unmountEffects[unmountEffectId];
        }
        return;
      }
      
      // Проверяем, было ли недавнее сохранение
      const now = Date.now();
      const lastSaveAttempt = memoryStore.lastSaveAttempt || 0;
      const lastForceSaveAttempt = memoryStore.lastForceSaveAttempt || 0;
      const lastAttempt = Math.max(lastSaveAttempt, lastForceSaveAttempt);
      const MIN_SAVE_INTERVAL = 5000; // 5 секунд между размонтированиями
      
      // Для предотвращения спама в консоль, будем логировать только каждые 2 секунды
      if (now - lastAttempt < MIN_SAVE_INTERVAL) {
        if (now - (memoryStore.lastUnmountLogTime || 0) > 2000) {
          console.log(`[GameContext] Пропускаем сохранение при размонтировании, последнее сохранение было ${now - lastAttempt}мс назад`);
          memoryStore.lastUnmountLogTime = now;
        }
        
        // Очищаем флаг для этого эффекта, чтобы другие могли подхватить
        if (window.__unmountEffects) {
          delete window.__unmountEffects[unmountEffectId];
        }
        return;
      }
      
      // Пропускаем сохранение, если страница скрыта (при закрытии вкладки)
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        console.log(`[GameContext] Пропускаем сохранение при размонтировании, страница не активна`);
        if (window.__unmountEffects) {
          delete window.__unmountEffects[unmountEffectId];
        }
        return;
      }
      
      // Установка флага размонтирования - делаем это только здесь, когда все проверки пройдены
      window.__unmountInProgress[unmountKey] = true;
      
      // Проверяем, активен ли процесс размонтирования
      if (memoryStore.isUnmountSaveInProgress) {
        console.log(`[GameContext] Процесс сохранения при размонтировании уже активен, пропускаем`);
        
        // Даем сигнал другим процессам, что размонтирование началось, но не будем сохранять
        setTimeout(() => {
          if (window.__unmountInProgress) {
            window.__unmountInProgress[unmountKey] = false;
          }
          if (window.__unmountEffects) {
            delete window.__unmountEffects[unmountEffectId];
          }
        }, 3000);
        
        return;
      }
      
      // Отмечаем все другие эффекты как устаревшие для предотвращения параллельного выполнения
      if (window.__unmountEffects) {
        Object.keys(window.__unmountEffects).forEach(key => {
          if (key !== unmountEffectId) {
            window.__unmountEffects[key] = false;
          }
        });
      }
      
      // Обновляем время последнего сохранения и устанавливаем флаг
      memoryStore.lastSaveAttempt = now;
      memoryStore.lastForceSaveAttempt = now;
      memoryStore.isUnmountSaveInProgress = true;
      
      // Сброс флага и очистка после завершения или тайм-аута
      const clearUnmountFlags = () => {
        if (memoryStore) {
          memoryStore.isUnmountSaveInProgress = false;
        }
        
        if (window.__unmountInProgress) {
          window.__unmountInProgress[unmountKey] = false;
        }
        
        if (window.__unmountEffects) {
          delete window.__unmountEffects[unmountEffectId];
        }
        
        console.log(`[GameContext] Завершено размонтирование для ${userId}`);
      };
      
      // Устанавливаем тайм-аут для автоматической очистки в случае зависания
      const safetyTimer = setTimeout(clearUnmountFlags, 8000);
      
      // Сохраняем все ожидающие изменения
      dataService.saveAllPendingChanges();
      
      // Получаем последнее состояние из хранилища
      const finalState = { 
        ...state, 
        _saveVersion: (state._saveVersion || 0) + 1,
        _lastSaved: new Date().toISOString(),
        _isUnmountSave: true
      };
      
      try {
        console.log(`[GameContext] Размонтирование: Сохраняем состояние для ${userId}`);
        
        // Проверяем, не было ли другого сохранения между началом и текущим моментом
        const currentTime = Date.now();
        const timeSinceLastSaveAttempt = currentTime - (memoryStore.lastSaveAttempt || 0);
        
        if (timeSinceLastSaveAttempt < 1000 && memoryStore.lastSaveAttempt !== now) {
          console.log(`[GameContext] Обнаружено другое сохранение за последние ${timeSinceLastSaveAttempt}мс, пропускаем`);
          clearTimeout(safetyTimer);
          clearUnmountFlags();
          return;
        }
        
        dataService.forceSaveGameState(userId, finalState)
          .then(() => {
            console.log(`[GameContext] Успешно сохранено состояние при размонтировании для ${userId}`);
          })
          .catch(error => {
            console.error("[GameContext] Ошибка при сохранении состояния при размонтировании:", error);
          })
          .finally(() => {
            clearTimeout(safetyTimer);
            clearUnmountFlags();
          });
      } catch (error) {
        console.error("[GameContext] Ошибка при сохранении состояния при размонтировании:", error);
        clearTimeout(safetyTimer);
        clearUnmountFlags();
      }
    };
  }, [state, isInitialized]);

  // Инициализация и восстановление игрового состояния
  useEffect(() => {
    if (state.user?.id && isInitialized) {
      // Проверяем, есть ли резервная копия состояния в localStorage
      try {
        if (typeof window !== 'undefined') {
          const backupGameState = localStorage.getItem('backup_game_state');
          const backupTimestamp = localStorage.getItem('backup_timestamp');
          
          // Проверяем наличие резервной копии и что она не старше 10 минут
          if (backupGameState && backupTimestamp) {
            const timestamp = parseInt(backupTimestamp, 10);
            const now = Date.now();
            const timeDiff = now - timestamp;
            
            // Если копия не старше 10 минут, пытаемся восстановить состояние
            if (timeDiff < 10 * 60 * 1000) { // 10 минут
              try {
                console.log('[GameContext] Обнаружена резервная копия состояния игры, восстанавливаем');
                const parsedState = JSON.parse(backupGameState);
                
                // Обновляем пользователя в восстановленном состоянии
                parsedState.user = state.user;
                
                // Диспатчим действие для загрузки восстановленного состояния
                dispatch({ 
                  type: 'LOAD_GAME_STATE', 
                  payload: {
                    ...parsedState,
                    _isRestoredFromBackup: true
                  }
                });
                
                console.log('[GameContext] Состояние игры восстановлено из резервной копии');
                
                // Удаляем резервную копию после восстановления
                localStorage.removeItem('backup_game_state');
                localStorage.removeItem('backup_timestamp');
              } catch (parseError) {
                console.error('[GameContext] Ошибка при восстановлении состояния игры:', parseError);
                // В случае ошибки удаляем некорректную резервную копию
                localStorage.removeItem('backup_game_state');
                localStorage.removeItem('backup_timestamp');
              }
            } else {
              // Удаляем устаревшую резервную копию
              localStorage.removeItem('backup_game_state');
              localStorage.removeItem('backup_timestamp');
            }
          }
        }
      } catch (error) {
        console.error('[GameContext] Ошибка при проверке резервной копии:', error);
      }
    }
  }, [state.user?.id, isInitialized, dispatch]);

  // Очистка таймеров индикации сохранения при размонтировании
  useEffect(() => {
    return () => {
      // Очищаем все таймеры индикаторов сохранения
      if (typeof window !== 'undefined' && state.user?.id) {
        const savingIndicatorKey = `saving_indicator_${state.user.id}`;
        if (window[savingIndicatorKey]) {
          window.clearTimeout(window[savingIndicatorKey]);
          delete window[savingIndicatorKey];
        }
        
        // Также очищаем глобальный индикатор
        if (window['saving_indicator_global']) {
          window.clearTimeout(window['saving_indicator_global']);
          delete window['saving_indicator_global'];
        }
      }
    };
  }, [state.user?.id]);

  // В эффекте монтирования компонента
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Получаем доступ к глобальным объектам, автоматически инициализируя их при необходимости
      const unmountInProgress = safeGetGlobalObject<boolean>('unmountInProgress');
      safeGetGlobalObject<number>('lastLoadAttempts');
      safeGetGlobalObject<boolean>('initializeInProgress');
      
      // Сбрасываем флаг размонтирования при монтировании
      const userIdKey = state.user?.id || 'global';
      unmountInProgress[userIdKey] = false;

      // Устанавливаем флаг размонтирования при размонтировании
      return () => {
        if (typeof window !== 'undefined') {
          const unmountInProgress = safeGetGlobalObject<boolean>('unmountInProgress');
          unmountInProgress[userIdKey] = true;
        }
      };
    }
  }, [state.user?.id]);

  return (
    <GameStateContext.Provider value={state}>
      <GameDispatchContext.Provider value={wrappedDispatch}>
        <IsSavingContext.Provider value={isSaving}>
          {children}
        </IsSavingContext.Provider>
      </GameDispatchContext.Provider>
    </GameStateContext.Provider>
  )
}

export { GameStateContext, GameDispatchContext }

