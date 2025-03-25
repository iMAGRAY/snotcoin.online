"use client"

import React, { createContext, useContext, useReducer, useEffect, useCallback, useState, useMemo, type ReactNode } from 'react'
import type { GameState, Action, ExtendedGameState } from '../types/gameTypes'
import { gameReducer } from '../reducers/gameReducer'
import { initialState } from '../constants/gameConstants'
import { debounce } from 'lodash'
import { isUserAuthenticated, markUserAuthenticated, isSameAuthenticatedUser } from '../utils/telegram-auth'
import * as dataService from '../services/dataService'

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

  // Универсальная функция сохранения состояния
  const saveState = useCallback(async (stateToSave: ExtendedGameState, isForced: boolean = false) => {
    if (!stateToSave.user?.telegram_id || !isInitialized) {
      return false;
    }
    
    setIsSaving(true);
    
    try {
      // Подготавливаем состояние к сохранению
      const preparedState = { 
        ...stateToSave, 
        _saveVersion: (stateToSave._saveVersion || 0) + 1,
        _lastSaved: new Date().toISOString(),
        _isForced: isForced
      };
      
      // Выбираем метод сохранения в зависимости от типа
      const saveMethod = isForced ? 
        dataService.forceSaveGameState : 
        dataService.saveGameState;
      
      await saveMethod(stateToSave.user.telegram_id, preparedState);
      return true;
    } catch (error) {
      // Пробуем повторно сохранить только при обычном сохранении
      if (!isForced) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const retryState = { 
            ...stateToSave, 
            _saveVersion: (stateToSave._saveVersion || 0) + 1,
            _lastSaved: new Date().toISOString(),
            _isRetry: true
          };
          
          await dataService.saveGameState(stateToSave.user.telegram_id, retryState);
          return true;
        } catch (retryError) {
          return false;
        }
      }
      
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isInitialized]);
  
  // Принудительное сохранение (для использования в диспетчере)
  const forceSaveState = useCallback((stateToSave: ExtendedGameState) => {
    return saveState(stateToSave, true);
  }, [saveState]);

  // Загрузка сохраненного состояния
  useEffect(() => {
    const loadSavedState = async () => {
      if (state.user?.telegram_id && !isInitialized) {
        try {
          // Проверяем, был ли этот пользователь уже аутентифицирован
          if (isSameAuthenticatedUser(state.user.telegram_id)) {
            // Загружаем состояние с сервера для обеспечения актуальности данных
            const savedState = await dataService.loadGameState(state.user.telegram_id);
            
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
            return;
          }
          
          // Загружаем состояние напрямую с сервера
          const savedState = await dataService.loadGameState(state.user.telegram_id);
          
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
          markUserAuthenticated(state.user.telegram_id);
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
        }
      }
    };

    loadSavedState();
  }, [state.user?.telegram_id, isInitialized, dispatch, state, synchronizeResources, saveState]);

  // Сохранение состояния с debounce
  const debouncedSaveState = useMemo(
    () => debounce(async (state: ExtendedGameState) => {
      await saveState(state);
    }, 1000),
    [saveState]
  );

  // Обработчик beforeunload для сохранения при закрытии
  useEffect(() => {
    if (!state.user?.telegram_id || !isInitialized) return;
    
    // Настраиваем обработчик для сохранения при закрытии
    const removeHandler = dataService.setupBeforeUnloadHandler(
      state.user.telegram_id,
      () => ({ 
        ...state, 
        _saveVersion: (state._saveVersion || 0) + 1,
        _lastSaved: new Date().toISOString(),
        _isBeforeUnloadSave: true
      })
    );
    
    return removeHandler;
  }, [state.user?.telegram_id, isInitialized, state]);

  // Отслеживание изменений состояния
  useEffect(() => {
    if (state.user?.telegram_id && isInitialized) {
      debouncedSaveState(state as ExtendedGameState);
    }
  }, [state, debouncedSaveState, isInitialized]);

  // Обработка кастомных экшенов
  const wrappedDispatch = useCallback((action: Action) => {
    // Игнорируем повторные установки того же пользователя
    if (action.type === "SET_USER" && 
        action.payload?.telegram_id === state.user?.telegram_id) {
      return;
    }
    
    // Игнорируем повторные вызовы LOGIN, если пользователь уже загружен
    if (action.type === "LOGIN" && state.user) {
      return;
    }
    
    // Обработка принудительного сохранения
    if (action.type === "FORCE_SAVE_GAME_STATE") {
      forceSaveState(state);
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
    
    // Индикация сохранения для UI (кроме частых обновлений)
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1000);
  }, [state, dispatch, forceSaveState]);

  // Форсированное сохранение при размонтировании компонента
  useEffect(() => {
    return () => {
      if (state.user?.telegram_id && isInitialized) {
        // Сохраняем все ожидающие изменения
        dataService.saveAllPendingChanges();
        
        // Сохраняем окончательное состояние
        const finalState = { 
          ...state, 
          _saveVersion: (state._saveVersion || 0) + 1,
          _lastSaved: new Date().toISOString(),
          _isUnmountSave: true
        };
        
        saveState(finalState, true);
      }
    };
  }, [state, isInitialized, saveState]);

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

