'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { GameStateContext, GameDispatchContext, IsSavingContext } from '../contexts'
import { gameReducer } from '../../../reducers/gameReducer'
import { createInitialGameState, Action, GameState, ExtendedGameState } from '../../../types/gameTypes'
import { 
  saveGameStateWithIntegrity as saveGame, 
  loadGameStateWithIntegrity as loadGame,
  createBackup,
  API_ROUTES,
  SaveResponse
} from '../../../services/gameDataService'
import * as dataService from '../../../services/dataServiceModular'
import { updateResources } from '../../../actions/gameActions'
import { signGameState, verifyDataSignature } from '../../../utils/dataIntegrity'
import { localStorageService } from '../../../services/storage/localStorageService'
// import { gameDataService } from '../../../services/gameDataService'
// import { GameContext } from '../gameContext'

interface GameProviderProps {
  children: React.ReactNode
  initialState?: GameState
  userId?: string
  enableAutoSave?: boolean
  autoSaveInterval?: number
}

// Максимальное количество записей об размонтировании для предотвращения утечки памяти
const MAX_UNMOUNT_RECORDS = 100;
// Объект для отслеживания компонентов в процессе размонтирования
const unmountInProgress: Record<string, boolean> = {};
// Для отслеживания времени размонтирования компонентов
const unmountTimestamps: Record<string, number> = {};
// Счетчик для отслеживания общего количества записей
let unmountRecordsCount = 0;

// Для отслеживания последних инициализаций компонента
const lastInitializationMap = new Map<string, number>();
// Минимальный интервал между повторными инициализациями (3 секунды)
const MIN_INITIALIZATION_INTERVAL = 3000;

/**
 * Очищает старые записи о размонтировании, если их количество превышает лимит
 */
const cleanupUnmountRecords = () => {
  if (unmountRecordsCount <= MAX_UNMOUNT_RECORDS) return;
  
  // Удаляем только записи старше определенного времени (5 минут)
  const now = Date.now();
  const timeLimit = 5 * 60 * 1000; // 5 минут
  let cleanedCount = 0;
  
  for (const key in unmountInProgress) {
    if (unmountTimestamps[key] && now - unmountTimestamps[key] > timeLimit) {
      delete unmountInProgress[key];
      delete unmountTimestamps[key];
      unmountRecordsCount--;
      cleanedCount++;
    }
  }
  
  // Если по времени ничего не удалилось, а счетчик всё еще высокий,
  // удаляем 30% самых старых записей для предотвращения переполнения
  if (cleanedCount === 0 && unmountRecordsCount > MAX_UNMOUNT_RECORDS) {
    const entries = Object.entries(unmountTimestamps);
    entries.sort(([, a], [, b]) => a - b);
    
    // Увеличен процент очистки с 20% до 30%
    const keysToRemove = entries.slice(0, Math.ceil(entries.length * 0.3)).map(([key]) => key);
    
    keysToRemove.forEach(key => {
      delete unmountInProgress[key];
      delete unmountTimestamps[key];
      unmountRecordsCount--;
      cleanedCount++;
    });
    
    // Проверяем счетчик, если он не соответствует реальному количеству
    const actualCount = Object.keys(unmountInProgress).length;
    if (unmountRecordsCount !== actualCount) {
      console.log(`[GameProvider] Исправление счетчика записей: ${unmountRecordsCount} -> ${actualCount}`);
      unmountRecordsCount = actualCount;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`[GameProvider] Очищено ${cleanedCount} устаревших записей о размонтировании`);
  }
};

/**
 * Функция для получения userId из localStorage
 * @returns {string | null} userId из localStorage или null
 */
const getUserIdFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    // Проверяем оба возможных ключа для userId
    const userId = localStorage.getItem('user_id') || localStorage.getItem('userId') || localStorage.getItem('game_id');
    if (userId) {
      console.log(`[GameProvider] Найден userId в localStorage: ${userId}`);
      return userId;
    }
    return null;
  } catch (error) {
    console.error('[GameProvider] Ошибка при получении userId из localStorage:', error);
    return null;
  }
};

/**
 * Проверяет и обновляет при необходимости структуру состояния
 */
