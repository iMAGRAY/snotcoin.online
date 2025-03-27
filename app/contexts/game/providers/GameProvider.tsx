'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { GameStateContext, GameDispatchContext, IsSavingContext } from '../contexts'
import { gameReducer } from '../../../reducers/gameReducer'
import { createInitialGameState, Action, GameState } from '../../../types/gameTypes'
import { 
  saveGameStateWithIntegrity as saveGameState, 
  loadGameStateWithIntegrity as loadGameState,
  getLatestBackup,
  API_ROUTES 
} from '../../../services/gameDataService'
import { 
  cleanupLocalStorage, 
  safeSetItem, 
  getLocalStorageSize 
} from '../../../services/localStorageManager'
import * as storageService from '../../../services/storageService'
import { StorageType } from '../../../services/storageService'

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
// Для отслеживания последних сохранений
const lastSaveTimestamps: Record<string, number> = {};
// Минимальный интервал между сохранениями (в миллисекундах)
const MIN_SAVE_INTERVAL = 2000; // 2 секунды
// Счетчик для отслеживания общего количества записей
let unmountRecordsCount = 0;

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
      delete lastSaveTimestamps[key]; // Также очищаем записи о последних сохранениях
      unmountRecordsCount--;
      cleanedCount++;
    }
  }
  
  // Если по времени ничего не удалилось, а счетчик всё еще высокий, 
  // удаляем 20% самых старых записей для предотвращения переполнения
  if (cleanedCount === 0 && unmountRecordsCount > MAX_UNMOUNT_RECORDS) {
    const entries = Object.entries(unmountTimestamps);
    entries.sort(([, a], [, b]) => a - b);
    
    const keysToRemove = entries.slice(0, Math.ceil(entries.length * 0.2)).map(([key]) => key);
    
    keysToRemove.forEach(key => {
      delete unmountInProgress[key];
      delete unmountTimestamps[key];
      delete lastSaveTimestamps[key]; // Также очищаем записи о последних сохранениях
      unmountRecordsCount--;
      cleanedCount++;
    });
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
      return normalizeUserId(userId);
    }
    return null;
  } catch (error) {
    console.error('[GameProvider] Ошибка при получении userId из localStorage:', error);
    return null;
  }
};

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

