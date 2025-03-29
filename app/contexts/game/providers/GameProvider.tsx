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
      containerCapacity: 100,
      containerSnot: 0,
      fillingSpeed: 1,
      containerCapacityLevel: 1,
      fillingSpeedLevel: 1,
      collectionEfficiency: 1,
      Cap: 100,
      lastUpdateTimestamp: Date.now()
    },
    container: {
      level: 1,
      capacity: 100,
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
      validatedState.inventory.snot = Number(validatedState.inventory.snot || 0);
      validatedState.inventory.snotCoins = Number(validatedState.inventory.snotCoins || 0);
      validatedState.inventory.containerCapacity = Number(validatedState.inventory.containerCapacity || 100);
      validatedState.inventory.fillingSpeed = Number(validatedState.inventory.fillingSpeed || 1);
      validatedState.inventory.containerCapacityLevel = Number(validatedState.inventory.containerCapacityLevel || 1);
      validatedState.inventory.fillingSpeedLevel = Number(validatedState.inventory.fillingSpeedLevel || 1);
      validatedState.inventory.collectionEfficiency = Number(validatedState.inventory.collectionEfficiency || 1);
      validatedState.inventory.Cap = Number(validatedState.inventory.Cap || 100);
      validatedState.inventory.lastUpdateTimestamp = Number(validatedState.inventory.lastUpdateTimestamp || Date.now());
    }
    
    if (!validatedState.container || typeof validatedState.container !== 'object') {
      console.warn('[GameProvider] validateGameState: Отсутствует или некорректный container, будет создан');
      validatedState.container = createDefaultGameState(userId).container;
    } else {
       validatedState.container.level = Number(validatedState.container.level || 1);
       validatedState.container.capacity = Number(validatedState.container.capacity || 100);
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

  // Загрузка сохраненного состояния
  const loadSavedState = useCallback(async () => {
    if (isLoading || initialLoadDoneRef.current) {
      console.log(`[GameProvider] Load request ignored. isLoading: ${isLoading}, initialLoadDone: ${initialLoadDoneRef.current}`);
      return;
    }
    
    try {
      console.log(`[GameProvider] Starting state load for userId: ${userId}`);
      setIsLoading(true);
      
      const normalizedId = normalizeUserId(userId); 
      
      if (!normalizedId) {
        console.warn(`[GameProvider] Cannot load state: normalized userId is empty`);
        setIsLoading(false);
        initialLoadDoneRef.current = true; // Считаем "загрузку" (пустого состояния) завершенной
        return;
      }
      
      // Логируем вызов loadGameState
      console.log(`[GameProvider] Calling storageService.loadGameState for normalizedId: ${normalizedId}`);
      const { data, source } = await storageService.loadGameState(normalizedId);
      
      // Логируем результат loadGameState
      console.log(`[GameProvider] storageService.loadGameState returned. Source: ${source}, Data found: ${!!data}`);
      if (data && typeof data === 'object') {
         console.log(`[GameProvider] Loaded data preview (keys): ${Object.keys(data).join(', ')}`);
      }
      
      if (data) {
        console.log(`[GameProvider] Successfully loaded state for ${userId} from ${source}`);
        
        // Логируем вызов validateGameState
        console.log('[GameProvider] Calling validateGameState...');
        const validatedData = validateGameState(data, userId);
        // Логируем результат валидации (опционально, может быть слишком много данных)
        // console.log('[GameProvider] validateGameState result:', validatedData);

        // Загружаем состояние
        try {
          // Логируем вызов dispatch
          console.log(`[GameProvider] Dispatching LOAD_GAME_STATE for ${userId}`);
          dispatch({
            type: 'LOAD_GAME_STATE',
            payload: validatedData // Используем валидированные данные
          });
          console.log(`[GameProvider] Dispatched LOAD_GAME_STATE successfully for ${userId}`);
          
          // Переносим данные в основное хранилище, если они были загружены из localStorage в гибридном режиме
          if (source === StorageType.LOCAL_STORAGE && storageService.getStorageConfig().preferredStorage === StorageType.HYBRID) {
            console.log(`[GameProvider] Migrating data from localStorage to IndexedDB for ${normalizedId}`);
            try {
              await storageService.saveGameState(normalizedId, validatedData, validatedData._saveVersion || 1);
              console.log(`[GameProvider] Migration successful.`);
            } catch (migrationError) {
              console.error(`[GameProvider] Error migrating data to IndexedDB:`, migrationError);
            }
          }
          
        } catch (loadError) {
          console.error(`[GameProvider] Error dispatching loaded state for ${userId}:`, loadError);
          // Если dispatch не удался, инициализируем дефолтное состояние
          console.log(`[GameProvider] Initializing default state due to dispatch error for ${userId}`);
          dispatch({ type: 'LOAD_GAME_STATE', payload: createDefaultGameState(userId) });
        }
      } else {
        console.log(`[GameProvider] No saved state found for ${userId}, initializing default state`);
        dispatch({
          type: 'LOAD_GAME_STATE',
          payload: createDefaultGameState(userId) 
        });
      }
    } catch (error) {
      console.error(`[GameProvider] Error during loadSavedState for ${userId}:`, error);
      // В случае ошибки инициализируем новое состояние
      console.log(`[GameProvider] Initializing default state due to load error for ${userId}`);
      dispatch({
        type: 'LOAD_GAME_STATE',
        payload: createDefaultGameState(userId) 
      });
    } finally {
      // Завершаем загрузку
      console.log(`[GameProvider] Finishing load process for userId: ${userId}. Setting isLoading=false, initialLoadDone=true`);
      setIsLoading(false);
      initialLoadDoneRef.current = true; 
      lastUserIdRef.current = userId;
      loadRequestInProgressRef.current = false;
    }
  }, [userId, isLoading, dispatch]);

  // Функция для сохранения состояния игры
  const saveState = useCallback(async () => {
    if (!userId || !enableAutoSave) { 
      console.log(`[GameProvider] Save skipped. userId: ${userId}, enableAutoSave: ${enableAutoSave}`);
      return;
    }
    
    if (isSaving || state._skipSave) {
      console.log(`[GameProvider] Save skipped. isSaving: ${isSaving}, state._skipSave: ${state._skipSave}`);
      return;
    }
    
    const normalizedId = normalizeUserId(userId);
    if (!normalizedId) {
      console.warn(`[GameProvider] Cannot save state: normalized userId is empty`);
      return;
    }

    const prepareGameStateForSave = (currentState: GameState): ExtendedGameState => {
      const stateToSave = { ...currentState };
      // НЕ удаляем _skipSave здесь
      // if ('_skipSave' in stateToSave) {
      //    delete stateToSave._skipSave;
      // }
      
      // Обновляем метаданные
      stateToSave._lastSaved = new Date().toISOString();
      stateToSave._userId = userId;
      stateToSave._saveVersion = (stateToSave._saveVersion || 0) + 1;
      return stateToSave; // Возвращаем объект с _skipSave
    };
    
    try {
      setIsSaving(true);
      const preparedState = prepareGameStateForSave(state);
      console.log(`[GameProvider] Starting state save for userId: ${normalizedId}. Version: ${preparedState._saveVersion}`);
      
      // Создаем объект для сохранения БЕЗ поля _skipSave
      const { _skipSave, ...stateToActuallySave } = preparedState;

      // Логируем вызов saveGameState
      console.log(`[GameProvider] Calling storageService.saveGameState for normalizedId: ${normalizedId}`);
      const { success, storageType } = await storageService.saveGameState(
        normalizedId,
        stateToActuallySave, // Передаем объект без _skipSave
        preparedState._saveVersion // Версию берем из подготовленного состояния
      );
      // Логируем результат сохранения
      console.log(`[GameProvider] storageService.saveGameState finished. Success: ${success}, StorageType: ${storageType}`);

      lastUserIdRef.current = userId;
      
      if (typeof window !== 'undefined') {
        if (success) {
          console.log(`[GameProvider] Save successful for ${userId}. Dispatching game-saved event.`);
          window.dispatchEvent(new CustomEvent('game-saved', {
            detail: { userId, storageType }
          }));
        } else {
          console.warn(`[GameProvider] Save failed for ${userId}. Attempting backup...`);
          window.dispatchEvent(new CustomEvent('game-save-error', {
            detail: { userId, error: 'SAVE_FAILED' }
          }));
          try {
            await storageService.createBackup(normalizedId, preparedState, preparedState._saveVersion || 1);
            console.log(`[GameProvider] Backup created successfully for ${userId} after failed save.`);
          } catch (backupError) {
            console.error(`[GameProvider] Failed to create backup for ${userId} after failed save:`, backupError);
          }
        }
      }
    } catch (error) {
      console.error(`[GameProvider] Error during saveState for ${userId}:`, error);
      // Попытка создать резервную копию в случае ошибки
      try {
        if (normalizedId) {
          const backupState = prepareGameStateForSave(state);
          await storageService.createBackup(normalizedId, backupState, backupState._saveVersion || 1);
          console.log(`[GameProvider] Backup created successfully for ${userId} after save error.`);
        } else {
          console.warn('[GameProvider] Cannot create backup on save error: missing normalizedId');
        }
      } catch (backupError) {
        console.error(`[GameProvider] Failed to create backup for ${userId} after save error:`, backupError);
      }
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('game-save-error', {
          detail: { userId, error: error instanceof Error ? error.message : String(error) }
        }));
      }
    } finally {
      console.log(`[GameProvider] Finishing save process for userId: ${userId}. Setting isSaving=false`);
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
        
        // Логируем установку таймера
        console.log(`[GameProvider] Action ${action.type}. Setting autosave timer (${autoSaveInterval}ms) for userId: ${userId}`);
        autoSaveTimerRef.current = setTimeout(() => {
           console.log(`[GameProvider] Autosave timer triggered for userId: ${userId}. Calling saveState...`);
           saveState().catch(error => {
             console.error(`[GameProvider] Error during autosave for userId: ${userId}:`, error);
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
      console.log(`[GameProvider] Изменился userId: ${lastUserIdRef.current || 'undefined'} -> ${userId}`);
      initialLoadDoneRef.current = false;
      // Сбрасываем флаг запроса на загрузку при смене пользователя
      loadRequestInProgressRef.current = false; 
    }
    
    // Загружаем сохраненное состояние при монтировании или изменении userId
    // Убираем проверку loadRequestInProgressRef, так как смена userId должна всегда инициировать загрузку
    if (userId && !initialLoadDoneRef.current) { 
      console.log(`[GameProvider] Запуск загрузки состояния для ${userId}`);
      loadRequestInProgressRef.current = true; // Устанавливаем флаг перед вызовом
      
      // Добавляем обработку ошибок при загрузке
      loadSavedState().catch(error => {
        console.error(`[GameProvider] Критическая ошибка при загрузке состояния:`, error);
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
  }, [userId, loadSavedState]);
  
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