const migrateStateIfNeeded = (state: ExtendedGameState): ExtendedGameState => {
  // Если состояние уже верной версии, проверим только критические поля
  if (state._saveVersion && state._saveVersion >= 2) {
    // Дополнительно проверяем критические поля даже для новых версий
    const migratedState = { ...state };
    let needsRepair = false;

    // Проверяем поле Cap в инвентаре
    if (migratedState.inventory && migratedState.inventory.Cap === undefined) {
      console.log("[GameProvider] Отсутствует поле Cap в инвентаре, исправляем");
      migratedState.inventory.Cap = migratedState.inventory.containerCapacity || 100;
      needsRepair = true;
    }

    // Если обновления не требуются, возвращаем исходное состояние
    if (!needsRepair) {
      return state;
    }

    // Обновляем метаданные о ремонте, но не меняем версию
    if (!migratedState._repairedFields) migratedState._repairedFields = [];
    migratedState._repairedFields.push('critical_fields_repair');
    migratedState._wasRepaired = true;
    migratedState._repairedAt = Date.now();

    return migratedState;
  }

  console.log("[GameProvider] Миграция устаревшей структуры данных");
  
  // Создаем копию состояния для безопасного обновления
  const migratedState = { ...state };
  
  // Устанавливаем версию
  migratedState._saveVersion = 2;
  migratedState._lastModified = Date.now();
  
  // Проверка наличия базовых структур
  if (!migratedState.inventory) {
    console.log("[GameProvider] Отсутствует инвентарь, создаем базовую структуру");
    migratedState.inventory = {
      snot: 0,
      snotCoins: 0,
      containerCapacity: 100,
      containerSnot: 0,
      fillingSpeed: 1,
      collectionEfficiency: 1,
      Cap: 100,
      containerCapacityLevel: 1,
      fillingSpeedLevel: 1,
      lastUpdateTimestamp: Date.now()
    };
  } else {
    // Проверяем наличие поля Cap в инвентаре
    if (migratedState.inventory.Cap === undefined) {
      console.log("[GameProvider] Отсутствует поле Cap в инвентаре, создаем на основе containerCapacity");
      migratedState.inventory.Cap = migratedState.inventory.containerCapacity || 100;
    }
  }
  
  if (!migratedState.container) {
    console.log("[GameProvider] Отсутствует контейнер, создаем базовую структуру");
    migratedState.container = {
      level: 1,
      capacity: 100,
      currentAmount: 0,
      fillRate: 1
    };
  }
  
  if (!migratedState.upgrades) {
    console.log("[GameProvider] Отсутствуют улучшения, создаем базовую структуру");
    migratedState.upgrades = {
      clickPower: { level: 1, value: 1 },
      passiveIncome: { level: 1, value: 0.1 },
      collectionEfficiencyLevel: 1,
      containerLevel: 1,
      fillingSpeedLevel: 1
    };
  }
  
  // Проверка на наличие stats
  if (!migratedState.stats) {
    console.log("[GameProvider] Отсутствуют статистики, создаем базовую структуру");
    migratedState.stats = {
      clickCount: 0,
      playTime: 0,
      startDate: new Date().toISOString(),
      totalSnot: 0,
      totalSnotCoins: 0,
      highestLevel: 1,
      consecutiveLoginDays: 0
    };
  }
  
  // Отметка о миграции
  migratedState._wasRepaired = true;
  migratedState._repairedAt = Date.now();
  migratedState._repairedFields = migratedState._repairedFields || [];
  migratedState._repairedFields.push('structure_migration_v2');
  
  console.log("[GameProvider] Миграция данных успешно выполнена");
  
  return migratedState;
};

