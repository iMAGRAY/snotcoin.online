'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { GameStateContext, GameDispatchContext, IsSavingContext } from '../contexts'
import { gameReducer } from '../../../reducers/gameReducer'
import { createInitialGameState, Action, GameState } from '../../../types/gameTypes'
import { 
  cleanupLocalStorage, 
  safeSetItem, 
  getLocalStorageSize 
} from '../../../services/localStorageManager'
import * as storageService from '../../../services/storageService'
import { StorageType } from '../../../services/storageService'

interface GameProviderProps {
  children: React.ReactNode
  userId: string
  enableAutoSave?: boolean
  autoSaveInterval?: number
}

/**
 * Нормализует userId, удаляя префикс если он есть
 * @param userId исходный userId
 * @returns нормализованный userId
 */
const normalizeUserId = (userId: string | undefined): string => {
  if (!userId) return '';
  
  // Удаляем префиксы, если они есть
  const prefixes = ['farcaster_', 'twitter_', 'github_', 'email_'];
  for (const prefix of prefixes) {
    if (userId.startsWith(prefix)) {
      return userId.substring(prefix.length);
    }
  }
  
  return userId;
};

// Правильно определяем тип ExtendedGameState
interface ExtendedGameState {
  _lastSaved: string;
  _userId: string;
  _saveVersion: number;
  [key: string]: any; // Дополнительные поля из GameState
}

// Переносим validateGameState и createDefaultGameState из gameDataService.ts
/**
 * Создает дефолтное состояние игры для случаев, когда валидация не удалась
 */
function createDefaultGameState(userId: string): GameState {
  return {
    _userId: userId, // Добавляем userId
    inventory: {
      snot: 0,
      snotCoins: 0,
      containerCapacity: 1,
      containerSnot: 0,
      fillingSpeed: 1,
      containerCapacityLevel: 1,
      fillingSpeedLevel: 1,
      collectionEfficiency: 1,
      lastUpdateTimestamp: Date.now()
    },
    container: {
      level: 1,
      capacity: 1,
      currentAmount: 0,
      fillRate: 1
    },
    upgrades: {
      containerLevel: 1,
      fillingSpeedLevel: 1,
      clickPower: { level: 1, value: 1 },
      passiveIncome: { level: 1, value: 0.1 },
      collectionEfficiencyLevel: 1
    },
    _skipSave: false,
    _lastSaved: new Date().toISOString(),
    _saveVersion: 1
  } as GameState;
}

/**
 * Проверяет структуру объекта GameState и исправляет/устанавливает поля с некорректными значениями
 * @param state Состояние игры для проверки
 * @param userId Текущий userId для добавления в дефолтное состояние при ошибке
 * @returns Проверенное и исправленное состояние игры
 */
export function validateGameState(state: any, userId: string): GameState {
  if (!state || typeof state !== 'object') {
    console.error('[GameProvider] validateGameState: Отсутствует или некорректное состояние для валидации');
    return createDefaultGameState(userId);
  }
  
  try {
    // Создаем копию, чтобы не мутировать исходный объект напрямую
    const validatedState = { ...state };
    
    // Проверяем и исправляем основные поля
    if (!validatedState.inventory || typeof validatedState.inventory !== 'object') {
      console.warn('[GameProvider] validateGameState: Отсутствует или некорректный inventory, будет создан');
      validatedState.inventory = createDefaultGameState(userId).inventory;
    } else {
      // Проверяем типы полей инвентаря
      validatedState.inventory = {
        snot: Number(validatedState.inventory.snot || 0),
        snotCoins: Number(validatedState.inventory.snotCoins || 0),
        containerSnot: Number(validatedState.inventory.containerSnot || 0),
        containerCapacity: Number(validatedState.inventory.containerCapacity || 1),
        containerCapacityLevel: Number(validatedState.inventory.containerCapacityLevel || 1),
        fillingSpeed: Number(validatedState.inventory.fillingSpeed || 1),
        fillingSpeedLevel: Number(validatedState.inventory.fillingSpeedLevel || 1),
        collectionEfficiency: Number(validatedState.inventory.collectionEfficiency || 1),
        lastUpdateTimestamp: validatedState.inventory.lastUpdateTimestamp || Date.now()
      };
    }
    
    if (!validatedState.container || typeof validatedState.container !== 'object') {
      console.warn('[GameProvider] validateGameState: Отсутствует или некорректный container, будет создан');
      validatedState.container = createDefaultGameState(userId).container;
    } else {
       validatedState.container.level = Number(validatedState.container.level || 1);
       validatedState.container.currentAmount = Number(validatedState.container.currentAmount || 0);
       validatedState.container.fillRate = Number(validatedState.container.fillRate || 1);
    }
    
    if (!validatedState.upgrades || typeof validatedState.upgrades !== 'object') {
      console.warn('[GameProvider] validateGameState: Отсутствует или некорректный upgrades, будет создан');
      validatedState.upgrades = createDefaultGameState(userId).upgrades;
    } else {
       validatedState.upgrades.containerLevel = Number(validatedState.upgrades.containerLevel || 1);
       validatedState.upgrades.fillingSpeedLevel = Number(validatedState.upgrades.fillingSpeedLevel || 1);
       validatedState.upgrades.collectionEfficiencyLevel = Number(validatedState.upgrades.collectionEfficiencyLevel || 1);
       
       if (!validatedState.upgrades.clickPower || typeof validatedState.upgrades.clickPower !== 'object') {
         validatedState.upgrades.clickPower = { level: 1, value: 1 };
       } else {
         validatedState.upgrades.clickPower.level = Number(validatedState.upgrades.clickPower.level || 1);
         validatedState.upgrades.clickPower.value = Number(validatedState.upgrades.clickPower.value || 1);
       }
       
       if (!validatedState.upgrades.passiveIncome || typeof validatedState.upgrades.passiveIncome !== 'object') {
         validatedState.upgrades.passiveIncome = { level: 1, value: 0.1 };
       } else {
         validatedState.upgrades.passiveIncome.level = Number(validatedState.upgrades.passiveIncome.level || 1);
         validatedState.upgrades.passiveIncome.value = Number(validatedState.upgrades.passiveIncome.value || 0.1);
       }
    }
    
    // Убеждаемся, что системные поля присутствуют
    validatedState._userId = userId;
    validatedState._lastSaved = state._lastSaved || new Date().toISOString();
    validatedState._saveVersion = Number(state._saveVersion || 1);
    validatedState._skipSave = state._skipSave === true; // Приводим к boolean

    return validatedState as GameState;
  } catch (error) {
    console.error('[GameProvider] Ошибка при валидации состояния:', error);
    return createDefaultGameState(userId);
  }
}

