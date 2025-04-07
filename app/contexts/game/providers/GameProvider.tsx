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
import { secureLocalLoad, secureLocalSave } from '../../../utils/localSaveProtection'
import { compareSaves } from '../../../utils/localSaveChecker'

interface GameProviderProps {
  children: React.ReactNode
  userId?: string
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
      containerCapacity: 5, // Начальная вместимость контейнера
      containerSnot: 0,
      fillingSpeed: 0.01, // Начальная скорость наполнения
      containerCapacityLevel: 1, // Начальный уровень вместимости
      fillingSpeedLevel: 1, // Начальный уровень скорости наполнения
      collectionEfficiency: 1, // Начальная эффективность сбора
      energy: 500, // Инициализация энергии
      lastUpdateTimestamp: Date.now()
    },
    containers: [],
    resources: {
      water: 0,
      energy: 0
    },
    stats: {
      totalSnot: 0,
      totalSnotCoins: 0
    },
    _saveVersion: 1
  } as unknown as GameState;
}

/**
 * Функция для валидации игрового состояния
 * @param state Состояние для валидации
 * @returns Валидированное состояние
 */
function validateGameState(state: GameState): GameState {
  const validatedState = { ...state };

  // Проверяем основные поля
  if (!validatedState.inventory) {
    validatedState.inventory = {
      snot: 0,
      snotCoins: 0,
      containerSnot: 0,
      containerCapacity: 1,
      containerCapacityLevel: 1,
      fillingSpeed: 1,
      fillingSpeedLevel: 1,
      collectionEfficiency: 1.0,
      energy: 500,
      lastEnergyUpdateTime: Date.now(),
      lastUpdateTimestamp: Date.now()
    };
  } else {
    // Валидируем поля инвентаря
    validatedState.inventory = {
      snot: Number(validatedState.inventory.snot || 0),
      snotCoins: Number(validatedState.inventory.snotCoins || 0),
      containerSnot: Number(validatedState.inventory.containerSnot || 0),
      containerCapacity: Number(validatedState.inventory.containerCapacity || 1),
      containerCapacityLevel: Number(validatedState.inventory.containerCapacityLevel || 1),
      fillingSpeed: Number(validatedState.inventory.fillingSpeed || 1),
      fillingSpeedLevel: Number(validatedState.inventory.fillingSpeedLevel || 1),
      collectionEfficiency: Number(validatedState.inventory.collectionEfficiency || 1),
      energy: Number(validatedState.inventory.energy || 500),
      lastEnergyUpdateTime: validatedState.inventory.lastEnergyUpdateTime || Date.now(),
      lastUpdateTimestamp: validatedState.inventory.lastUpdateTimestamp || Date.now()
    };
  }

  return validatedState;
}