export function GameProvider({
  children,
  initialState,
  userId: propUserId,
  enableAutoSave = true,
  // Увеличенный интервал автосохранения до 30 секунд для снижения нагрузки
  autoSaveInterval = 30000
}: GameProviderProps) {
  // Используем userId из props или из localStorage
  const [userId, setUserId] = useState<string | undefined>(propUserId);
  
  // Инициализируем состояние игры из initialState или дефолтного стейта
  const [state, dispatch] = React.useReducer(
    gameReducer,
    initialState || createInitialGameState(userId)
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
  
  // Ref для отслеживания, отправлено ли сохранение перед размонтированием
  const finalSaveSentRef = useRef<boolean>(false)
  
  // Ref для отслеживания, было ли сохранение при закрытии страницы
  const beforeUnloadSaveSentRef = useRef<boolean>(false)

  // Эффект для получения userId из localStorage при монтировании
  useEffect(() => {
    // Если userId не передан через props, пытаемся получить его из localStorage
    if (!propUserId) {
      const storedUserId = getUserIdFromStorage();
      if (storedUserId) {
        console.log(`[GameProvider] Получен userId из localStorage: ${storedUserId}`);
        setUserId(storedUserId);
      }
    }
    
    // При монтировании, очищаем флаг отправки финального сохранения
    finalSaveSentRef.current = false;
    beforeUnloadSaveSentRef.current = false;
    
    // Очистка старых записей при монтировании
    cleanupUnmountRecords();
  }, [propUserId]);

  // Загружаем сохраненные данные
  useEffect(() => {
    // Если данные уже загружены, не выполняем повторную загрузку
    if (initialLoadDoneRef.current) {
      console.log("[GameProvider] Начальная загрузка данных уже выполнена, пропускаем");
      return;
    }
    
    const loadSavedData = async () => {
      try {
        const storedUserId = getUserIdFromStorage()
        if (!storedUserId) {
          console.log("Пользователь не найден в хранилище");
          // Устанавливаем флаг, что загрузка завершена даже если не нашли userId
          initialLoadDoneRef.current = true;
          return;
        }
        
        // Проверяем, не слишком ли рано для повторной инициализации
        // чтобы избежать частых запросов
        const now = Date.now();
        const lastInitTime = lastInitializationMap.get(storedUserId) || 0;
        const timeSinceLast = now - lastInitTime;
        
        if (timeSinceLast < 3000) { // 3 секунды
          console.log(`[GameProvider] Слишком частая инициализация для ${storedUserId}, последняя была ${timeSinceLast}мс назад`);
          return;
        }
        
        lastInitializationMap.set(storedUserId, now);
        
        dispatch({
          type: 'SET_LOADING',
          payload: true
        });
        
        try {
          const localSavedGame = localStorageService.getItem(`gameState_${storedUserId}`) as string;
          
          if (localSavedGame) {
            try {
              // Пытаемся загрузить из локального хранилища
              const parsedState = JSON.parse(localSavedGame) as ExtendedGameState;
              
              // Проверяем и мигрируем структуру если нужно
              const validatedState = migrateStateIfNeeded(parsedState);
              
              // Обновляем состояние
              console.log("[GameProvider] Загрузка из локального хранилища", validatedState);
              dispatch({
                type: 'SET_GAME_STATE',
                payload: validatedState
              });
              
              // Обновляем userId
              dispatch({
                type: 'SET_USER_ID',
                payload: storedUserId
              });
            } catch (parseError) {
              console.error("Ошибка при парсинге локального состояния:", parseError);
            }
          } else {
            console.log("[GameProvider] Локальное сохранение не найдено, инициализируем");
            
            // Пытаемся загрузить с сервера
            try {
              // Инициализируем userId
              dispatch({
                type: 'SET_USER_ID',
                payload: storedUserId
              });
              
              const result = await dataService.initializeGameState(storedUserId);
              
              if (result.success && result.data) {
                // Проверяем и мигрируем структуру если нужно
                const validatedState = migrateStateIfNeeded(result.data);
                
                // Инициализируем состояние
                console.log("[GameProvider] Загрузка с сервера", validatedState);
                dispatch({
                  type: 'SET_GAME_STATE',
                  payload: validatedState
                });
              } else {
                console.error("[GameProvider] Ошибка инициализации состояния:", result.error);
                dispatch({
                  type: 'SET_ERROR',
                  payload: result.error || "Ошибка загрузки данных"
                });
              }
            } catch (serverError) {
              console.error("[GameProvider] Ошибка загрузки с сервера:", serverError);
            }
          }
          
          // Отмечаем, что начальная загрузка выполнена
          initialLoadDoneRef.current = true;
        } catch (error) {
          console.error("[GameProvider] Ошибка при загрузке данных:", error);
        } finally {
          dispatch({
            type: 'SET_LOADING',
            payload: false
          });
        }
      } catch (e) {
        console.error("Ошибка загрузки сохраненных данных:", e);
      }
    };
    
    loadSavedData();
  }, [dispatch]);

  // Функция для сохранения состояния игры с таймаутом
  const saveGameState = useCallback(
    async (isCritical = false): Promise<SaveResponse> => {
      try {
        // Проверяем наличие userId
        if (!state._userId) {
          console.error("ID пользователя отсутствует в состоянии");
          return { success: false, error: "ID пользователя отсутствует" };
        }
        
        // Подписываем данные перед сохранением
        const signedState = signGameState(state._userId, state);
        
        // Сохраняем в localStorage для резервного копирования
        localStorageService.saveGameState(state._userId, signedState);
        
        // Сохраняем на сервер с таймаутом
        console.log(`Сохраняем игровое состояние для пользователя ${state._userId}`);
        
        // Создаем промис с таймаутом
        const saveWithTimeout = async () => {
          const SAVE_TIMEOUT = 10000; // 10 секунд
          
          // Создаем промис, который завершается по таймауту
          const timeoutPromise = new Promise<SaveResponse>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Превышено время ожидания сохранения (${SAVE_TIMEOUT}ms)`));
            }, SAVE_TIMEOUT);
          });
          
          // Создаем промис для сохранения
          const savePromise = saveGame(state._userId!, signedState) as Promise<SaveResponse>;
          
          // Используем Promise.race для выбора первого завершенного промиса
          return Promise.race([savePromise, timeoutPromise]);
        };
        
        const result = await saveWithTimeout();
        
        if (!result.success) {
          console.error("Ошибка сохранения:", result.error);
        } else {
          console.log("Успешно сохранено, версия:", result.version);
        }
        
        return result;
      } catch (error) {
        console.error("Ошибка в процессе сохранения:", error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : "Неизвестная ошибка" 
        };
      }
    },
    [state]
  );

  // Автоматическое сохранение состояния игры
  const saveState = useCallback(async () => {
    const userId = state._userId;
    if (!userId || !enableAutoSave || state._skipSave) {
      if (!userId) {
        console.log('[GameProvider] saveState: userId отсутствует, сохранение отменено');
      } else if (!enableAutoSave) {
        console.log('[GameProvider] saveState: автосохранение отключено, сохранение отменено');
      } else if (state._skipSave) {
        console.log('[GameProvider] saveState: установлен флаг _skipSave, сохранение отменено');
      }
      return;
    }
    
    // Новая проверка: Если компонент размонтирован и saveState вызван не из финального сохранения
    if (userId && unmountInProgress[userId] && !finalSaveSentRef.current) {
      console.log('[GameProvider] saveState: компонент размонтирован, но это не финальное сохранение, продолжаем');
      // Здесь мы не прерываем выполнение функции, чтобы обеспечить сохранение даже при размонтировании
    }
    
    // Событие начала сохранения
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('game-save-start', { detail: { userId } }));
    }
    
    try {
      // Показываем индикатор сохранения
      setIsSaving(true);
      
      // Проверяем, что userId установлен в состоянии
      const stateToSave = {
        ...state,
        _lastSaved: new Date().toISOString(),
        _userId: userId
      };
      
      console.log(`[GameProvider] Сохранение состояния для пользователя: ${userId}`);
      
      // Сохраняем состояние игры
      const saveResult = await saveGameState(
        typeof (state as any)._isCriticalSave === 'boolean' ? (state as any)._isCriticalSave : false
      );
      
      // Проверяем, не был ли компонент размонтирован во время сохранения
      if (userId && unmountInProgress[userId] && !finalSaveSentRef.current) {
        console.log(`[GameProvider] Сохранение выполнено после размонтирования компонента`);
      }
      
      if (saveResult.success) {
        console.log(`[GameProvider] Состояние успешно сохранено для ${userId}`);
        
        // Событие успешного сохранения
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('game-save-success', { detail: { userId } }));
        }
      } else {
        const saveError = saveResult.error || 'Неизвестная ошибка';
        console.error(`[GameProvider] Ошибка при сохранении состояния для ${userId}:`, saveError);
        
        // Пытаемся сделать резервную копию, если основное сохранение не удалось
        if (typeof window !== 'undefined' && window.localStorage) {
          createBackup(userId, stateToSave, stateToSave._saveVersion || 1);
          console.log('[GameProvider] Создана резервная копия из-за ошибки API');
        }
        
        // Событие ошибки сохранения
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('game-save-error', { 
            detail: { 
              userId, 
              error: typeof saveError === 'string' ? saveError : 'Неизвестная ошибка'
            }
          }));
        }
      }
    } catch (error) {
      console.error('[GameProvider] Ошибка при сохранении состояния:', error);
      
      // Создаем резервную копию в случае ошибки с большим количеством попыток
      if (typeof window !== 'undefined' && window.localStorage && userId) {
        try {
          // Создаем основную резервную копию
          const backupCreated = createBackup(userId, state, state._saveVersion || 1);
          
          // Создаем дополнительную резервную копию с временной меткой для отличия
          const timestampedBackupKey = `backup_emergency_${userId}_${Date.now()}`;
          const backupData = {
            gameState: state,
            timestamp: Date.now(),
            version: (state._saveVersion || 1) + 1000, // Используем большую версию для отличия
            error: error instanceof Error ? error.message : String(error)
          };
          localStorage.setItem(timestampedBackupKey, JSON.stringify(backupData));
          
          console.log('[GameProvider] Созданы резервные копии (основная и экстренная) из-за ошибки при сохранении');
        } catch (backupError) {
          console.error('[GameProvider] Ошибка при создании резервных копий:', backupError);
          
          // Попытка создать самую минимальную резервную копию в критическом случае
          try {
            // Сохраняем только критические данные
            const criticalData = {
              _userId: userId,
              inventory: state.inventory,
              timestamp: Date.now()
            };
            localStorage.setItem(`emergency_${userId}_${Date.now()}`, JSON.stringify(criticalData));
            console.log('[GameProvider] Создана минимальная экстренная копия критических данных');
          } catch (emergencyError) {
            console.error('[GameProvider] Критическая ошибка сохранения, все попытки резервного копирования не удались');
          }
        }
      }
      
      // Событие ошибки сохранения
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('game-save-error', { 
          detail: { 
            userId, 
            error: error instanceof Error ? error.message : String(error) 
          }
        }));
      }
    } finally {
      // Скрываем индикатор сохранения, но только если компонент не размонтирован
      if (!userId || !unmountInProgress[userId]) {
        setIsSaving(false);
      }
    }
  }, [state, enableAutoSave]);

  // Оборачиваем dispatch для перезапуска таймера автосохранения
  const wrappedDispatch = useCallback(
    (action: Action) => {
      // Выполняем действие
      dispatch(action);
      
      // Перезапускаем таймер автосохранения, если он включен
      if (enableAutoSave && userId) {
        // Проверяем, что компонент не размонтирован
        if (userId && unmountInProgress[userId]) {
          return;
        }
        
        // Очищаем предыдущий таймер
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }
        
        // Проверяем, является ли действие критическим, требующим немедленного сохранения
        const isCriticalAction = action.type === 'SET_USER' || 
                               action.type === 'LOAD_GAME_STATE' ||
                               action.type === 'UPGRADE_CONTAINER_CAPACITY' ||
                               action.type === 'UPGRADE_FILLING_SPEED' ||
                               action.type === 'UPDATE_RESOURCES' ||
                               action.type === 'ADD_SNOT' ||
                               action.type === 'COLLECT_CONTAINER_SNOT' ||
                               action.type === 'UPDATE_CONTAINER_SNOT';
                               
        if (isCriticalAction) {
          console.log(`[GameProvider] Критическое действие ${action.type}, запуск немедленного сохранения`);
          saveState().catch(error => {
            console.error('[GameProvider] Ошибка при немедленном сохранении:', error);
          });
        } else {
          // Устанавливаем новый таймер
          autoSaveTimerRef.current = setTimeout(saveState, autoSaveInterval);
        }
      }
    },
    [saveState, enableAutoSave, userId, autoSaveInterval]
  );

  // Отдельный эффект для загрузки, который срабатывает при изменении userId
  useEffect(() => {
    // Проверяем, изменился ли userId
    if (userId !== lastUserIdRef.current) {
      console.log(`[GameProvider] Изменился userId: ${lastUserIdRef.current || 'undefined'} -> ${userId || 'undefined'}`);
      initialLoadDoneRef.current = false;
    }
    
    // Загружаем сохраненное состояние при монтировании или изменении userId
    if (userId && !initialLoadDoneRef.current) {
      // Проверка интервала повторной инициализации
      const now = Date.now();
      const lastInitTime = lastInitializationMap.get(userId);
      
      if (lastInitTime && now - lastInitTime < MIN_INITIALIZATION_INTERVAL) {
        console.log(`[GameProvider] Слишком частая повторная инициализация для ${userId}, прошло ${now - lastInitTime}мс`);
        // Устанавливаем флаг, что загрузка завершена для предотвращения циклов
        initialLoadDoneRef.current = true;
        return;
      }
      
      // Запоминаем время инициализации
      lastInitializationMap.set(userId, now);
      
      console.log(`[GameProvider] Запуск загрузки состояния для ${userId}`);
      
      // Добавляем обработку ошибок при загрузке
      saveState().catch(error => {
        console.error(`[GameProvider] Критическая ошибка при загрузке состояния:`, error);
        // Устанавливаем флаг, что загрузка завершена (чтобы избежать циклов повторных загрузок)
        initialLoadDoneRef.current = true;
        
        // Инициализируем новое состояние в случае ошибки
        dispatch({
          type: 'LOAD_GAME_STATE',
          payload: createInitialGameState(userId)
        });
      });
      
      // Сбрасываем флаг размонтирования, если компонент был повторно смонтирован
      if (unmountInProgress[userId]) {
        console.log(`[GameProvider] Повторное монтирование компонента для ${userId}`);
        unmountInProgress[userId] = false;
      }
    }
  }, [userId, saveState]);
  
  // Обработчик события закрытия страницы
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!userId || !enableAutoSave || state._skipSave || beforeUnloadSaveSentRef.current) {
        return;
      }
      
      // Помечаем, что сохранение при закрытии страницы отправлено
      beforeUnloadSaveSentRef.current = true;
      
      console.log(`[GameProvider] Закрытие страницы, выполняем финальное сохранение для ${userId}`);
      
      // Подготавливаем данные для сохранения
      const stateToSave = {
        ...state,
        _lastSaved: new Date().toISOString(),
        _userId: userId,
        _isCriticalSave: true, // Пометка критичности для API
        _closeType: 'beforeunload', // Причина сохранения
        _saveVersion: (state._saveVersion || 0) + 1 // Увеличиваем версию
      };
      
      // Выполняем сохранение, используя несколько методов для надежности
      let saveAttempted = false;
      
      // Метод 1: Использование navigator.sendBeacon для отправки данных даже после закрытия страницы
      if (navigator.sendBeacon) {
        try {
          const payload = {
            userId,
            gameState: stateToSave,
            isCriticalSave: true,
            version: stateToSave._saveVersion,
            timestamp: Date.now()
          };
          
          // Создаем Blob с данными для отправки
          const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
          
          // Отправляем данные через Beacon API
          const beaconSent = navigator.sendBeacon(API_ROUTES.SAVE, blob);
          
          // Записываем результат
          saveAttempted = beaconSent;
          
          if (!beaconSent) {
            console.warn('[GameProvider] sendBeacon не отправлен, используем запасные методы');
          } else {
            console.log('[GameProvider] sendBeacon успешно отправлен');
          }
        } catch (beaconError) {
          console.error('[GameProvider] Ошибка при использовании sendBeacon:', beaconError);
        }
      }
      
      // Метод 2: Создаем резервную копию в localStorage для восстановления при следующем запуске
      try {
        createBackup(userId, stateToSave, stateToSave._saveVersion || 1);
        console.log('[GameProvider] Создана резервная копия данных при закрытии страницы');
      } catch (backupError) {
        console.error('[GameProvider] Ошибка создания резервной копии:', backupError);
      }
      
      // Метод 3: Попытка синхронного запроса, если браузер дает такую возможность
      if (!saveAttempted) {
        try {
          // Создаем синхронный XMLHttpRequest для последней попытки сохранения
          const xhr = new XMLHttpRequest();
          xhr.open('POST', API_ROUTES.SAVE, false); // false = синхронный запрос
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(JSON.stringify({
            userId,
            gameState: stateToSave,
            isCriticalSave: true
          }));
          
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('[GameProvider] Синхронный запрос успешно выполнен');
          } else {
            console.warn(`[GameProvider] Синхронный запрос вернул статус ${xhr.status}`);
          }
        } catch (syncError) {
          console.error('[GameProvider] Ошибка синхронного запроса:', syncError);
        }
      }
      
      // Можно добавить задержку для лучшего сохранения данных
      // Это не блокирует закрытие страницы полностью, но дает немного времени
      if (!saveAttempted) {
        // Для выделения времени на асинхронные операции, заставляем браузер отобразить
        // диалоговое окно подтверждения (в современных браузерах это стандартное сообщение)
        event.preventDefault();
        event.returnValue = ''; // Для старых браузеров
      }
    };
    
    // Добавляем обработчик закрытия страницы
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
    };
  }, [userId, state, enableAutoSave]);

  // Обработка размонтирования компонента
  useEffect(() => {
    // Идентификатор таймера сохранения при размонтировании
    let unmountSaveTimerId: NodeJS.Timeout | null = null;
    
    // Очищаем таймер автосохранения при размонтировании
    return () => {
      const userId = state._userId;
      if (!userId) return;
      
      // Очищаем таймер автосохранения
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      
      // Очищаем таймер сохранения при размонтировании, если он существует
      if (unmountSaveTimerId) {
        clearTimeout(unmountSaveTimerId);
        unmountSaveTimerId = null;
      }
      
      // Проверяем, не начат ли уже процесс размонтирования для этого userId
      if (unmountInProgress[userId]) {
        console.log(`[GameProvider] Размонтирование уже в процессе для userId: ${userId}, пропускаем повторную обработку`);
        return;
      }
      
      // Сохраняем ссылку на userId при размонтировании
      const userIdCopy = userId;
      
      // Устанавливаем флаг размонтирования
      unmountInProgress[userIdCopy] = true;
      unmountTimestamps[userIdCopy] = Date.now();
      unmountRecordsCount++;

      // Проверяем необходимость очистки старых записей
      cleanupUnmountRecords();

      console.log(`[GameProvider] Компонент размонтирован для userId: ${userIdCopy}`);

      // Приоритетное сохранение при размонтировании
      if (enableAutoSave && !state._skipSave) {
        // Сброс флага финального сохранения
        finalSaveSentRef.current = false;
        
        // Создаем копию стейта на момент размонтирования
        const finalState = { ...state };
        
        // Асинхронное сохранение с нулевой задержкой для избегания блокировки размонтирования
        unmountSaveTimerId = setTimeout(async () => {
          // Проверяем, что компонент все еще в процессе размонтирования (не был повторно смонтирован)
          if (userIdCopy && unmountInProgress[userIdCopy]) {
            console.log(`[GameProvider] Выполняется приоритетное сохранение при размонтировании для userId: ${userIdCopy}`);
            
            // Устанавливаем флаг финального сохранения
            finalSaveSentRef.current = true;
            
            try {
              // Используем сохраненное состояние вместо текущего state
              const stateCopy = {
                ...finalState,
                _lastSaved: new Date().toISOString(),
                _isCriticalSave: true
              };
              
              // Подписываем данные непосредственно перед сохранением
              const signedState = signGameState(userIdCopy, stateCopy);
              
              // Сохраняем копию в localStorage
              localStorageService.saveGameState(userIdCopy, signedState);
              
              // Сохраняем на сервер
              const result = await saveGame(userIdCopy, signedState) as SaveResponse;
              
              console.log(`[GameProvider] Приоритетное сохранение при размонтировании успешно выполнено для userId: ${userIdCopy}`);
            } catch (error) {
              console.error(`[GameProvider] Ошибка при приоритетном сохранении при размонтировании для userId: ${userIdCopy}:`, error);
              
              // Создаем резервную копию в случае ошибки при финальном сохранении
              createBackup(userIdCopy, finalState, finalState._saveVersion || 1);
              console.log('[GameProvider] Создана резервная копия из-за ошибки при финальном сохранении');
            } finally {
              // Сбрасываем флаг размонтирования после завершения сохранения
              if (userIdCopy && unmountInProgress[userIdCopy]) {
                delete unmountInProgress[userIdCopy];
                delete unmountTimestamps[userIdCopy];
                unmountRecordsCount--;
                console.log(`[GameProvider] Флаг размонтирования сброшен для userId: ${userIdCopy}`);
              }
            }
          } else {
            console.log(`[GameProvider] Приоритетное сохранение при размонтировании отменено - компонент уже не в процессе размонтирования для userId: ${userIdCopy}`);
            
            // Сбрасываем флаг размонтирования, если компонент не в процессе размонтирования
            if (userIdCopy && unmountInProgress[userIdCopy]) {
              delete unmountInProgress[userIdCopy];
              delete unmountTimestamps[userIdCopy];
              unmountRecordsCount--;
            }
          }
        }, 0);
      } else {
        console.log(`[GameProvider] Приоритетное сохранение при размонтировании пропущено из-за настроек для userId: ${userId}`);
        
        // Сбрасываем флаг размонтирования
        delete unmountInProgress[userId];
        delete unmountTimestamps[userId];
        unmountRecordsCount--;
      }
    };
  }, [state._userId, state._skipSave, enableAutoSave, saveState, state]);

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