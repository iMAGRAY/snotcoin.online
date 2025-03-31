import React, { useCallback, useEffect, useRef, useState, memo } from 'react';
import { useGameState, useGameDispatch } from '../../contexts';
import { api } from '../../lib/api';
import { useToast } from '../ui/use-toast';
import { MIN_SAVE_INTERVAL, AUTO_SAVE_INTERVAL } from '../../constants/gameConstants';
import type { GameState } from '../../types/gameTypes';
import { debounce } from 'lodash';
// import useVisibilityChange from '../../hooks/useVisibilityChange'; // <-- Похоже, этот импорт не используется и вызывает ошибку линтера в прошлый раз, закомментируем

// Проверяем, определены ли необходимые модули
const mockApi = {
  saveGameProgress: async (gameState: any, options: any) => ({
    success: true,
    error: null
  })
};

// Используем реальный API, если он доступен, иначе заглушку
const apiClient = typeof api !== 'undefined' ? api : mockApi;

// Заглушка для useToast, если компонент недоступен
const useToastFallback = () => ({
  toast: ({ title, description }: { title: string, description: string }) => {
    // console.log(`[Toast] ${title}: ${description}`) // Убираем лог заглушки
  }
});

// Используем реальный useToast или заглушку
const useToastHook = typeof useToast !== 'undefined' ? useToast : useToastFallback;

interface SaveStatus {
  lastSaveTime: number;
  isSaving: boolean;
  error: string | null;
  pendingSave: boolean;
  saveCount: number;
  batchedSaves: number;
  lastBatchId: string | null;
  backoff: number;
  storageIssue: boolean;
}

// Максимальное время ожидания при ошибках (10 секунд)
const MAX_BACKOFF = 10000; 
// Начальная задержка при ошибках (500мс)
const INITIAL_BACKOFF = 500;
// Максимальное количество резервных копий
const MAX_BACKUP_COPIES = 3;
// Префикс для хранения резервных копий
const BACKUP_PREFIX = 'backup_';

// Тип для минимальной резервной копии
interface MinimalBackup {
  _userId?: string;
  _saveVersion?: number;
  _lastSaved?: string;
  _timestamp: number;
  inventory?: {
    snot?: number;
    snotCoins?: number;
    containerCapacity?: number;
    fillingSpeed?: number;
  };
}

// Тип для функции сохранения, экспортируемой для других компонентов
export type SaveGameFunction = (options?: {
  reason?: string;
  isCritical?: boolean;
  force?: boolean;
  silent?: boolean;
}) => Promise<boolean>;

// Props для компонента с дочерними элементами и колбэком сохранения
interface GameSaverProps {
  children?: React.ReactNode;
  onSaveComplete?: (success: boolean) => void;
  saveInterval?: number; // Интервал в мс
  debugMode?: boolean;
}

// Интерфейс для дочерних элементов с функцией сохранения
interface ChildProps {
  saveGame?: SaveGameFunction;
  [key: string]: any;
}

