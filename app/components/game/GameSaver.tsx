import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useGameState } from '../../context/GameContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { useToast } from '../ui/use-toast';
import { MIN_SAVE_INTERVAL, AUTO_SAVE_INTERVAL } from '../../constants/gameConstants';
import type { GameState } from '../../types/gameTypes';

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
  toast: ({ title, description }: { title: string, description: string }) => 
    console.log(`[Toast] ${title}: ${description}`)
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
}) => Promise<boolean>;

// Props для компонента с дочерними элементами и колбэком сохранения
interface GameSaverProps {
  children?: React.ReactNode;
  onSaveComplete?: (success: boolean) => void;
}

// Интерфейс для дочерних элементов с функцией сохранения
interface ChildProps {
  saveGame?: SaveGameFunction;
  [key: string]: any;
}

const GameSaver: React.FC<GameSaverProps> = ({ children, onSaveComplete }) => {
  const gameContextValue = typeof useGameState !== 'undefined' ? useGameState() : { gameState: {}, setGameState: () => {} };
  const { gameState, setGameState } = gameContextValue as any;
  
  const authValue = typeof useAuth !== 'undefined' ? useAuth() : { token: null };
  const { token } = authValue as any;
  
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
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const storageCleanupTimerRef = useRef<NodeJS.Timeout | null>(null);
  
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
      
      console.log('[GameSaver] Очистка локального хранилища от старых данных');
      
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
      
      // Удаление старых резервных копий, оставляя только MAX_BACKUP_COPIES
      if (backupKeys.length > MAX_BACKUP_COPIES) {
        for (let i = 0; i < backupKeys.length - MAX_BACKUP_COPIES; i++) {
          const key = backupKeys[i];
          if (key) {
            console.log(`[GameSaver] Удалена старая резервная копия: ${key}`);
            localStorage.removeItem(key);
          }
        }
      }
      
      // Анализ оставшегося места в хранилище
      const storageUsed = calculateLocalStorageSize();
      const storageLimit = 5 * 1024 * 1024; // Примерный лимит ~5MB
      
      console.log(`[GameSaver] Использовано хранилища: ${(storageUsed / 1024 / 1024).toFixed(2)}MB`);
      
      // Если места всё равно мало, очищаем всё кроме самой последней копии
      if (storageUsed > storageLimit * 0.8) { // если занято более 80%
        console.warn('[GameSaver] Критически мало места в хранилище. Экстренная очистка.');
        
        // Оставляем только самую новую резервную копию
        if (backupKeys.length > 1) {
          const latestBackup = backupKeys[backupKeys.length - 1];
          for (let i = 0; i < backupKeys.length - 1; i++) {
            const key = backupKeys[i];
            if (key) {
              localStorage.removeItem(key);
            }
          }
          console.log(`[GameSaver] Оставлена только последняя копия: ${latestBackup}`);
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
      console.error('[GameSaver] Ошибка при очистке хранилища:', error);
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
    const { reason = 'manual', isCritical = false, force = false, silent = false } = options;
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
    
    // Проверяем свободное место в хранилище перед сохранением
    if (status.storageIssue) {
      cleanupLocalStorage();
    }
    
    // Начинаем сохранение
    updateSaveStatus({ 
      isSaving: true, 
      error: null,
      saveCount: status.saveCount + 1
    });
    
    try {
      // Обновляем версию сохранения и сопутствующие данные
      const saveData = {
        ...gameState,
        _saveVersion: (gameState._saveVersion || 0) + 1,
        _lastSaved: new Date().toISOString(),
        _saveReason: reason
      };
      
      // Обновляем состояние игры с новой версией
      setGameState(saveData);
      
      // Создаем локальную резервную копию перед отправкой на сервер
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const userId = saveData._userId || 'unknown';
          // Создаем резервную копию с минимальными критическими данными
          const backupKey = `${BACKUP_PREFIX}${userId}_${Date.now()}`;
          
          // Получаем минимальную версию данных для резервной копии
          const minimalBackup = createMinimalBackup(saveData, userId);
          
          localStorage.setItem(backupKey, JSON.stringify(minimalBackup));
          console.log(`[GameSaver] Создана компактная резервная копия: ${backupKey}`);
          
          // Очищаем старые копии
          setTimeout(cleanupLocalStorage, 100);
        } catch (storageError) {
          // Если не удалось создать резервную копию, очищаем хранилище
          console.error('[GameSaver] Ошибка при создании резервной копии:', storageError);
          if (storageError instanceof DOMException && 
             (storageError.name === 'QuotaExceededError' || storageError.code === 22)) {
            cleanupLocalStorage();
          }
        }
      }
      
      // Отправляем данные на сервер
      const response = await apiClient.saveGameProgress(saveData, { 
        isCritical, 
        reason
      });
      
      // Обработка успешного ответа
      if (response.success) {
        // Сбрасываем backoff при успешном сохранении
        const newSaveStatus: Partial<SaveStatus> = {
          lastSaveTime: now,
          isSaving: false,
          error: null,
          backoff: INITIAL_BACKOFF
        };
        
        // Если это был пакетный запрос (batched), обновляем счетчик
        if (response.isBatched) {
          newSaveStatus.batchedSaves = (status.batchedSaves || 0) + 1;
          newSaveStatus.lastBatchId = response.batchId;
        }
        
        updateSaveStatus(newSaveStatus);
        
        // Показываем уведомление об успешном сохранении, если не тихий режим
        if (!silent && !isAutoSave) {
          toast({
            title: "Прогресс сохранен",
            description: response.isBatched 
              ? `Объединено с ${response.totalRequests} запросами (ID: ${response.batchId})` 
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
      // Обработка ошибки
      const errorMessage = error instanceof Error ? error.message : String(error);
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
    }
  }, [gameState, setGameState, token, toast, updateSaveStatus, onSaveComplete, cleanupLocalStorage, createMinimalBackup]);
  
  // Сохранение для публичного использования
  const saveGamePublic = useCallback((options: {
    reason?: string;
    isCritical?: boolean;
    force?: boolean;
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
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.send(JSON.stringify({ 
          gameState: currentState,
          reason: 'before_unload',
          isCritical: true
        }));
      } catch (e) {
        // В случае ошибки просто логируем
        console.error('Ошибка при сохранении перед закрытием:', e);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [gameState, token, createMinimalBackup]);
  
  // Если есть дочерние элементы, клонируем их с функцией сохранения
  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<ChildProps>, { saveGame: saveGamePublic });
    }
    return child;
  });
  
  return (
    <div className="game-saver">
      {/* Интерфейс для ручного сохранения и индикации состояния */}
      <button 
        onClick={() => saveGamePublic({ reason: 'manual_button' })}
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
};

export default GameSaver; 