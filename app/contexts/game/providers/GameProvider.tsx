'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { GameStateContext, GameDispatchContext, IsSavingContext } from '../contexts'
import { gameReducer } from '../../../reducers/gameReducer'
import { createInitialGameState, Action, GameState } from '../../../types/gameTypes'
import { saveGameStateWithIntegrity as saveGameState, loadGameStateWithIntegrity as loadGameState } from '../../../services/gameDataService'
// Добавляем импорт lodash для более безопасной работы с объектами
import { get, set } from 'lodash'

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
// Счетчик для отслеживания общего количества записей
let unmountRecordsCount = 0;

/**
 * Очищает старые записи о размонтировании, если их количество превышает лимит
 */
const cleanupUnmountRecords = () => {
  if (unmountRecordsCount <= MAX_UNMOUNT_RECORDS) return;
  
  // Когда достигнут лимит, очищаем все записи
  for (const key in unmountInProgress) {
    delete unmountInProgress[key];
  }
  unmountRecordsCount = 0;
  console.log('[GameProvider] Очищены записи о размонтировании');
};

// Функция для получения userId из localStorage
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

export function GameProvider({
  children,
  initialState,
  userId: propUserId,
  enableAutoSave = true,
  autoSaveInterval = 5000
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
    
    // Очистка старых записей при монтировании
    cleanupUnmountRecords();
  }, [propUserId]);

  // Загрузка сохраненного состояния
  const loadSavedState = useCallback(async () => {
    if (!userId) {
      console.log('[GameProvider] Пропуск загрузки состояния: отсутствует userId');
      return false;
    }
    
    try {
      setIsLoading(true);
      console.log(`[GameProvider] Загрузка состояния для пользователя: ${userId}`);
      
      const loadedState = await loadGameState(userId);
      
      // Проверяем, что компонент не был размонтирован во время загрузки
      if (unmountInProgress[userId]) {
        console.log(`[GameProvider] Отмена обработки загруженного состояния - компонент размонтирован`);
        return false;
      }
      
      // Проверяем, получены ли правильные данные перед их применением
      if (loadedState.success && loadedState.data) {
        // Синхронизируем состояние игры
        console.log(`[GameProvider] Успешно загружено состояние для ${userId}`, loadedState);
        
        // Обновляем состояние через редьюсер
        dispatch({
          type: 'LOAD_GAME_STATE',
          payload: {
            ...loadedState.data,
            _userId: userId,
            // Установка версии сервера, если имеется
            _saveVersion: loadedState.version || 1
          }
        });
        
        // Сохраняем последний userId
        lastUserIdRef.current = userId;
        
        // Отмечаем, что загрузка выполнена
        initialLoadDoneRef.current = true;
        return true;
      } else {
        console.log(`[GameProvider] Нет данных для пользователя ${userId}, инициализируем новое состояние`);
        // Если нет данных, инициализируем новое состояние с userId
        dispatch({
          type: 'LOAD_GAME_STATE',
          payload: createInitialGameState(userId)
        });
        initialLoadDoneRef.current = true;
        return false;
      }
    } catch (error) {
      console.error('[GameProvider] Ошибка при загрузке состояния:', error);
      // В случае ошибки инициализируем новое состояние
      dispatch({
        type: 'LOAD_GAME_STATE',
        payload: createInitialGameState(userId)
      });
      initialLoadDoneRef.current = true;
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

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
      const saveResult = await saveGameState(userId, stateToSave);
      
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
          // ... existing code ...
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

  // Обработка размонтирования компонента
  useEffect(() => {
    // Очищаем таймер автосохранения при размонтировании
    return () => {
      const userId = state._userId;
      if (!userId) return;
      
      // Очищаем таймер автосохранения
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      
      // Устанавливаем флаг размонтирования
      unmountInProgress[userId] = true;
      unmountRecordsCount++;
      
      // Проверяем необходимость очистки старых записей
      cleanupUnmountRecords();
      
      console.log(`[GameProvider] Компонент размонтирован для userId: ${userId}`);
      
      // Приоритетное сохранение при размонтировании
      if (enableAutoSave && !state._skipSave) {
        // Сброс флага финального сохранения
        finalSaveSentRef.current = false;
        
        // Асинхронное сохранение с нулевой задержкой для избегания блокировки размонтирования
        setTimeout(async () => {
          // Проверяем, что компонент все еще в процессе размонтирования (не был повторно смонтирован)
          if (userId && unmountInProgress[userId]) {
            console.log(`[GameProvider] Выполняется приоритетное сохранение при размонтировании для userId: ${userId}`);
            
            // Устанавливаем флаг финального сохранения
            finalSaveSentRef.current = true;
            
            try {
              await saveState();
              console.log(`[GameProvider] Приоритетное сохранение при размонтировании успешно выполнено для userId: ${userId}`);
            } catch (error) {
              console.error(`[GameProvider] Ошибка при приоритетном сохранении при размонтировании для userId: ${userId}:`, error);
            } finally {
              // Сбрасываем флаг размонтирования после завершения сохранения
              if (userId) {
                delete unmountInProgress[userId];
                unmountRecordsCount--;
                console.log(`[GameProvider] Флаг размонтирования сброшен для userId: ${userId}`);
              }
            }
          } else {
            console.log(`[GameProvider] Приоритетное сохранение при размонтировании отменено - компонент уже не в процессе размонтирования для userId: ${userId}`);
            
            // Сбрасываем флаг размонтирования, если компонент не в процессе размонтирования
            if (userId) {
              delete unmountInProgress[userId];
              unmountRecordsCount--;
            }
          }
        }, 0);
      } else {
        console.log(`[GameProvider] Приоритетное сохранение при размонтировании пропущено из-за настроек для userId: ${userId}`);
        
        // Сбрасываем флаг размонтирования
        delete unmountInProgress[userId];
        unmountRecordsCount--;
      }
    };
  }, [state._userId, state._skipSave, enableAutoSave, saveState]);

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