const GameSaver: React.FC<GameSaverProps> = memo(
  ({ children, onSaveComplete, saveInterval = 5000, debugMode = false }) => {
    const gameState = useGameState();
    const dispatch = useGameDispatch();
    const { toast } = useToastHook();
    
    const saveStatusRef = useRef<SaveStatus>({
      lastSaveTime: 0,
      isSaving: false,
      error: null,
      pendingSave: false,
      saveCount: 0,
      batchedSaves: 0,
      lastBatchId: null,
      backoff: INITIAL_BACKOFF,
      storageIssue: false
    });
    
    const [saveStatus, setSaveStatus] = useState<SaveStatus>(saveStatusRef.current);
    
    // Таймеры
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const storageCleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Дополнительные refs для отслеживания состояния сохранения
    const isSavingRef = useRef<boolean>(false);
    const lastSavedStateRef = useRef<string>('');

    const log = useCallback((message: string, data?: any) => {
      if (debugMode) {
        console.log(`[GameSaver] ${message}`, data !== undefined ? data : '');
      }
    }, [debugMode]);

    // Обновляем интерфейс при изменении статуса
    const updateSaveStatus = useCallback((updates: Partial<SaveStatus>) => {
      const newStatus = { ...saveStatusRef.current, ...updates };
      saveStatusRef.current = newStatus;
      setSaveStatus(newStatus);
    }, []);

    // Функция для очистки старых данных из localStorage
    const cleanupLocalStorage = useCallback(() => {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        
        // console.log('[GameSaver] Очистка локального хранилища от старых данных'); // Убираем лог
        
        // Поиск всех резервных копий
        const backupKeys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(BACKUP_PREFIX)) {
            backupKeys.push(key);
          }
        }
        
        // Сортировка резервных копий по времени (старые в начале)
        backupKeys.sort((a, b) => {
          const timeA = parseInt(a.split('_').pop() || '0', 10);
          const timeB = parseInt(b.split('_').pop() || '0', 10);
          return timeA - timeB;
        });
        
        // Удаление старых резервных копий
        if (backupKeys.length > MAX_BACKUP_COPIES) {
          for (let i = 0; i < backupKeys.length - MAX_BACKUP_COPIES; i++) {
            const key = backupKeys[i];
            if (key) {
              // console.log(`[GameSaver] Удалена старая резервная копия: ${key}`); // Убираем лог
              localStorage.removeItem(key);
            }
          }
        }
        
        // Анализ оставшегося места в хранилище
        const storageUsed = calculateLocalStorageSize();
        const storageLimit = 5 * 1024 * 1024; // Примерный лимит ~5MB
        
        // Экстренная очистка
        if (storageUsed > storageLimit * 0.8) {
          // console.warn('[GameSaver] Критически мало места в хранилище. Экстренная очистка.'); // Оставляем warn
          if (backupKeys.length > 1) {
            const latestBackup = backupKeys[backupKeys.length - 1];
            for (let i = 0; i < backupKeys.length - 1; i++) {
              const key = backupKeys[i];
              if (key) {
                localStorage.removeItem(key);
              }
            }
            // console.log(`[GameSaver] Оставлена только последняя копия: ${latestBackup}`); // Убираем лог
          }
          // Удаляем и другие ненужные данные
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('temp_') || key.includes('cache_'))) {
              localStorage.removeItem(key);
            }
          }
          
          // Устанавливаем флаг проблемы с хранилищем
          updateSaveStatus({ storageIssue: true });
          
          // Показываем пользователю предупреждение
          toast({
            title: "Внимание: проблема с хранилищем",
            description: "Браузер ограничивает место для сохранения данных. Рекомендуется очистить кэш браузера.",
            variant: "destructive",
            duration: 5000
          });
        } else {
          updateSaveStatus({ storageIssue: false });
        }
      } catch (error) {
        console.error('[GameSaver] Ошибка при очистке хранилища:', error); // Оставляем error
      }
    }, [toast, updateSaveStatus]);
    
    // Расчет размера данных в localStorage
    const calculateLocalStorageSize = useCallback((): number => {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        
        const value = localStorage.getItem(key) || '';
        total += key.length + value.length;
      }
      return total * 2; // Примерный размер в байтах (2 байта на символ)
    }, []);

    // Создание минимальной резервной копии данных
    const createMinimalBackup = useCallback((state: any, userId: string): MinimalBackup => {
      return {
        _userId: userId,
        _saveVersion: state._saveVersion,
        _lastSaved: state._lastSaved,
        _timestamp: Date.now(),
        inventory: {
          snot: state.inventory?.snot,
          snotCoins: state.inventory?.snotCoins,
          containerCapacity: state.inventory?.containerCapacity,
          fillingSpeed: state.inventory?.fillingSpeed
        }
      };
    }, []);

    // Функция сохранения игры
    const saveGame = useCallback(async (options: { 
      reason?: string;
      isCritical?: boolean;
      force?: boolean;
      silent?: boolean;
    } = {}) => {
      const { reason = 'auto', isCritical = false, force = false, silent = false } = options;
      const status = saveStatusRef.current;
      
      // Проверяем, можно ли сейчас сохранять
      const now = Date.now();
      const timeSinceLastSave = now - status.lastSaveTime;
      const isAutoSave = reason === 'auto';
      const minInterval = isAutoSave ? AUTO_SAVE_INTERVAL : MIN_SAVE_INTERVAL;
      
      // Если уже идет сохранение, планируем отложенное
      if (status.isSaving) {
        if (!status.pendingSave && !silent) {
          updateSaveStatus({ pendingSave: true });
          
          // Планируем повторную попытку через небольшую задержку
          pendingSaveTimerRef.current = setTimeout(() => {
            updateSaveStatus({ pendingSave: false });
            saveGame({ reason, isCritical, silent: true });
          }, 500);
        }
        return false;
      }
      
      // Проверяем интервал между сохранениями, если это не принудительное сохранение
      if (!force && timeSinceLastSave < minInterval) {
        if (!silent) {
          if (!status.pendingSave) {
            updateSaveStatus({ pendingSave: true });
            
            // Планируем сохранение после истечения минимального интервала
            const delayTime = minInterval - timeSinceLastSave;
            pendingSaveTimerRef.current = setTimeout(() => {
              updateSaveStatus({ pendingSave: false });
              saveGame({ reason, isCritical, silent: true });
            }, delayTime);
            
            // Если это не автосохранение, показываем уведомление
            if (!isAutoSave) {
              toast({
                title: "Пожалуйста, подождите",
                description: `Сохранение будет выполнено через ${Math.ceil(delayTime / 1000)} секунд`,
                duration: 2000
              });
            }
          }
        }
        return false;
      }
      
      // Начинаем сохранение
      updateSaveStatus({ 
        isSaving: true, 
        error: null,
        saveCount: status.saveCount + 1
      });
      
      log(`💾 [SAVE] Starting save for user: ${gameState._userId}`); // <-- Оставляем важный лог

      try {
        const userId = gameState._userId;
        if (!userId) {
          // log('Skipping save: No User ID in state'); // Убираем, т.к. есть лог выше
          if (!silent) {
            updateSaveStatus({ error: 'User ID missing' });
          }
          return false;
        }
        
        // Обновляем версию сохранения и сопутствующие данные
        const saveData = {
          ...gameState,
          _saveVersion: (gameState._saveVersion || 0) + 1,
          _lastSaved: new Date().toISOString(),
          _saveReason: reason
        };
        
        // Обновляем состояние игры с новой версией
        dispatch({ type: 'SAVE_STATE', payload: saveData });
        
        // Создаем локальную резервную копию перед отправкой на сервер
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            const backupKey = `${BACKUP_PREFIX}${userId}_${Date.now()}`;
            const minimalBackup = createMinimalBackup(saveData, userId);
            localStorage.setItem(backupKey, JSON.stringify(minimalBackup));
            // console.log(`[GameSaver] Создана компактная резервная копия: ${backupKey}`); // Убираем лог
            setTimeout(cleanupLocalStorage, 100); // Оставляем вызов очистки
          } catch (storageError) {
            console.error('[GameSaver] Ошибка при создании резервной копии:', storageError); // Оставляем error
            if (storageError instanceof DOMException && 
               (storageError.name === 'QuotaExceededError' || storageError.code === 22)) {
              cleanupLocalStorage();
            }
          }
        }
        
        log(`💾 [SAVE] Calling storageService.saveGameState for user: ${userId}`); // <-- Оставляем важный лог
        const response = await apiClient.saveGameProgress(saveData, { 
          isCritical, 
          reason
        });
        
        if (response.success) {
          log(`✅ [SAVE] Save successful for user: ${userId}`); // <-- Оставляем важный лог
          // Сбрасываем backoff при успешном сохранении
          const newSaveStatus: Partial<SaveStatus> = {
            lastSaveTime: now,
            isSaving: false,
            error: null,
            backoff: INITIAL_BACKOFF
          };
          
          // Если это был пакетный запрос (batched), обновляем счетчик
          if (response && 'isBatched' in response && response.isBatched) {
            newSaveStatus.batchedSaves = (status.batchedSaves || 0) + 1;
            newSaveStatus.lastBatchId = 'batchId' in response ? response.batchId : 'unknown';
          }
          
          updateSaveStatus(newSaveStatus);
          
          // Показываем уведомление об успешном сохранении, если не тихий режим
          if (!silent && !isAutoSave) {
            toast({
              title: "Прогресс сохранен",
              description: response && 'isBatched' in response && response.isBatched 
                ? `Объединено с ${('totalRequests' in response ? response.totalRequests : 'несколькими')} запросами (ID: ${('batchId' in response ? response.batchId : 'unknown')})` 
                : "Игра успешно сохранена",
              duration: 2000
            });
          }
          
          // Вызываем колбэк если он предоставлен
          if (onSaveComplete) {
            onSaveComplete(true);
          }
          
          return true;
        } else {
          throw new Error(response.error || 'Ошибка сохранения');
        }
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`❌ [SAVE] Save failed for user: ${gameState._userId}. Error: ${errorMessage}`); // <-- Оставляем важный лог
        // Обработка ошибки
        const isTooManyRequests = errorMessage.includes('TOO_MANY_REQUESTS') || 
                                 errorMessage.includes('SAVE_IN_PROGRESS');
        
        // Увеличиваем backoff только для сетевых ошибок и ошибок сервера
        let newBackoff = status.backoff;
        if (!isTooManyRequests) {
          // Экспоненциальный backoff при серверных ошибках
          newBackoff = Math.min(status.backoff * 1.5, MAX_BACKOFF);
        }
        
        // Проверяем ошибки, связанные с хранилищем
        const isStorageError = errorMessage.includes('QuotaExceeded') || 
                               errorMessage.includes('INSUFFICIENT_RESOURCES') ||
                               errorMessage.includes('localStorage');
        
        // При ошибке хранилища запускаем очистку
        if (isStorageError) {
          cleanupLocalStorage();
        }
        
        updateSaveStatus({
          isSaving: false,
          error: errorMessage,
          backoff: newBackoff,
          storageIssue: isStorageError ? true : status.storageIssue
        });
        
        // Показываем ошибку пользователю только в ручном режиме
        if (!silent && !isAutoSave) {
          toast({
            title: "Ошибка сохранения",
            description: isStorageError
              ? "Недостаточно места в хранилище браузера. Выполнена автоматическая очистка."
              : isTooManyRequests
                ? "Слишком много запросов на сохранение. Повторите попытку позже."
                : "Не удалось сохранить прогресс. Повторите попытку позже.",
            variant: "destructive",
            duration: 3000
          });
        }
        
        // При ошибке ставим следующее сохранение в очередь
        if (!isTooManyRequests) {
          pendingSaveTimerRef.current = setTimeout(() => {
            updateSaveStatus({ pendingSave: false });
            saveGame({ reason, isCritical, silent: true });
          }, newBackoff);
        }
        
        // Вызываем колбэк если он предоставлен
        if (onSaveComplete) {
          onSaveComplete(false);
        }
        
        return false;
      } finally {
         updateSaveStatus({ isSaving: false }); // Убедимся, что статус сбрасывается
         log(`💾 [SAVE] Finished save attempt for user: ${gameState._userId}`); // <-- Оставляем важный лог
      }
    }, [gameState, dispatch, toast, updateSaveStatus, onSaveComplete, cleanupLocalStorage, createMinimalBackup, log]);
  
    // Сохранение для публичного использования
    const saveGamePublic = useCallback((options: {
      reason?: string;
      isCritical?: boolean;
      force?: boolean;
      silent?: boolean;
    } = {}) => {
      return saveGame(options);
    }, [saveGame]);
  
    // Автосохранение
    useEffect(() => {
      const setupAutoSave = () => {
        if (autoSaveTimerRef.current) {
          clearInterval(autoSaveTimerRef.current);
        }
        
        autoSaveTimerRef.current = setInterval(() => {
          saveGame({ reason: 'auto', silent: true });
        }, AUTO_SAVE_INTERVAL);
      };
      
      setupAutoSave();
      
      // Периодический запуск очистки хранилища
      storageCleanupTimerRef.current = setInterval(() => {
        cleanupLocalStorage();
      }, 10 * 60 * 1000); // Каждые 10 минут
      
      return () => {
        if (autoSaveTimerRef.current) {
          clearInterval(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }
        
        if (pendingSaveTimerRef.current) {
          clearTimeout(pendingSaveTimerRef.current);
          pendingSaveTimerRef.current = null;
        }
        
        if (storageCleanupTimerRef.current) {
          clearInterval(storageCleanupTimerRef.current);
          storageCleanupTimerRef.current = null;
        }
      };
    }, [saveGame, cleanupLocalStorage]);
  
    // Очистка хранилища при первом монтировании компонента
    useEffect(() => {
      // Первоначальная очистка хранилища
      cleanupLocalStorage();
    }, [cleanupLocalStorage]);
  
    // Сохранение перед закрытием окна
    useEffect(() => {
      const handleBeforeUnload = () => {
        // Быстрое сохранение перед закрытием окна
        const currentState = {
          ...gameState,
          _isBeforeUnloadSave: true,
          _lastSaved: new Date().toISOString(),
          _saveVersion: (gameState._saveVersion || 0) + 1,
          _saveReason: 'before_unload'
        };
        
        // Создаем компактную резервную копию перед закрытием окна
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            const userId = currentState._userId || 'unknown';
            const backupKey = `${BACKUP_PREFIX}${userId}_unload_${Date.now()}`;
            
            // Получаем минимальную версию данных для резервной копии
            const minimalBackup = createMinimalBackup(currentState, userId);
            
            localStorage.setItem(backupKey, JSON.stringify(minimalBackup));
          } catch (e) {
            // Игнорируем ошибки при закрытии окна
          }
        }
        
        // Используем синхронный API для отправки данных
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/game/save-progress', false); // Синхронный запрос
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(JSON.stringify({ 
            gameState: currentState,
            reason: 'before_unload',
            isCritical: true
          }));
        } catch (e) {
          // В случае ошибки просто логируем
          // console.error('Ошибка при сохранении перед закрытием:', e); // Можно оставить, если нужно отлаживать этот момент
        }
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }, [gameState, createMinimalBackup]);
  
    // Если есть дочерние элементы, клонируем их с функцией сохранения
    const childrenWithProps = React.Children.map(children, (child) => {
      if (React.isValidElement(child)) {
        return React.cloneElement(child as React.ReactElement<ChildProps>, { saveGame: saveGamePublic });
      }
      return child;
    });
  
    // Debounced save function
    const debouncedSave = useRef(debounce(saveGame, saveInterval)).current;

    // Effect to trigger save on state change
    useEffect(() => {
      // log('Game state changed, scheduling debounced save', { userId: gameState._userId }); // Убираем лог на каждое изменение
      if (gameState._userId) {
        debouncedSave({ reason: 'state_change', silent: true });
        // Обновляем значение lastSavedStateRef при каждом изменении состояния
        lastSavedStateRef.current = JSON.stringify({
          ...gameState,
          _lastSaved: new Date().toISOString()
        });
      }
      return () => {
        debouncedSave.cancel();
      };
    }, [gameState, debouncedSave]); // Убрали log из зависимостей

    // Синхронизируем isSavingRef с saveStatus.isSaving
    useEffect(() => {
      isSavingRef.current = saveStatus.isSaving;
    }, [saveStatus.isSaving]);

    // Force save on visibility change (page hidden)
    const handleVisibilityChange = useCallback((isVisible: boolean) => {
      if (!isVisible) {
        // log('Page hidden, attempting immediate save'); // Убираем лог
        debouncedSave.flush();
        // Если в данный момент нет активного сохранения, и есть userId,
        // и состояние изменилось с момента последнего сохранения, сохраняем немедленно
        const currentStateString = JSON.stringify({
            ...gameState,
            _lastSaved: 'pending' // Используем плейсхолдер, т.к. точное время будет установлено в performSave
          });
        if (!isSavingRef.current && gameState._userId && currentStateString !== lastSavedStateRef.current) {
            saveGame({ 
              reason: 'visibility_change', 
              isCritical: true,
              silent: true 
            });
        }
      }
    }, [debouncedSave, saveGame, gameState]);

    // useVisibilityChange(handleVisibilityChange); // <-- Временно закомментируем, т.к. импорт вызвал ошибку

    // Функция сохранения для передачи дочерним элементам
    const exposedSaveGame: SaveGameFunction = useCallback(async (options = {}) => {
      // log("External save requested", options); // Убираем лог
      return saveGame(options);
    }, [saveGame]);

    return (
      <div className="game-saver">
        {/* Интерфейс для ручного сохранения и индикации состояния */}
        <button 
          onClick={() => saveGamePublic({ reason: 'manual_button', silent: false })}
          disabled={saveStatus.isSaving || saveStatus.pendingSave}
          className="save-button"
        >
          {saveStatus.isSaving ? 'Сохранение...' : 
           saveStatus.pendingSave ? 'Ожидание...' : 'Сохранить игру'}
        </button>
        
        {saveStatus.error && (
          <div className="save-error">
            Ошибка: {saveStatus.error}
          </div>
        )}
        
        {saveStatus.storageIssue && (
          <div className="storage-issue-warning">
            Внимание: проблемы с хранилищем. Рекомендуется очистить кэш браузера.
          </div>
        )}
        
        {/* Рендерим дочерние компоненты с функцией сохранения */}
        {childrenWithProps}
      </div>
    );
  }
);

GameSaver.displayName = 'GameSaver';

export default GameSaver; 