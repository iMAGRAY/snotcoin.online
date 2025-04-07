import { useEffect, useRef, useCallback } from 'react';
import { useGameState, useGameDispatch } from '../contexts/game/hooks';
import { getSafeInventory } from '../utils/resourceUtils';
import { 
  secureLocalSave, 
  secureLocalLoad, 
  needsServerSync, 
  updateSyncMetadata 
} from '../utils/localSaveProtection';
import { ActionType } from '../reducers/gameReducer';

// Настройки для интервалов синхронизации
const SERVER_SYNC_INTERVAL = 5 * 60 * 1000; // 5 минут
const LOCAL_SAVE_INTERVAL = 30 * 1000; // 30 секунд
const ENERGY_CHECK_INTERVAL = 10 * 1000; // 10 секунд

// Значения по умолчанию
const DEFAULT_MAX_ENERGY = 500;
const DEFAULT_RESTORATION_RATE = 1; // единиц энергии в минуту
const DEFAULT_CHECK_INTERVAL = 10000; // 10 секунд

/**
 * Рассчитывает восстановленную энергию за период времени
 * @param currentEnergy Текущая энергия
 * @param maxEnergy Максимальная энергия
 * @param lastUpdateTime Время последнего обновления энергии
 * @param hoursToFullRestore Количество часов для полного восстановления
 * @param currentTime Текущее время
 * @returns Новое значение энергии
 */
export function calculateRestoredEnergy(
  currentEnergy: number,
  maxEnergy: number,
  lastUpdateTime: number,
  hoursToFullRestore: number,
  currentTime: number = Date.now()
): number {
  // Проверяем валидность входных данных
  if (!lastUpdateTime || currentTime <= lastUpdateTime || currentEnergy >= maxEnergy) {
    return currentEnergy;
  }
  
  // Рассчитываем прошедшее время в секундах
  const elapsedSeconds = (currentTime - lastUpdateTime) / 1000;
  
  // Скорость восстановления энергии (единиц в секунду)
  const energyPerSecond = maxEnergy / (hoursToFullRestore * 60 * 60);
  
  // Количество восстановленной энергии за прошедшее время
  const recoveredEnergy = elapsedSeconds * energyPerSecond;
  
  // Новое значение энергии (не больше максимума)
  const newEnergy = Math.min(maxEnergy, currentEnergy + recoveredEnergy);
  
  console.log(`[useEnergyRestoration] Расчет восстановленной энергии:`, {
    прошлоСекунд: elapsedSeconds,
    прошлоМинут: (elapsedSeconds / 60).toFixed(2),
    было: currentEnergy,
    восстановлено: recoveredEnergy.toFixed(2),
    стало: newEnergy.toFixed(2),
    максимум: maxEnergy,
    скоростьВосстановления: `${(energyPerSecond * 3600).toFixed(2)} в час`
  });
  
  return newEnergy;
}

/**
 * Хук для автоматического восстановления энергии с течением времени
 * @param {number} maxEnergy - Максимальное значение энергии
 * @param {number} energyRestorationRate - Скорость восстановления энергии (единиц в минуту)
 * @param {number} checkInterval - Интервал проверки и обновления энергии в миллисекундах
 */
