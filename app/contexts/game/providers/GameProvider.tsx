'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { GameStateContext, SetGameStateContext, IsSavingContext } from '../contexts'
import { GameState, ExtendedGameState, createInitialGameState } from '../../../types/gameTypes'
import { updateResourcesBasedOnTimePassed } from '../../../utils/resourceUtils'
import { getFillingSpeedByLevel } from '../../../utils/gameUtils'
import { useSaveManager, SavePriority } from '@/app/contexts/SaveManagerProvider'

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

/**
 * Создает дефолтное состояние игры для случаев, когда валидация не удалась
 */
function createDefaultGameState(userId: string): GameState {
  return {
    _userId: userId, // Добавляем userId
    inventory: {
      snot: 0.1, // Добавляем начальное значение snot
      snotCoins: 0,
      containerCapacity: 1, // Начальная вместимость контейнера - изменено с 5 на 1
      containerSnot: 0.05, // Добавляем начальное значение containerSnot
      fillingSpeed: 0.01, // Начальная скорость наполнения
      containerCapacityLevel: 1, // Начальный уровень вместимости
      fillingSpeedLevel: 1, // Начальный уровень скорости наполнения
      collectionEfficiency: 1, // Начальная эффективность сбора
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
      lastUpdateTimestamp: validatedState.inventory.lastUpdateTimestamp || Date.now()
    };
  }

  return validatedState;
}

// Функция для сравнения данных с экстренным сохранением  
const mergeWithEmergencySave = (gameState: GameState, emergencyData: any): GameState => {
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
    
    // Убедимся, что inventory существует
    if (!gameState.inventory) {
      gameState.inventory = {
        snot: 0,
        snotCoins: 0,
        containerSnot: 0,
        containerCapacity: 1,
        containerCapacityLevel: 1,
        fillingSpeed: 0.01,
        fillingSpeedLevel: 1,
        collectionEfficiency: 1,
        lastUpdateTimestamp: Date.now()
      };
    }
    
    // Объединяем данные - используем данные из экстренного сохранения для критически важных полей
    return {
      ...gameState,
      inventory: {
        ...gameState.inventory,
        snot: emergencyData.snot !== undefined ? emergencyData.snot : gameState.inventory.snot,
        snotCoins: emergencyData.snotCoins !== undefined ? emergencyData.snotCoins : gameState.inventory.snotCoins,
        containerSnot: emergencyData.containerSnot !== undefined ? emergencyData.containerSnot : gameState.inventory.containerSnot
      },
      _emergencyRecovered: true,
      _emergencyRecoveryTime: Date.now()
    } as GameState;
  } catch (error) {
    console.error('[GameProvider] Ошибка при объединении данных с экстренным сохранением:', error);
    return gameState;
  }
};

