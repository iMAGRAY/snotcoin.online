import React, { useCallback, useEffect, useRef, useState, memo, useMemo } from 'react';
import { useGameState, useGameDispatch } from '../../contexts';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/use-toast';
import { MIN_SAVE_INTERVAL, AUTO_SAVE_INTERVAL } from '../../constants/gameConstants';
import type { GameState } from '../../types/gameTypes';
import type { SaveGameResponse } from '../../lib/api';
import { debounce } from 'lodash';
import { useFarcaster } from '../../contexts/FarcasterContext';

// Простая функция для отслеживания видимости страницы
const useVisibilityChange = (callback: (isVisible: boolean) => void) => {
  useEffect(() => {
    const handleVisibilityChange = () => {
      callback(document.visibilityState !== 'hidden');
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [callback]);
};

// Расширяем тип ответа API
interface ExtendedSaveResponse extends Omit<SaveGameResponse, 'error'> {
  error?: string | null | undefined;
  isBatched?: boolean;
  batchId?: string;
  totalRequests?: number;
}

// Используем реальный API, если он доступен, иначе заглушку
const apiClient = typeof api !== 'undefined' ? api : {
  saveGameProgress: async (gameState: any, options: any): Promise<ExtendedSaveResponse> => ({
    success: true
  })
};

// Заглушка для useToast, если компонент недоступен
const useToastFallback = () => ({
  toast: ({ title, description }: { title: string, description: string }) => {
    // console.log(`[Toast] ${title}: ${description}`);
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
  lastSavedVersion: number;
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
  saveInterval?: number; // Интервал в мс
}

// Интерфейс для дочерних элементов с функцией сохранения
interface ChildProps {
  saveGame?: SaveGameFunction;
  [key: string]: any;
}

// Функция для категоризации ошибок
const categorizeError = (errorMessage: string) => {
  if (
    errorMessage.includes('storage') || 
    errorMessage.includes('quota') || 
    errorMessage.includes('Storage')
  ) {
    return 'storage';
  }
  
  if (
    errorMessage.includes('rate limit') || 
    errorMessage.includes('too many requests') || 
    errorMessage.includes('TOO_MANY_REQUESTS')
  ) {
    return 'rate_limit';
  }
  
  if (
    errorMessage.includes('TOKEN_MISSING') ||
    errorMessage.includes('INVALID_FID') ||
    errorMessage.includes('Authorization')
  ) {
    return 'auth';
  }
  
  if (
    errorMessage.includes('DB_ERROR') ||
    errorMessage.includes('Database') || 
    errorMessage.includes('database') ||
    errorMessage.includes('prisma')
  ) {
    return 'database';
  }
  
  if (
    errorMessage.includes('Redis') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('6379')
  ) {
    return 'redis';
  }
  
  return 'unknown';
};

const GameSaverService: React.FC<GameSaverProps> = memo(
  ({ children, onSaveComplete, saveInterval = 5000 }) => {
    // Используем переменную для предотвращения логов при повторных рендерах
    const isFirstRenderRef = useRef(true);
    
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
    }
    
    const gameState = useGameState();
    const dispatch = useGameDispatch();
    const { toast } = useToastHook();
    const { sdkUser, sdkStatus } = useFarcaster();
    
    const saveStatusRef = useRef<SaveStatus>({
      lastSaveTime: 0,
      isSaving: false,
      error: null,
      pendingSave: false,
      saveCount: 0,
      batchedSaves: 0,
      lastBatchId: null,
      backoff: INITIAL_BACKOFF,
      storageIssue: false,
      lastSavedVersion: 0
    });
    
    const [saveStatus, setSaveStatus] = useState<SaveStatus>(saveStatusRef.current);
    
    // Таймеры и Refs
    const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const storageCleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Ref для доступа к последнему состоянию gameState без добавления его в зависимости useCallback
    const gameStateRef = useRef(gameState);
    
    // Обновляем gameStateRef при каждом изменении gameState
    useEffect(() => {
      gameStateRef.current = gameState;
    }, [gameState]);
    
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
        
        // console.log('[GameSaverService] Очистка локального хранилища от старых данных');
        
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
              // console.log(`[GameSaverService] Удалена старая резервная копия: ${key}`);
              localStorage.removeItem(key);
            }
          }
        }
        
        // Анализ оставшегося места в хранилище
        const storageUsed = calculateLocalStorageSize();
        const storageLimit = 5 * 1024 * 1024; // Примерный лимит ~5MB
        
        // Экстренная очистка
        if (storageUsed > storageLimit * 0.8) {
          // console.warn('[GameSaverService] Критически мало места в хранилище. Экстренная очистка.'); // Оставляем warn, но можно убрать если мешает
          if (backupKeys.length > 1) {
            const latestBackup = backupKeys[backupKeys.length - 1];
            for (let i = 0; i < backupKeys.length - 1; i++) {
              const key = backupKeys[i];
              if (key) {
                localStorage.removeItem(key);
              }
            }
            // console.log(`[GameSaverService] Оставлена только последняя копия: ${latestBackup}`);
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
        console.error('[GameSaverService] Ошибка при очистке хранилища:', error);
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

    // Проверка готовности Farcaster для сохранения
    const getFarcasterAuthInfo = useCallback(() => {
      // Если SDK не готов, пробуем использовать данные из localStorage
      if (sdkStatus !== 'ready') {
        try {
          // Проверяем наличие сохраненных данных Farcaster
          const farcasterDataStr = localStorage.getItem('FARCASTER_USER');
          if (farcasterDataStr) {
            const farcasterData = JSON.parse(farcasterDataStr);
            const localFid = farcasterData.fid;
            
            if (localFid && !isNaN(Number(localFid))) {
              return { 
                fid: String(localFid), 
                username: farcasterData.username || 'unknown',
                source: 'localStorage'
              };
            }
          }
        } catch (error) {
          // Ошибка при получении данных
        }
        
        return null;
      }
      
      if (!sdkUser) {
        return null;
      }
      
      // Проверяем наличие FID
      const fid = sdkUser.fid;
      if (!fid) {
        return null;
      }
      
      if (isNaN(Number(fid))) {
        return null;
      }
      
      // Сохраняем данные в localStorage для использования в случае недоступности SDK
      try {
        localStorage.setItem('FARCASTER_USER', JSON.stringify({
          fid: String(fid),
          username: sdkUser.username || 'unknown',
          displayName: sdkUser.displayName || null,
          timestamp: Date.now()
        }));
      } catch (e) {
        // Игнорируем ошибки при сохранении
      }
      
      // FID валиден - возвращаем
      return { 
        fid: String(fid), 
        username: sdkUser.username || 'unknown',
        source: 'sdk'
      };
    }, [sdkUser, sdkStatus]);

    // Функция сохранения игры
    const saveGame = useCallback(async (options: { 
      reason?: string;
      isCritical?: boolean;
      force?: boolean;
      silent?: boolean;
    } = {}) => {
      const { reason = 'auto', isCritical = false, force = false, silent = false } = options;
      const status = saveStatusRef.current;
      
      // Получаем текущее состояние из рефа
      const currentGameState = gameStateRef.current;
      
      // Проверяем, можно ли сейчас сохранять
      const now = Date.now();
      const timeSinceLastSave = now - status.lastSaveTime;
      const isAutoSave = reason === 'auto';
      const minInterval = isAutoSave ? AUTO_SAVE_INTERVAL : MIN_SAVE_INTERVAL;
      
      console.log(`>>> saveGame Check 1: isAutoSave=${isAutoSave}, currentSaveVersion=${currentGameState._saveVersion}, lastSavedVersion=${status.lastSavedVersion}, force=${force}`);
      // Проверяем, изменилось ли состояние с момента последнего сохранения
      const currentSaveVersion = currentGameState._saveVersion || 0;
      const lastSavedVersion = status.lastSavedVersion;
      
      // Если версия не изменилась и это автосохранение, пропускаем
      if (isAutoSave && currentSaveVersion === lastSavedVersion && !force) {
        return false;
      }
      
      console.log(`>>> saveGame Check 2: status.isSaving=${status.isSaving}`);
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
      
      console.log(`>>> saveGame Check 3: force=${force}, timeSinceLastSave=${timeSinceLastSave}, minInterval=${minInterval}`);
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
        saveCount: status.saveCount + 1,
        lastSavedVersion: currentSaveVersion
      });
      
      try {
        console.log('>>> performSave: START');
        const userId = currentGameState._userId;
        if (!userId) {
          // log('Skipping save: No User ID in state'); // Уже закомментировано
          if (!silent) {
            updateSaveStatus({ error: 'User ID missing' });
          }
          return false;
        }
        
        // Обновляем версию сохранения и сопутствующие данные
        const saveData = {
          ...currentGameState,
          _saveVersion: currentSaveVersion + 1,
          _lastSaved: new Date().toISOString(),
          _saveReason: reason
        };
        
        // Обновляем состояние игры с новой версией
        dispatch({ type: "LOAD_GAME_STATE", payload: saveData });
        
        // Создаем локальную резервную копию перед отправкой на сервер
        if ((typeof window !== 'undefined') && window.localStorage && 
            (isCritical || !isAutoSave || (status.saveCount % 5 === 0))) {
          try {
            const backupKey = `${BACKUP_PREFIX}${userId}_${Date.now()}`;
            const minimalBackup = createMinimalBackup(saveData, userId);
            localStorage.setItem(backupKey, JSON.stringify(minimalBackup));
            // console.log(`[GameSaverService] Создана компактная резервная копия: ${backupKey}`);
            setTimeout(cleanupLocalStorage, 100);
            
            // Создаем основную копию в localStorage для каждого сохранения
            localStorage.setItem(`gameState_${userId}`, JSON.stringify(saveData));
            localStorage.setItem(`gameState_${userId}_lastSaved`, new Date().toISOString());
          } catch (storageError) {
            console.error('[GameSaverService] Ошибка при создании резервной копии:', storageError);
            if (storageError instanceof DOMException && 
               (storageError.name === 'QuotaExceededError' || storageError.code === 22)) {
              cleanupLocalStorage();
            }
          }
        }
        
        console.log('>>> performSave: CALLING apiClient.saveGameProgress');
        
        // Получаем Farcaster авторизацию с расширенными проверками
        const farcasterAuth = getFarcasterAuthInfo();
        
        // Используем FID из Farcaster если он доступен, иначе пробуем использовать userId
        const fid = farcasterAuth?.fid || (userId && /^\d+$/.test(userId) ? userId : null);
        
        if (!fid) {
          throw new Error('TOKEN_MISSING');
        }
        
        // Больше логирования для отладки
        console.log(`🔒 [AUTH] Используем Farcaster FID для сохранения: ${fid} (sdkUser?.fid=${sdkUser?.fid}, userId=${userId})`);
        
        // Проверка на некорректный FID
        if (isNaN(Number(fid))) {
          throw new Error('INVALID_FID_FORMAT');
        }
        
        // Дополнительная информация о пользователе для отладки
        if (farcasterAuth) {
          console.log(`🔒 [AUTH] Авторизован через Farcaster: FID=${farcasterAuth.fid}, username=${farcasterAuth.username}`);
        }
        
        // Убедимся, что userId установлен в saveData
        if (!saveData._userId && fid) {
          saveData._userId = String(fid);
        }
        
        const response = await apiClient.saveGameProgress(saveData, {
          isCritical,
          reason
        }) as ExtendedSaveResponse;
        
        if (response.success) {
          console.log('>>> performSave: SUCCESS');
          
          // Сбрасываем backoff при успешном сохранении
          const newSaveStatus: Partial<SaveStatus> = {
            lastSaveTime: now,
            isSaving: false,
            error: null,
            backoff: INITIAL_BACKOFF,
            lastSavedVersion: currentSaveVersion
          };
          
          // Если это был пакетный запрос (batched), обновляем счетчик
          if (response?.isBatched) {
            newSaveStatus.batchedSaves = (status.batchedSaves || 0) + 1;
            newSaveStatus.lastBatchId = response?.batchId || null;
          }
          
          updateSaveStatus(newSaveStatus);
          
          // Показываем уведомление об успешном сохранении, если не тихий режим
          if (!silent && !isAutoSave) {
            toast({
              title: "Прогресс сохранен",
              description: response?.isBatched 
                ? `Объединено с ${response?.totalRequests || 0} запросами (ID: ${response?.batchId || 'unknown'})` 
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
        console.error('>>> performSave: FAILED', error);
        
        // Определяем тип ошибки
        const errorType = categorizeError(errorMessage);
        
        // Обработка ошибки
        const isTooManyRequests = errorType === 'rate_limit';
        const isStorageError = errorType === 'storage';
        const isRedisError = errorType === 'redis';
        
        // Увеличиваем backoff только для сетевых ошибок и ошибок сервера
        let newBackoff = status.backoff;
        if (!isTooManyRequests) {
          // Экспоненциальный backoff при серверных ошибках
          newBackoff = Math.min(status.backoff * 1.5, MAX_BACKOFF);
        }
        
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
                : isRedisError
                  ? "Проблема с сервером кэширования. Прогресс сохранен локально."
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
         updateSaveStatus({ isSaving: false });
      }
    }, [dispatch, toast, updateSaveStatus, onSaveComplete, cleanupLocalStorage, createMinimalBackup, getFarcasterAuthInfo]);
  
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
  
    // Используем useRef для создания debounced функции только один раз, чтобы она была стабильной
    const debouncedSaveRef = useRef(debounce(saveGame, saveInterval));

    // Ref для отслеживания первого вызова эффекта при изменении gameState
    const isFirstSaveEffectRef = useRef(true);
    const prevUserIdRef = useRef<string | undefined>(undefined);
    const isFirstVisibilityChangeRef = useRef(true);

    // Effect to trigger save on state change
    useEffect(() => {
      const userId = gameState._userId;
      
      // Пропускаем первый вызов эффекта или если userId изменился
      if (isFirstSaveEffectRef.current || prevUserIdRef.current !== userId) {
        console.log('🔍 [GameSaverService] Пропускаем первый вызов useEffect для gameState или новый userId:', userId);
        isFirstSaveEffectRef.current = false;
        prevUserIdRef.current = userId;
        return;
      }
      
      if (userId) {
        console.log(`>>> useEffect[gameState]: Triggered! Save Version: ${gameState._saveVersion}`);
        console.log('🔍 [GameSaverService] Вызываем debouncedSave, userId:', userId);
        // Вызываем функцию из рефа
        debouncedSaveRef.current({ reason: 'auto', silent: true }); 
      }
      
      return () => {
        debouncedSaveRef.current.cancel();
      };
    }, [gameState._saveVersion, gameState._userId]);

    // Force save on visibility change (page hidden)
    const handleVisibilityChange = useCallback((isVisible: boolean) => {
      if (!isVisible && !isFirstVisibilityChangeRef.current) {
        // Если страница скрыта и это не первый вызов
        if (!saveStatusRef.current.isSaving && gameState._userId) {
          // Принудительное сохранение через непосредственный вызов saveGame
          console.log('💾 Страница скрыта, выполняем принудительное сохранение');
          
          // Отменяем все отложенные вызовы debouncedSave
          debouncedSaveRef.current.cancel();
          
          // Используем setTimeout, чтобы вызов не происходил во время рендеринга
          setTimeout(() => {
            saveGame({ reason: 'visibility_change', force: true, silent: true });
          }, 0);
        }
      }
      
      if (isFirstVisibilityChangeRef.current) {
        isFirstVisibilityChangeRef.current = false;
      }
    }, [saveGame, gameState]);

    // Используем хук для отслеживания видимости страницы
    useVisibilityChange(handleVisibilityChange);

    // Функция сохранения для передачи дочерним элементам
    const exposedSaveGame: SaveGameFunction = useCallback(async (options = {}) => {
      // log("External save requested", options);
      return saveGame(options);
    }, [saveGame]);

    return (
      <div className="game-saver-service">
        {/* Рендерим дочерние компоненты с функцией сохранения */}
        {childrenWithProps}
      </div>
    );
  }
);

GameSaverService.displayName = 'GameSaverService';

export default GameSaverService; 