// Функция для загрузки экстренных сохранений
const loadEmergencySaves = (userId: string): any => {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  
  try {
    console.log('[GameProvider] Поиск экстренных сохранений для', userId);
    
    // Ищем ключи экстренных сохранений
    const emergencySaveKeys: string[] = [];
    const EMERGENCY_SAVE_PREFIX = 'emergency_save_';
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${EMERGENCY_SAVE_PREFIX}${userId}`)) {
        emergencySaveKeys.push(key);
      }
    }
    
    if (emergencySaveKeys.length === 0) {
      console.log('[GameProvider] Экстренных сохранений не найдено');
      return null;
    }
    
    // Сортируем по времени, берем самое последнее
    emergencySaveKeys.sort((a, b) => {
      const timeA = parseInt(a.split('_').pop() || '0', 10);
      const timeB = parseInt(b.split('_').pop() || '0', 10);
      return timeB - timeA; // Сортировка от нового к старому
    });
    
    // Берем самое свежее сохранение
    const latestKey = emergencySaveKeys[0];
    console.log(`[GameProvider] Найдено ${emergencySaveKeys.length} экстренных сохранений, используем последнее: ${latestKey}`);
    
    // Загружаем данные
    if (latestKey) {
      const rawData = localStorage.getItem(latestKey);
      if (!rawData) {
        console.warn('[GameProvider] Экстренное сохранение пусто');
        return null;
      }
      
      const emergencyData = JSON.parse(rawData);
      
      // Проверяем основные данные
      if (!emergencyData || !emergencyData.inventory || typeof emergencyData.inventory.snot !== 'number') {
        console.warn('[GameProvider] Экстренное сохранение некорректно');
        return null;
      }
      
      console.log('[GameProvider] Успешно загружено экстренное сохранение:', {
        timestamp: new Date(emergencyData.timestamp).toISOString(),
        snot: emergencyData.inventory.snot
      });
      
      return emergencyData;
    }
  } catch (error) {
    console.error('[GameProvider] Ошибка при загрузке экстренных сохранений:', error);
    return null;
  }
};

// Функция для сравнения данных с экстренным сохранением  
const mergeWithEmergencySave = (gameState: any, emergencyData: any): any => {
  if (!gameState || !emergencyData) return gameState;
  
  try {
    // Проверяем, что экстренное сохранение новее
    const gameStateTime = gameState._lastModified || 
                         (gameState._lastSaved ? new Date(gameState._lastSaved).getTime() : 0);
    
    const emergencyTime = emergencyData.timestamp || 0;
    
    // Если экстренное сохранение старше обычного, игнорируем его
    if (emergencyTime < gameStateTime) {
      console.log('[GameProvider] Экстренное сохранение старше загруженного состояния, игнорируем');
      return gameState;
    }
    
    console.log('[GameProvider] Экстренное сохранение новее загруженного состояния, объединяем данные');
    
    // Создаем копию состояния
    const mergedState = { ...gameState };
    
    // Переносим ключевые данные из экстренного сохранения
    if (emergencyData.inventory) {
      mergedState.inventory = {
        ...mergedState.inventory,
        snot: emergencyData.inventory.snot,
        snotCoins: emergencyData.inventory.snotCoins,
        containerSnot: emergencyData.inventory.containerSnot
      };
    }
    
    // Обновляем метаданные
    mergedState._emergencyRestored = true;
    mergedState._emergencyTimestamp = emergencyTime;
    
    console.log('[GameProvider] Обновлены данные из экстренного сохранения:', {
      snot: mergedState.inventory.snot,
      timestamp: new Date(emergencyTime).toISOString()
    });
    
    return mergedState;
  } catch (error) {
    console.error('[GameProvider] Ошибка при объединении с экстренным сохранением:', error);
    return gameState;
  }
};

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
      
      // Переменные для хранения данных из разных источников
      let localGameData = null;
      let serverGameData = null;
      let dataSource = 'default'; // Явно объявляем тип
      
      // 1. Загружаем данные из защищенного локального хранилища
      try {
        localGameData = secureLocalLoad(userId);
        if (localGameData) {
          console.log('[GameProvider] Loaded game state from secure localStorage');
        }
      } catch (localError) {
        console.warn('[GameProvider] Error loading from secure localStorage:', localError);
      }
      
      // 2. Загружаем данные с сервера через API
      try {
        const loadResult = await storageService.loadGameState(userId);
        serverGameData = loadResult?.data;
        
        if (serverGameData) {
          console.log('[GameProvider] Data loaded from server for', userId);
        } else {
          console.log('[GameProvider] No server data found for', userId);
        }
      } catch (serverError) {
        console.error('[GameProvider] Error loading from server:', serverError);
      }
      
      // 3. Проверяем наличие экстренных сохранений
      const emergencyData = loadEmergencySaves(userId);
      
      // 4. Сравниваем локальное и серверное сохранение
      const comparisonResult = compareSaves(localGameData, serverGameData, userId);
      
      // Выводим детальную информацию о сравнении
      console.log('[GameProvider] Save comparison result:', {
        localValid: comparisonResult.localValid,
        serverValid: comparisonResult.serverValid,
        useLocal: comparisonResult.useLocal,
        useServer: comparisonResult.useServer,
        localNewer: comparisonResult.localNewer,
        timeDifferenceMs: comparisonResult.timeDifference,
        timeDifferenceMin: Math.abs(comparisonResult.timeDifference) / (60 * 1000),
        errors: comparisonResult.integrityErrors,
        emergencySaveFound: Boolean(emergencyData)
      });
      
      // 5. Выбираем источник данных на основе результата сравнения
      let gameData = null;
      
      if (comparisonResult.useLocal && localGameData) {
        gameData = localGameData;
        dataSource = 'local';
        console.log('[GameProvider] Using local save (newer or server save invalid)');
        
        // Если локальное сохранение новее, сохраняем его на сервер
        if (comparisonResult.localNewer && serverGameData) {
          console.log('[GameProvider] Local save is newer, syncing to server');
          
          // Запускаем синхронизацию в фоне
          (async () => {
            try {
              const syncResult = await storageService.saveGameState(
                userId, 
                localGameData,
                localGameData._saveVersion || 1
              );
              
              if (syncResult.success) {
                console.log('[GameProvider] Successfully synced local save to server');
              } else {
                console.warn('[GameProvider] Failed to sync local save to server');
              }
            } catch (syncError) {
              console.error('[GameProvider] Error syncing local save to server:', syncError);
            }
          })();
        }
      } 
      else if (comparisonResult.useServer && serverGameData) {
        gameData = serverGameData;
        dataSource = 'server';
        console.log('[GameProvider] Using server save (newer or local save invalid)');
        
        // Сохраняем серверные данные в локальное хранилище
        try {
          secureLocalSave(userId, serverGameData);
          console.log('[GameProvider] Server data cached to local storage');
        } catch (cacheError) {
          console.warn('[GameProvider] Failed to cache server data locally:', cacheError);
        }
      }
      
      // 6. Если все валидные сохранения отсутствуют, создаем новое состояние
      if (!gameData) {
        console.log('[GameProvider] No valid saves found for', userId, ', initializing default state');
        gameData = createDefaultGameState(userId);
        dataSource = 'new';
      }
      
      // 7. Проверяем наличие экстренных сохранений и объединяем с выбранными данными
      if (emergencyData) {
        const originalSnot = gameData?.inventory?.snot;
        gameData = mergeWithEmergencySave(gameData, emergencyData);
        
        if (originalSnot !== gameData?.inventory?.snot) {
          console.log('[GameProvider] Данные обновлены из экстренного сохранения', {
            originalSnot,
            updatedSnot: gameData?.inventory?.snot
          });
          dataSource += '+emergency';
        }
      }
      
      // 8. Обновляем ресурсы на основе прошедшего времени
      try {
        // Импортируем функцию обновления ресурсов
        const { updateResourcesBasedOnTimePassed } = await import('../../../utils/resourceUtils');
        const { calculateRestoredEnergy } = await import('../../../hooks/useEnergyRestoration');
        
        // Получаем текущее время
        const now = Date.now();
        
        // Сохраняем исходные значения для сравнения
        const originalContainerSnot = gameData?.inventory?.containerSnot || 0;
        const originalEnergy = gameData?.inventory?.energy || 0;
        
        // Сначала проверяем и инициализируем энергию и время обновления энергии, если они не установлены
        if (gameData.inventory.energy === undefined || gameData.inventory.energy === null || isNaN(gameData.inventory.energy)) {
          console.log('[GameProvider] Инициализируем отсутствующую энергию:', {
            было: gameData.inventory.energy,
            стало: 500
          });
          gameData.inventory.energy = 500; // Максимальное значение только если энергия отсутствует или некорректна
        } else {
          console.log('[GameProvider] Используем существующее значение энергии:', gameData.inventory.energy);
        }
        
        // Инициализируем lastEnergyUpdateTime только если его нет или он некорректный
        if (!gameData.inventory.lastEnergyUpdateTime || isNaN(Number(gameData.inventory.lastEnergyUpdateTime))) {
          console.log('[GameProvider] Инициализируем отсутствующий lastEnergyUpdateTime:', {
            было: gameData.inventory.lastEnergyUpdateTime,
            стало: now
          });
          gameData.inventory.lastEnergyUpdateTime = now;
        } else {
          // Логируем существующее значение для отладки
          console.log('[GameProvider] Используем существующий lastEnergyUpdateTime:', {
            время: new Date(gameData.inventory.lastEnergyUpdateTime).toISOString(),
            прошлоВремени: `${((now - gameData.inventory.lastEnergyUpdateTime) / (1000 * 60)).toFixed(2)} минут`
          });
        }
        
        // Обновляем контейнер снота с учетом прошедшего времени
        gameData = updateResourcesBasedOnTimePassed(gameData, now);
        
        // Обновляем энергию с учетом прошедшего времени
        const maxEnergy = 500; // Максимальная энергия
        const hoursToFullRestore = 8; // Часов для полного восстановления
        const lastEnergyUpdateTime = gameData.inventory.lastEnergyUpdateTime;
        
        // Запоминаем исходное время обновления для сохранения в состоянии
        const originalLastEnergyUpdateTime = lastEnergyUpdateTime;
        
        // Рассчитываем восстановленную энергию
        const newEnergy = calculateRestoredEnergy(
          gameData.inventory.energy,
          maxEnergy,
          lastEnergyUpdateTime,
          hoursToFullRestore,
          now
        );
        
        // Обновляем энергию в состоянии, но НЕ обновляем lastEnergyUpdateTime
        // если энергия еще не полностью восстановлена - сохраняем старое значение для
        // корректного расчета восстановления в будущем
        const shouldUpdateTimestamp = newEnergy >= maxEnergy;
        gameData = {
          ...gameData,
          inventory: {
            ...gameData.inventory,
            energy: newEnergy,
            // Обновляем timestamp только если энергия полностью восстановлена
            lastEnergyUpdateTime: shouldUpdateTimestamp ? now : originalLastEnergyUpdateTime
          }
        };
        
        // Логируем изменения энергии
        if (Math.abs(newEnergy - originalEnergy) > 0.5) {
          console.log('[GameProvider] Обновлена энергия на основе прошедшего времени:', {
            было: originalEnergy,
            стало: newEnergy,
            разница: newEnergy - originalEnergy,
            прошлоВремени: `${((now - lastEnergyUpdateTime) / (1000 * 60)).toFixed(2)} минут`,
            lastEnergyUpdateTime: shouldUpdateTimestamp ? 
              new Date(now).toISOString() : 
              new Date(originalLastEnergyUpdateTime).toISOString(),
            обновленTimestamp: shouldUpdateTimestamp
          });
          
          // После обновления энергии сохраняем состояние локально,
          // чтобы гарантировать сохранение между сессиями
          try {
            const { secureLocalSave } = await import('../../../utils/localSaveProtection');
            if (userId) {
              secureLocalSave(userId, gameData);
              console.log('[GameProvider] Сохранено обновленное состояние энергии:', {
                userId,
                энергия: newEnergy,
                timestamp: shouldUpdateTimestamp ? now : originalLastEnergyUpdateTime
              });
            }
          } catch (savingError) {
            console.error('[GameProvider] Ошибка при сохранении обновленного состояния энергии:', savingError);
          }
        }
        
        // Логируем изменения контейнера
        if (Math.abs(gameData?.inventory?.containerSnot - originalContainerSnot) > 0.001) {
          console.log('[GameProvider] Обновлен containerSnot на основе прошедшего времени:', {
            было: originalContainerSnot,
            стало: gameData.inventory.containerSnot,
            разница: gameData.inventory.containerSnot - originalContainerSnot
          });
          
          // Добавляем информацию в dataSource, только если строка
          if (typeof dataSource === 'string') {
            dataSource += '+timeCalculated';
          }
        }
      } catch (timeUpdateError) {
        console.error('[GameProvider] Ошибка при обновлении ресурсов на основе времени:', timeUpdateError);
      }
      
      // 9. Добавляем метаданные о загрузке
      gameData._dataSource = dataSource;
      gameData._loadedAt = new Date().toISOString();
      
      // 10. Загружаем данные в состояние
      dispatch({ type: 'LOAD_GAME_STATE', payload: gameData });
      
      // 11. Логируем успешную загрузку
      console.log(`[GameProvider] Game state loaded from ${dataSource} source for ${userId}`);
      
      return true;
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

      // Сначала сохраняем в защищенное локальное хранилище
      try {
        const localSaveSuccess = secureLocalSave(normalizedId, stateToActuallySave as unknown as GameState);
        if (!localSaveSuccess) {
          console.warn(`[GameProvider] Failed to save to secure localStorage, proceeding to server save`);
        }
      } catch (localSaveError) {
        console.error(`[GameProvider] Error saving to secure localStorage:`, localSaveError);
        // Продолжаем сохранение на сервер даже при ошибке локального сохранения
      }
      
      // Проверяем, нужно ли сохранять на сервер
      // Получаем метаданные о последнем сохранении
      const { needsServerSync } = await import('../../../utils/localSaveProtection');
      const shouldSaveToServer = needsServerSync(normalizedId);
      
      if (shouldSaveToServer) {
        // Сохраняем на сервер
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
            
            // Обновляем метаданные о последней синхронизации с сервером
            const { updateSyncMetadata } = await import('../../../utils/localSaveProtection');
            updateSyncMetadata(normalizedId, preparedState._lastSaved, preparedState._saveVersion);
          } else {
            console.warn(`[GameProvider] Server save failed, creating backup...`);
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
      } else {
        console.log(`[GameProvider] Skipping server save, using local storage only`);
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
      console.log(`[GameProvider] Changed userId: ${lastUserIdRef.current || 'undefined'} -> ${userId || 'undefined'}`);
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
  
  // Добавляем эффект для сохранения состояния перед закрытием окна
  useEffect(() => {
    if (!userId) return;
    
    // Функция, которая будет вызвана перед выходом
    const handleBeforeUnload = () => {
      // Отмечаем, что это сохранение перед выходом
      const saveData = {
        ...state,
        _isBeforeUnloadSave: true
      };
      
      try {
        // Используем синхронное локальное сохранение
        const normalizedId = typeof userId === 'string' ? userId : '';
        const saved = secureLocalSave(normalizedId, saveData);
        console.log(`[GameProvider] Состояние ${saved ? 'успешно' : 'не'} сохранено перед выходом`);
      } catch (error) {
        console.error('[GameProvider] Ошибка при сохранении состояния перед выходом:', error);
      }
    };
    
    // Регистрируем обработчик события
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Очищаем обработчик при размонтировании компонента
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userId, state]);
  
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