export function GameProvider({
  children,
  userId,
  enableAutoSave = true,
  autoSaveInterval = 5000
}: GameProviderProps) {
  // Используем SaveManager из контекста вместо создания нового экземпляра
  const { save, load, createEmergencyBackup } = useSaveManager();
  
  // Инициализируем состояние игры с использованием useState вместо useReducer
  const [state, setState] = useState<GameState>(createInitialGameState(userId || ''));

  // Состояние для отслеживания процесса сохранения
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // Состояние для отслеживания загрузки данных
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Отслеживаем, было ли выполнено начальное сохранение
  const initialLoadDoneRef = useRef<boolean>(false);

  // Ref для отслеживания активного таймера автосохранения
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref для хранения последнего сохраненного userId
  const lastUserIdRef = useRef<string | undefined>(userId);
  
  // Ref для отслеживания, идет ли уже запрос на загрузку
  const loadRequestInProgressRef = useRef<boolean>(false);
  
  // Создаем ref для хранения предыдущего значения containerSnot
  const prevContainerSnotRef = useRef(state?.inventory?.containerSnot ?? 0);

  // Загрузка данных пользователя
  const loadUserData = useCallback(async (userId: string) => {
      if (!userId) {
        console.error('[GameProvider] Отсутствует ID пользователя для загрузки данных');
        return false;
      }
      
      console.log('[GameProvider] Starting state load for userId:', userId);
      
    try {
      // Используем SaveManager из контекста для загрузки данных
      const loadResult = await load(userId);
      
      console.log('[GameProvider] Результат загрузки:', {
        success: loadResult.success,
        source: loadResult.source,
        isNewUser: loadResult.isNewUser,
        wasRepaired: loadResult.wasRepaired
      });
      
      let gameData: GameState;
      
      if (loadResult.isNewUser || !loadResult.data) {
        console.log('[GameProvider] Создание нового состояния для пользователя');
        gameData = createDefaultGameState(userId);
      } else {
        gameData = loadResult.data as unknown as GameState;
        
        if (loadResult.wasRepaired) {
          console.log('[GameProvider] Данные были восстановлены после повреждения');
        }
      }
      
      // Проверяем, есть ли временное резервное значение snot в sessionStorage
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const backupKey = `snot_backup_${userId}`;
          const backupData = sessionStorage.getItem(backupKey);
          
          if (backupData) {
            const backup = JSON.parse(backupData);
            
            // Проверяем, что значение snot в backup - число
            if (backup && typeof backup.snot === 'number' && !isNaN(backup.snot)) {
              const backupTime = backup.timestamp || 0;
              const stateTime = gameData?._lastModified || 0;
              
              // Используем значение из backup только если оно новее
              if (backupTime > stateTime) {
                console.log('[GameProvider] Найдена более новая резервная копия snot:', {
                  backup: backup.snot,
                  state: gameData?.inventory?.snot,
                  backupTime: new Date(backupTime).toISOString(),
                  stateTime: new Date(stateTime).toISOString()
                });
                
                // Обновляем значение в загруженных данных
                if (gameData && gameData.inventory) {
                  gameData.inventory.snot = backup.snot;
                }
              }
            }
            
            // Очищаем временное резервное значение
            sessionStorage.removeItem(backupKey);
          }
        }
      } catch (error) {
        // Игнорируем ошибки при работе с sessionStorage
        console.error('[GameProvider] Ошибка при проверке резервной копии snot:', error);
      }
      
      // Обновляем ресурсы на основе прошедшего времени
      try {
        // Сохраняем предыдущее значение containerSnot для логирования
        const prevContainerSnot = gameData?.inventory?.containerSnot || 0;
        
        console.log('[GameProvider] Состояние перед обновлением на основе времени:', {
          containerSnot: prevContainerSnot,
          fillingSpeed: gameData?.inventory?.fillingSpeed,
          fillingSpeedLevel: gameData?.inventory?.fillingSpeedLevel,
          lastUpdateTimestamp: gameData?.inventory?.lastUpdateTimestamp ? 
            new Date(gameData.inventory.lastUpdateTimestamp).toISOString() : 'отсутствует'
        });
        
        // Проверка и восстановление fillingSpeed на основе уровня
        if (gameData?.inventory?.fillingSpeedLevel) {
          const correctFillingSpeed = getFillingSpeedByLevel(gameData.inventory.fillingSpeedLevel);
          
          if (Math.abs(gameData.inventory.fillingSpeed - correctFillingSpeed) > 0.001) {
            console.log('[GameProvider] Корректировка fillingSpeed:', {
              было: gameData.inventory.fillingSpeed,
              стало: correctFillingSpeed,
              уровень: gameData.inventory.fillingSpeedLevel
            });
            
            gameData.inventory.fillingSpeed = correctFillingSpeed;
          }
        }
        
        // Обновляем ресурсы на основе прошедшего времени
        if (gameData?.inventory?.lastUpdateTimestamp) {
          gameData = updateResourcesBasedOnTimePassed(gameData);
          
          console.log('[GameProvider] Состояние после обновления на основе времени:', {
            было: prevContainerSnot,
            стало: gameData.inventory.containerSnot,
            разница: gameData.inventory.containerSnot - prevContainerSnot
          });
        }
      } catch (updateError) {
        console.error('[GameProvider] Ошибка при обновлении ресурсов:', updateError);
      }
      
      // Обновляем состояние игры напрямую через setState вместо dispatch
      setState(gameData);
      
      // Сохраняем обновленное состояние
      if (!loadResult.isNewUser) {
        await saveGameState(gameData);
      }
      
      // Отмечаем, что начальная загрузка выполнена
      initialLoadDoneRef.current = true;
      
      return true;
    } catch (error) {
      console.error('[GameProvider] Ошибка при загрузке данных:', error);
      return false;
    }
  }, [load]);

  // Сохранение состояния игры
  const saveGameState = useCallback(async (currentState: GameState = state, priority = SavePriority.MEDIUM) => {
    if (!userId) {
      console.warn('[GameProvider] Отсутствует userId, сохранение не выполнено');
      return { success: false };
    }
    
    // Немедленно сохраняем значение snot в sessionStorage для максимальной надежности
    try {
      if (typeof window !== 'undefined' && window.sessionStorage && currentState.inventory) {
        const snot = currentState.inventory.snot;
        if (snot !== undefined && snot !== null) {
    const normalizedId = normalizeUserId(userId);
          const backupKey = `snot_backup_${normalizedId}`;
          const backup = {
            snot: typeof snot === 'number' ? snot : Number(snot) || 0,
            snotCoins: typeof currentState.inventory.snotCoins === 'number' ? 
                      currentState.inventory.snotCoins : 
                      Number(currentState.inventory.snotCoins) || 0,
            timestamp: Date.now()
          };
          const backupJson = JSON.stringify(backup);
          sessionStorage.setItem(backupKey, backupJson);
          
          console.log('[GameProvider] Сохранено значение snot в sessionStorage:', {
            snot: backup.snot,
            snotCoins: backup.snotCoins,
            backupKey
          });
        }
      }
    } catch (error) {
      // Игнорируем ошибки сессионного хранилища, но логируем для отладки
      console.warn('[GameProvider] Ошибка при сохранении в sessionStorage:', error);
    }
    
    try {
      setIsSaving(true);
      
      // Проверка и корректировка значений перед сохранением
      let preparedState = { ...currentState };
      
      // Убедимся, что все критические данные инвентаря корректны
      if (preparedState.inventory) {
        // Убедимся, что snot существует и является числом
        if (preparedState.inventory.snot === undefined || 
            preparedState.inventory.snot === null || 
            typeof preparedState.inventory.snot !== 'number' ||
            isNaN(preparedState.inventory.snot)) {
          
          console.warn('[GameProvider] Исправление некорректного значения snot перед сохранением:', {
            original: preparedState.inventory.snot,
            fixed: typeof preparedState.inventory.snot === 'number' ? 
                   preparedState.inventory.snot : 
                   parseFloat(preparedState.inventory.snot) || 0
          });
          
          // Исправляем значение
          preparedState.inventory.snot = typeof preparedState.inventory.snot === 'number' ? 
                                         preparedState.inventory.snot : 
                                         parseFloat(preparedState.inventory.snot) || 0;
        }
        
        // Также проверяем другие значения инвентаря
        preparedState.inventory.snotCoins = typeof preparedState.inventory.snotCoins === 'number' ? 
                                           preparedState.inventory.snotCoins : 
                                           parseFloat(preparedState.inventory.snotCoins) || 0;
        
        preparedState.inventory.containerSnot = typeof preparedState.inventory.containerSnot === 'number' ? 
                                               preparedState.inventory.containerSnot : 
                                               parseFloat(preparedState.inventory.containerSnot) || 0;
      }
      
      // Добавляем метаданные для сохранения
      const normalizedId = normalizeUserId(userId);
      preparedState = {
        ...preparedState,
        _lastSaved: new Date().toISOString(),
        _userId: normalizedId,
        _lastModified: Date.now()
      };
      
      // Используем SaveManager из контекста для сохранения
      const saveResult = await save(normalizedId, preparedState as unknown as ExtendedGameState);
      
      if (saveResult.success) {
        console.log('[GameProvider] Состояние успешно сохранено:', {
          source: saveResult.source,
          dataSize: saveResult.dataSize,
          duration: saveResult.duration,
          snotValue: preparedState.inventory?.snot // Логируем сохраненное значение snot
        });
      } else {
        console.warn('[GameProvider] Ошибка при сохранении состояния:', saveResult.error);
      }
      
      return saveResult;
    } catch (error) {
      console.error('[GameProvider] Ошибка при сохранении игры:', error);
      return { success: false, error: String(error) };
    } finally {
      setIsSaving(false);
    }
  }, [state, userId, save]);

  // Функция для обновления состояния
  const updateGameState = useCallback((newStateOrFunction: GameState | ((prevState: GameState) => GameState)) => {
    // Обновляем состояние
    setState(prevState => {
      // Получаем новое состояние
      const newState = typeof newStateOrFunction === 'function' 
        ? newStateOrFunction(prevState) 
        : newStateOrFunction;
        
      // Обновляем метаданные
      const updatedState = {
        ...newState,
        _lastActionTime: new Date().toISOString(),
        _lastModified: Date.now()
      };
        
      // Планируем автосохранение если оно включено
      if (enableAutoSave && userId && initialLoadDoneRef.current) {
        // Очищаем предыдущий таймер автосохранения, если он был
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
        }
        
        // Устанавливаем новый таймер
        autoSaveTimerRef.current = setTimeout(() => {
          saveGameState(updatedState, SavePriority.LOW);
        }, autoSaveInterval);
      }
      
      return updatedState;
    });
  }, [enableAutoSave, userId, autoSaveInterval, saveGameState]);

  // Реализация функции collectContainerSnot (ранее была в reducer)
  const collectContainerSnot = useCallback((containerSnot: number, expectedSnot?: number) => {
    updateGameState(prevState => {
      // Убедимся, что inventory существует
      if (!prevState.inventory) {
        prevState.inventory = {
          snot: 0,
          snotCoins: 0,
          containerSnot: 0,
          containerCapacity: 1,
          containerCapacityLevel: 1,
          fillingSpeed: 0.01,
          fillingSpeedLevel: 1,
          collectionEfficiency: 1,
          lastUpdateTimestamp: Date.now()
        };
      }
      
      // Текущее значение snot - гарантируем число
      const currentSnot = typeof prevState.inventory.snot === 'number' ? prevState.inventory.snot : 0;
      
      // Валидируем значение
      const validAmount = Math.max(0, containerSnot);
      
      // Вычисляем новое значение снота
      const newSnot = currentSnot + validAmount;
      
      // Выбираем окончательное значение, гарантируя, что оно число
      let finalSnot = expectedSnot !== undefined ? Number(expectedSnot) : Number(newSnot);
      
      if (isNaN(finalSnot)) {
        finalSnot = currentSnot + validAmount; // Fallback если новое значение NaN
        console.warn('[collectContainerSnot] Обнаружено недопустимое значение snot, исправлено:', {
          currentSnot,
          containerSnot,
          expectedSnot,
          finalSnot
        });
      }
      
      // Немедленно сохраняем значение в сессионное хранилище для максимальной защиты
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const userId = prevState._userId || 'unknown';
          const backupKey = `snot_backup_${userId}`;
          const backup = {
            snot: finalSnot,
            snotCoins: prevState.inventory.snotCoins || 0,
            timestamp: Date.now(),
            action: 'COLLECT_CONTAINER_SNOT'
          };
          sessionStorage.setItem(backupKey, JSON.stringify(backup));
          
          // Создаем дополнительную копию с уникальным ключом для максимальной надежности
          const uniqueBackupKey = `snot_backup_${userId}_${Date.now()}`;
          sessionStorage.setItem(uniqueBackupKey, JSON.stringify(backup));
          
          console.log('[collectContainerSnot] Сохранены резервные копии snot:', {
            snot: finalSnot,
            standardKey: backupKey,
            uniqueKey: uniqueBackupKey
          });
          
          // Также сохраняем в localStorage для дополнительной защиты
          try {
            const localBackupKey = `snotcoin_snot_backup_${userId}`;
            localStorage.setItem(localBackupKey, JSON.stringify(backup));
          } catch (localError) {
            // Игнорируем ошибки localStorage, основной приоритет у sessionStorage
          }
        }
      } catch (error) {
        // Игнорируем ошибки сессионного хранилища, но логируем для отладки
        console.warn('[collectContainerSnot] Ошибка при создании резервной копии:', error);
      }
      
      // Возвращаем обновленное состояние
      return {
        ...prevState,
        inventory: {
          ...prevState.inventory,
          snot: finalSnot,
          containerSnot: 0 // Обнуляем контейнер при сборе
        },
        _lastAction: 'COLLECT_CONTAINER_SNOT'
      };
    });
  }, [updateGameState]);

  // Загружаем данные при монтировании или изменении userId
  useEffect(() => {
    if (!userId || loadRequestInProgressRef.current) return;
    
    const normalized = normalizeUserId(userId);
    
    // Если userId изменился, загружаем новые данные
    if (normalized !== lastUserIdRef.current) {
      console.log('[GameProvider] UserId изменился, загружаем новые данные');
      
      loadRequestInProgressRef.current = true;
      setIsLoading(true);
      
      loadUserData(normalized)
        .finally(() => {
          loadRequestInProgressRef.current = false;
          setIsLoading(false);
          lastUserIdRef.current = normalized;
        });
    }
  }, [userId, loadUserData]);
  
  // Устанавливаем обработчик beforeunload для сохранения перед выходом
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Флаг для отслеживания, была ли уже создана экстренная копия
    let backupCreated = false;
    
    // Функция, которая будет вызвана перед выходом
    const handleBeforeUnload = () => {
      if (!userId || backupCreated) return;
      
      // Устанавливаем флаг, чтобы избежать повторного создания при нескольких вызовах обработчика
      backupCreated = true;
      
      // Создаем экстренную резервную копию
      const normalizedId = normalizeUserId(userId);
      createEmergencyBackup(normalizedId, state as unknown as ExtendedGameState);
      
      console.log('[GameProvider] Создана экстренная копия перед закрытием страницы');
    };
    
    // Регистрируем обработчик события
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Очищаем обработчик при размонтировании компонента
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userId, state, createEmergencyBackup]);
  
  // Предоставляем состояние и функцию обновления через контексты
  return (
    <GameStateContext.Provider value={state}>
      <SetGameStateContext.Provider value={updateGameState}>
        <IsSavingContext.Provider value={isSaving}>
          {children}
        </IsSavingContext.Provider>
      </SetGameStateContext.Provider>
    </GameStateContext.Provider>
  );
}

export default GameProvider 