export function GameProvider({
  children,
  initialState,
  userId: propUserId,
  enableAutoSave = true,
  autoSaveInterval = 5000
}: GameProviderProps) {
  // Используем userId из props или из localStorage
  const [userId, setUserId] = useState<string | undefined>(propUserId);
  
  // Добавляем функцию для безопасного обращения к userId
  const getSafeUserId = useCallback(() => {
    return userId || '';
  }, [userId]);
  
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

  // Загрузка сохраненного состояния
  const loadSavedState = async () => {
    if (!userId || isLoading || initialLoadDoneRef.current) {
      return;
    }
    
    try {
      console.log(`[GameProvider] Начинаем загрузку сохранения для ${userId}`);
      setIsLoading(true);
      
      // Инициализируем storageService при первой загрузке
      await storageService.initStorage({
        autoCleanup: true,
        maxBackups: 3,
        preferredStorage: StorageType.HYBRID
      });
      
      // Загружаем состояние из любого доступного хранилища
      const normalizedId = normalizeUserId(userId);
      const { data, source } = await storageService.loadGameState(normalizedId);
      
      if (data) {
        console.log(`[GameProvider] Успешно загружено состояние для ${userId} из ${source}`);
        
        // Проверяем, не было ли размонтирование во время загрузки
        if (unmountInProgress[normalizedId]) {
          console.warn(`[GameProvider] Компонент был размонтирован во время загрузки, загрузка отменена`);
          setIsLoading(false);
          return;
        }
        
        // Загружаем состояние
        try {
          dispatch({
            type: 'LOAD_GAME_STATE',
            payload: data
          });
          
          // Если загружено из старого формата (localStorage или другого хранилища), 
          // создаем резервную копию в IndexedDB для будущего использования
          if (source === StorageType.LOCAL_STORAGE && storageService.getStorageConfig().preferredStorage !== StorageType.LOCAL_STORAGE) {
            console.log(`[GameProvider] Создаем резервную копию в IndexedDB для будущего использования`);
            await storageService.createBackup(normalizedId, data, data._saveVersion || 1);
          }
          
          console.log(`[GameProvider] Успешно загружено состояние для ${userId}`);
          initialLoadDoneRef.current = true;
        } catch (loadError) {
          console.error(`[GameProvider] Ошибка при загрузке состояния:`, loadError);
        }
      } else {
        console.log(`[GameProvider] Сохранение не найдено для ${userId}, инициализируем новое состояние`);
        dispatch({
          type: 'LOAD_GAME_STATE',
          payload: createInitialGameState(userId)
        });
        initialLoadDoneRef.current = true;
      }
    } catch (error) {
      console.error(`[GameProvider] Ошибка при загрузке состояния:`, error);
      
      // В случае ошибки инициализируем новое состояние
      dispatch({
        type: 'LOAD_GAME_STATE',
        payload: createInitialGameState(userId)
      });
      initialLoadDoneRef.current = true;
    } finally {
      // Завершаем загрузку
      setIsLoading(false);
      initialLoadDoneRef.current = true; 
      lastUserIdRef.current = userId;
    }
  };

  // Функция для сохранения состояния игры
  const saveState = useCallback(async () => {
    // Проверяем, что есть ID пользователя и сохранение разрешено
    if (!userId || !enableAutoSave || state._skipSave) {
      return;
    }
    
    // Если уже идет сохранение, пропускаем
    if (isSaving) {
      return;
    }
    
    // Получаем нормализованный ID пользователя
    const normalizedId = normalizeUserId(userId);
    
    try {
      setIsSaving(true);
      
      // Подготавливаем состояние к сохранению
      const preparedState = prepareGameStateForSave(state);
      
      console.log(`[GameProvider] Сохранение состояния для пользователя: ${normalizedId}`);
      
      // Сохраняем состояние и получаем информацию о типе хранилища
      const { success, storageType } = await storageService.saveGameState(
        normalizedId,
        preparedState,
        preparedState._saveVersion || 1
      );
      
      // Обновляем lastUserIdRef
      lastUserIdRef.current = userId;
      
      // Если сохранение выполнено в процессе размонтирования, сбрасываем флаг
      if (userId && unmountInProgress[normalizedId] && !finalSaveSentRef.current) {
        console.log(`[GameProvider] Обычное сохранение выполнено в процессе размонтирования компонента`);
      }
      
      // Отправляем событие успешного сохранения
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('game-saved', {
          detail: {
            userId,
            storageType
          }
        }));
      }
    } catch (error) {
      console.error('[GameProvider] Ошибка при сохранении игрового состояния:', error);
      
      // Создаем резервную копию в случае ошибки
      try {
        // Убедитесь, что normalizedId определен
        if (userId) {
          const backupState = prepareGameStateForSave(state);
          await storageService.createBackup(
            normalizedId,
            backupState,
            backupState._saveVersion || 1
          );
          console.log('[GameProvider] Создана резервная копия из-за ошибки сохранения');
        }
      } catch (backupError) {
        console.error('[GameProvider] Не удалось создать резервную копию при ошибке сохранения:', backupError);
      }
      
      // Отправляем событие об ошибке
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
      if (!userId || !unmountInProgress[normalizedId]) {
        setIsSaving(false);
      }
    }
  }, [state, enableAutoSave, userId, isSaving]);

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
                               action.type === 'UPGRADE_FILLING_SPEED';
                               
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
      console.log(`[GameProvider] Запуск загрузки состояния для ${userId}`);
      
      // Добавляем обработку ошибок при загрузке
      loadSavedState().catch(error => {
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
  }, [userId, loadSavedState]);
  
  // Обработчик события закрытия страницы
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Выключаем индикатор сохранения
      setIsSaving(false);
      
      // Если компонент уже размонтирован, ничего не делаем
      if (userId && unmountInProgress[userId]) {
        return;
      }
      
      try {
        // Создаем резервную копию только если есть userId и сохранение не отключено
        if (userId && enableAutoSave && !state._skipSave) {
          console.log(`[GameProvider] Создание резервной копии перед закрытием окна`);
          
          // Используем синхронное API для создания резервной копии
          const preparedState = {
            ...state,
            _lastSaved: new Date().toISOString(),
            _userId: userId
          };
          
          // Используем localStorage напрямую, так как в beforeUnload нельзя использовать асинхронные вызовы
          try {
            const backupKey = `backup_${userId}_${Date.now()}`;
            localStorage.setItem(backupKey, JSON.stringify({
              gameState: preparedState,
              timestamp: Date.now(),
              version: preparedState._saveVersion || 1
            }));
            
            localStorage.setItem(`backup_${userId}_latest`, backupKey);
            console.log(`[GameProvider] Резервная копия создана перед закрытием окна`);
          } catch (storageError) {
            console.error(`[GameProvider] Ошибка при создании резервной копии перед закрытием:`, storageError);
          }
        }
      } catch (error) {
        console.error(`[GameProvider] Ошибка при обработке закрытия окна:`, error);
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
    // Очищаем таймер автосохранения при размонтировании
    return () => {
      const userId = state._userId;
      if (!userId) return;
      
      const normalizedId = normalizeUserId(userId);
      
      // Очищаем таймер автосохранения
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      
      // Устанавливаем флаг размонтирования
      unmountInProgress[normalizedId] = true;
      unmountTimestamps[normalizedId] = Date.now();
      unmountRecordsCount++;
      
      // Проверяем необходимость очистки старых записей
      cleanupUnmountRecords();
      
      console.log(`[GameProvider] Компонент размонтирован для userId: ${normalizedId}`);
      
      // Проверяем, когда было последнее сохранение
      const now = Date.now();
      const lastSaveTime = lastSaveTimestamps[normalizedId] || 0;
      const timeSinceLastSave = now - lastSaveTime;
      
      // Если сохранение было недавно, пропускаем
      if (timeSinceLastSave < MIN_SAVE_INTERVAL) {
        console.log(`[GameProvider] Пропуск сохранения при размонтировании - последнее сохранение было ${timeSinceLastSave}мс назад (минимальный интервал: ${MIN_SAVE_INTERVAL}мс)`);
        return;
      }
      
      // Обновляем время последнего сохранения
      lastSaveTimestamps[normalizedId] = now;
      
      // Приоритетное сохранение при размонтировании
      if (enableAutoSave && !state._skipSave) {
        // Сброс флага финального сохранения
        finalSaveSentRef.current = false;
        
        // Асинхронное сохранение с нулевой задержкой для избегания блокировки размонтирования
        setTimeout(async () => {
          // Проверяем, что компонент все еще в процессе размонтирования (не был повторно смонтирован)
          if (normalizedId && unmountInProgress[normalizedId]) {
            console.log(`[GameProvider] Выполняется приоритетное сохранение при размонтировании для userId: ${normalizedId}`);
            
            // Устанавливаем флаг финального сохранения
            finalSaveSentRef.current = true;
            
            try {
              await saveState();
              console.log(`[GameProvider] Приоритетное сохранение при размонтировании успешно выполнено для userId: ${normalizedId}`);
            } catch (error) {
              console.error(`[GameProvider] Ошибка при приоритетном сохранении при размонтировании для userId: ${normalizedId}:`, error);
              
              // Создаем резервную копию в случае ошибки при финальном сохранении
              const safeUserId = getSafeUserId();
              await storageService.createBackup(normalizedId, state, state._saveVersion || 1);
              console.log('[GameProvider] Создана резервная копия из-за ошибки при финальном сохранении');
            } finally {
              // Сбрасываем флаг размонтирования после завершения сохранения
              if (normalizedId) {
                delete unmountInProgress[normalizedId];
                delete unmountTimestamps[normalizedId];
                unmountRecordsCount--;
                console.log(`[GameProvider] Флаг размонтирования сброшен для userId: ${normalizedId}`);
              }
            }
          } else {
            console.log(`[GameProvider] Приоритетное сохранение при размонтировании отменено - компонент уже не в процессе размонтирования для userId: ${normalizedId}`);
            
            // Сбрасываем флаг размонтирования, если компонент не в процессе размонтирования
            if (normalizedId) {
              delete unmountInProgress[normalizedId];
              delete unmountTimestamps[normalizedId];
              unmountRecordsCount--;
            }
          }
        }, 0);
      } else {
        console.log(`[GameProvider] Приоритетное сохранение при размонтировании пропущено из-за настроек для userId: ${normalizedId}`);
        
        // Сбрасываем флаг размонтирования
        delete unmountInProgress[normalizedId];
        delete unmountTimestamps[normalizedId];
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