export function GameProvider({
  children,
  userId,
  enableAutoSave = true,
  autoSaveInterval = 5000
}: GameProviderProps) {
  // Инициализируем состояние игры с использованием userId из props
  const [state, dispatch] = React.useReducer(
    gameReducer,
    // Используем userId напрямую для создания начального состояния, 
    // но это состояние будет перезаписано при загрузке
    createInitialGameState(userId) 
  )

  // Состояние для отслеживания процесса сохранения
  const [isSaving, setIsSaving] = useState<boolean>(false)
  
  // Состояние для отслеживания загрузки данных
  const [isLoading, setIsLoading] = useState<boolean>(false)
  
  // Отслеживаем, было ли выполнено начальное сохранение
  const initialLoadDoneRef = useRef<boolean>(false)

  // Ref для отслеживания активного таймера автосохранения
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Ref для хранения последнего сохраненного userId
  const lastUserIdRef = useRef<string | undefined>(userId)
  
  // Ref для отслеживания, идет ли уже запрос на загрузку
  const loadRequestInProgressRef = useRef<boolean>(false)

  // Загрузка данных пользователя
  const loadUserData = useCallback(async (userId: string) => {
    try {
      if (!userId) {
        console.error('[GameProvider] Отсутствует ID пользователя для загрузки данных');
        return false;
      }
      
      console.log('[GameProvider] Starting state load for userId:', userId);
      
      // Сначала пробуем загрузить из localStorage напрямую
      let gameData = null;
      try {
        const localData = localStorage.getItem(`gameState_${userId}`);
        if (localData) {
          gameData = JSON.parse(localData);
          console.log('[GameProvider] Loaded game state directly from localStorage');
        }
      } catch (localError) {
        console.warn('[GameProvider] Error loading from localStorage directly:', localError);
      }
      
      // Если не нашли прямое сохранение, используем storageService
      if (!gameData) {
        try {
          const loadResult = await storageService.loadGameState(userId);
          gameData = loadResult?.data;
          
          if (gameData) {
            console.log('[GameProvider] Data found for', userId);
          } else {
            console.log('[GameProvider] Data not found for', userId);
          }
        } catch (storageError) {
          console.error('[GameProvider] Error loading from storageService:', storageError);
        }
      }
      
      // Если нашли данные, загружаем их в состояние
      if (gameData) {
        dispatch({ type: 'LOAD_GAME_STATE', payload: gameData });
        return true;
      }
      
      // Если данные не найдены, создаем новое состояние
      console.log('[GameProvider] No saved state found for', userId, ', initializing default state');
      dispatch({ type: 'LOAD_GAME_STATE', payload: createDefaultGameState(userId) });
      return false;
    } catch (error) {
      console.error('[GameProvider] Error loading user data:', error);
      dispatch({ type: 'LOAD_GAME_STATE', payload: createDefaultGameState(userId) });
      return false;
    }
  }, [dispatch]);

  // Функция для сохранения состояния игры
  const saveState = useCallback(async () => {
    if (!userId || !enableAutoSave) { 
      return;
    }
    
    if (isSaving || state._skipSave) {
      return;
    }
    
    const normalizedId = normalizeUserId(userId);
    if (!normalizedId) {
      console.warn(`[GameProvider] Cannot save state: normalized userId is empty`);
      return;
    }

    const prepareGameStateForSave = (currentState: GameState): ExtendedGameState => {
      const stateToSave = { ...currentState };
      // Обновляем метаданные
      stateToSave._lastSaved = new Date().toISOString();
      stateToSave._userId = userId;
      stateToSave._saveVersion = (stateToSave._saveVersion || 0) + 1;
      return stateToSave;
    };
    
    try {
      setIsSaving(true);
      const preparedState = prepareGameStateForSave(state);
      
      // Создаем объект для сохранения БЕЗ поля _skipSave
      const { _skipSave, ...stateToActuallySave } = preparedState;

      // Сохраняем без лишних логов
      const { success, storageType } = await storageService.saveGameState(
        normalizedId,
        stateToActuallySave, // Передаем объект без _skipSave
        preparedState._saveVersion // Версию берем из подготовленного состояния
      );

      lastUserIdRef.current = userId;
      
      if (typeof window !== 'undefined') {
        if (success) {
          window.dispatchEvent(new CustomEvent('game-saved', {
            detail: { userId, storageType }
          }));
        } else {
          console.warn(`[GameProvider] Save failed, creating backup...`);
          window.dispatchEvent(new CustomEvent('game-save-error', {
            detail: { userId, error: 'SAVE_FAILED' }
          }));
          try {
            await storageService.createBackup(normalizedId, preparedState, preparedState._saveVersion || 1);
          } catch (backupError) {
            console.error(`[GameProvider] Failed to create backup:`, backupError);
          }
        }
      }
    } catch (error) {
      console.error(`[GameProvider] Error during saveState:`, error);
      // Попытка создать резервную копию в случае ошибки
      try {
        if (normalizedId) {
          const backupState = prepareGameStateForSave(state);
          await storageService.createBackup(normalizedId, backupState, backupState._saveVersion || 1);
        } else {
          console.warn('[GameProvider] Cannot create backup on save error: missing normalizedId');
        }
      } catch (backupError) {
        console.error(`[GameProvider] Failed to create backup:`, backupError);
      }
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('game-save-error', {
          detail: { userId, error: error instanceof Error ? error.message : String(error) }
        }));
      }
    } finally {
      setIsSaving(false);
    }
  }, [state, enableAutoSave, userId, isSaving]);

  // Оборачиваем dispatch для перезапуска таймера автосохранения
  const wrappedDispatch = useCallback(
    (action: Action) => {
      dispatch(action);
      
      if (enableAutoSave && userId) {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }
        
        // Убираем лишний лог, запускаем таймер сохранения
        autoSaveTimerRef.current = setTimeout(() => {
           saveState().catch(error => {
             console.error(`[GameProvider] Error during autosave:`, error);
           });
        }, autoSaveInterval);
      }
    },
    [saveState, enableAutoSave, userId, autoSaveInterval]
  );

  // Отдельный эффект для загрузки, который срабатывает при изменении userId
  useEffect(() => {
    // Проверяем, изменился ли userId (сравниваем userId из props с lastUserIdRef)
    if (userId !== lastUserIdRef.current) {
      console.log(`[GameProvider] Changed userId: ${lastUserIdRef.current || 'undefined'} -> ${userId}`);
      initialLoadDoneRef.current = false;
      // Сбрасываем флаг запроса на загрузку при смене пользователя
      loadRequestInProgressRef.current = false; 
    }
    
    // Загружаем сохраненное состояние при монтировании или изменении userId
    // Убираем проверку loadRequestInProgressRef, так как смена userId должна всегда инициировать загрузку
    if (userId && !initialLoadDoneRef.current) { 
      // Запускаем загрузку без лишнего лога
      loadRequestInProgressRef.current = true; // Устанавливаем флаг перед вызовом
      
      // Добавляем обработку ошибок при загрузке
      loadUserData(userId).catch(error => {
        console.error(`[GameProvider] Critical loading error:`, error);
        // Устанавливаем флаг, что загрузка завершена (чтобы избежать циклов повторных загрузок)
        initialLoadDoneRef.current = true;
        // Сбрасываем флаг запроса в случае ошибки
        loadRequestInProgressRef.current = false; 
        
        // Инициализируем новое состояние в случае ошибки
        dispatch({
          type: 'LOAD_GAME_STATE',
          // Используем userId напрямую
          payload: createDefaultGameState(userId) 
        });
      });
    }
  }, [userId, loadUserData]);
  
  // Предоставляем состояние и диспетчер через контексты
  return (
    <GameStateContext.Provider value={state}>
      <GameDispatchContext.Provider value={wrappedDispatch}>
        <IsSavingContext.Provider value={isSaving}>
          {children}
        </IsSavingContext.Provider>
      </GameDispatchContext.Provider>
    </GameStateContext.Provider>
  );
}

export default GameProvider 