export function useEnergyRestoration(
  maxEnergy = DEFAULT_MAX_ENERGY,
  energyRestorationRate = DEFAULT_RESTORATION_RATE,
  checkInterval = DEFAULT_CHECK_INTERVAL
) {
  const gameState = useGameState();
  const dispatch = useGameDispatch();
  const lastCheckRef = useRef<number>(Date.now());
  
  // Получаем текущую энергию и время последнего обновления из состояния
  const inventory = getSafeInventory(gameState);
  const currentEnergy = inventory.energy ?? 0;
  const lastEnergyUpdateTime = inventory.lastEnergyUpdateTime ?? Date.now();
  
  // Рассчитываем энергию с учетом прошедшего времени с большей точностью
  const calculateRestoredEnergy = useCallback((currentEnergy: number, lastEnergyUpdateTime: number, maxValue: number): number => {
    if (currentEnergy >= maxValue) {
      return maxValue;
    }
    
    // Получаем текущее время
    const now = Date.now();
    
    // Рассчитываем прошедшее время в минутах с округлением до миллисекунд
    const elapsedMinutes = (now - lastEnergyUpdateTime) / (60 * 1000);
    
    // Рассчитываем количество восстановленной энергии (1 единица в минуту)
    // Используем более точное округление для предотвращения погрешностей
    const restoredAmount = Math.floor(elapsedMinutes * 100) / 100 * energyRestorationRate;
    
    // Вычисляем новое значение энергии с округлением до 2 знаков
    const newEnergy = Math.min(
      maxValue,
      Math.round((currentEnergy + restoredAmount) * 100) / 100
    );
    
    // Логируем расчет для отладки
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[useEnergyRestoration] Расчет восстановления энергии:`, {
        currentEnergy,
        elapsedMinutes: elapsedMinutes.toFixed(6),
        restoredAmount: restoredAmount.toFixed(2),
        newEnergy: newEnergy.toFixed(2),
        lastUpdate: new Date(lastEnergyUpdateTime).toISOString(),
        currentTime: new Date(now).toISOString()
      });
    }
    
    return newEnergy;
  }, [energyRestorationRate]);
  
  // Рассчитываем время до полного восстановления
  const timeToFullRestore = useCallback(() => {
    if (currentEnergy >= maxEnergy) return 0;
    
    // Рассчитываем оставшуюся энергию для восстановления
    const energyToRestore = maxEnergy - currentEnergy;
    
    // Рассчитываем время в минутах
    const minutesToFull = energyToRestore / energyRestorationRate;
    
    // Конвертируем в миллисекунды
    return Math.ceil(minutesToFull * 60 * 1000);
  }, [currentEnergy, maxEnergy, energyRestorationRate]);
  
  // Рассчитываем часы до полного восстановления
  const hoursToFullRestore = useCallback(() => {
    const millisToFull = timeToFullRestore();
    return millisToFull / (1000 * 60 * 60);
  }, [timeToFullRestore]);
  
  // Форматирование времени до полного восстановления
  const formatTimeToFull = useCallback(() => {
    const millisToFull = timeToFullRestore();
    
    if (millisToFull <= 0) return null;
    
    const seconds = Math.floor(millisToFull / 1000) % 60;
    const minutes = Math.floor(millisToFull / (1000 * 60)) % 60;
    const hours = Math.floor(millisToFull / (1000 * 60 * 60));
    
    // Если осталось меньше минуты
    if (hours === 0 && minutes === 0) {
      return `${seconds}с`;
    }
    
    // Если осталось меньше часа
    if (hours === 0) {
      return `${minutes}м ${seconds}с`;
    }
    
    // Если осталось больше часа
    return `${hours}ч ${minutes}м`;
  }, [timeToFullRestore]);
  
  // Добавляем функцию для сохранения текущего состояния энергии
  const saveEnergyState = useCallback((energyValue: number, lastUpdateTime: number) => {
    try {
      // Получаем текущее состояние игры
      const userId = gameState._userId;
      if (!userId) return; // Выходим, если ID пользователя не определен

      // Загружаем текущее состояние из localStorage
      const currentState = secureLocalLoad(userId);
      if (!currentState) return; // Выходим, если состояние не найдено

      // Обновляем энергию и время последнего обновления
      const updatedState = {
        ...currentState,
        inventory: {
          ...currentState.inventory,
          energy: energyValue,
          lastEnergyUpdateTime: lastUpdateTime
        }
      };

      // Сохраняем обновленное состояние в localStorage
      secureLocalSave(userId, updatedState);
      
      console.log('[useEnergyRestoration] Состояние энергии сохранено локально:', {
        энергия: energyValue,
        времяОбновления: new Date(lastUpdateTime).toISOString()
      });
    } catch (error) {
      console.error('[useEnergyRestoration] Ошибка при сохранении состояния энергии:', error);
    }
  }, [gameState._userId]);
  
  // Обновление энергии
  useEffect(() => {
    // Проверяем, нужно ли обновлять энергию
    if (currentEnergy >= maxEnergy) {
      // Если энергия полная, просто обновляем время последнего обновления
      if (lastEnergyUpdateTime < Date.now() - 60000) { // более 1 минуты назад
        dispatch({
          type: 'UPDATE_ENERGY_TIMESTAMP',
          payload: { timestamp: Date.now() }
        });
        
        // Сохраняем обновленное состояние с полной энергией
        saveEnergyState(maxEnergy, Date.now());
      }
      return;
    }
    
    // Рассчитываем новую энергию
    const newEnergy = calculateRestoredEnergy(currentEnergy, lastEnergyUpdateTime, maxEnergy);
    
    // Если энергия изменилась, обновляем состояние и сохраняем локально
    if (newEnergy > currentEnergy) {
      // Обновляем timestamp только если энергия восстановлена полностью
      const shouldUpdateTimestamp = newEnergy >= maxEnergy;
      const timestampToUse = shouldUpdateTimestamp ? Date.now() : lastEnergyUpdateTime;
      
      dispatch({
        type: 'RESTORE_ENERGY',
        payload: {
          energy: newEnergy,
          timestamp: timestampToUse,
          forceUpdateTimestamp: shouldUpdateTimestamp
        }
      });
      
      // Сохраняем состояние энергии локально
      saveEnergyState(newEnergy, timestampToUse);
    } else {
      // Даже если энергия не изменилась, всё равно сохраняем текущее состояние, 
      // чтобы гарантировать, что оно будет доступно при следующем входе
      saveEnergyState(currentEnergy, lastEnergyUpdateTime);
    }
    
    // Устанавливаем интервал для периодической проверки и обновления
    const intervalId = setInterval(() => {
      const now = Date.now();
      // Проверяем, прошло ли достаточно времени с последней проверки
      if (now - lastCheckRef.current >= checkInterval) {
        lastCheckRef.current = now;
        
        // Получаем текущую энергию из состояния
        const inventory = getSafeInventory(gameState);
        const currentEnergy = inventory.energy ?? 0;
        const lastEnergyUpdateTime = inventory.lastEnergyUpdateTime ?? now;
        
        // Если энергия уже полная, пропускаем обновление
        if (currentEnergy >= maxEnergy) {
          // Сохраняем обновленное состояние с полной энергией
          saveEnergyState(maxEnergy, lastEnergyUpdateTime);
          return;
        }
        
        // Рассчитываем новую энергию
        const newEnergy = calculateRestoredEnergy(currentEnergy, lastEnergyUpdateTime, maxEnergy);
        
        // Если энергия изменилась, обновляем состояние и сохраняем локально
        if (newEnergy > currentEnergy) {
          // Обновляем timestamp только если энергия восстановлена полностью
          const shouldUpdateTimestamp = newEnergy >= maxEnergy;
          const timestampToUse = shouldUpdateTimestamp ? now : lastEnergyUpdateTime;
          
          dispatch({
            type: 'RESTORE_ENERGY',
            payload: {
              energy: newEnergy,
              timestamp: timestampToUse,
              forceUpdateTimestamp: shouldUpdateTimestamp
            }
          });
          
          // Сохраняем состояние энергии локально
          saveEnergyState(newEnergy, timestampToUse);
        } else {
          // Даже если энергия не изменилась, всё равно сохраняем текущее состояние,
          // чтобы гарантировать, что оно будет доступно при следующем входе
          saveEnergyState(currentEnergy, lastEnergyUpdateTime);
        }
      }
    }, Math.min(checkInterval, 1000)); // Не реже чем раз в секунду
    
    // Очистка при размонтировании
    return () => {
      clearInterval(intervalId);
    };
  }, [currentEnergy, lastEnergyUpdateTime, dispatch, calculateRestoredEnergy, gameState, checkInterval, maxEnergy, saveEnergyState]);
  
  return {
    currentEnergy,
    maxEnergy,
    energyRestorationRate,
    lastEnergyUpdateTime,
    timeToFullRestore: timeToFullRestore(),
    hoursToFullRestore: hoursToFullRestore(),
    formattedTimeToFull: formatTimeToFull(),
    isFullyRestored: currentEnergy >= maxEnergy
  };
} 