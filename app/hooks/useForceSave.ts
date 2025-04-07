/**
 * Хук для принудительного сохранения игрового состояния
 * с гарантией успешного обновления перед сохранением
 */

import { useCallback, useRef } from 'react';
import { useGameState } from '../contexts/game/hooks';
import { useSaveManager } from '../contexts/SaveManagerProvider';
import { safeSetItem } from '../services/localStorageManager';
import { SavePriority } from '../services/saveSystem/types';

// Максимальное количество повторных попыток при ошибке сохранения
const MAX_RETRY_ATTEMPTS = 2;
// Префикс для экстренных сохранений
const EMERGENCY_SAVE_PREFIX = 'emergency_save_';

/**
 * Хук для принудительного сохранения состояния игры после определенных действий
 * @returns Функцию для вызова сохранения
 */
export function useForceSave() {
  const gameState = useGameState();
  const saveManager = useSaveManager();
  const savePendingRef = useRef(false);
  const saveAttemptRef = useRef(0);
  const lastSavedStateRef = useRef<null | { snot: number; containerSnot: number; timestamp: number }>(null);
  
  /**
   * Принудительно сохраняет текущее состояние игры с задержкой
   * для гарантии завершения всех обновлений состояния
   * @param delay Задержка перед сохранением в мс (по умолчанию 200мс)
   * @param retryCount Текущая попытка сохранения (для внутреннего использования)
   * @returns Promise, который разрешается после сохранения
   */
  const forceSave = useCallback((delay: number = 200, retryCount: number = 0): Promise<boolean> => {
    // Если сохранение уже в процессе и это не повторная попытка, возвращаем существующий промис
    if (savePendingRef.current && retryCount === 0) {
      return Promise.resolve(false);
    }

    // Увеличиваем счетчик попыток для текущей сессии
    saveAttemptRef.current++;
    const currentAttempt = saveAttemptRef.current;
    
    // Для повторных попыток используем более короткую задержку
    const actualDelay = retryCount > 0 ? 150 : delay;
    
    // Указываем, что сохранение в процессе
    savePendingRef.current = true;
    
    // Сохраняем копию текущих значений снота для сравнения
    const currentSnotValue = gameState.inventory?.snot;
    const currentContainerSnot = gameState.inventory?.containerSnot;

    return new Promise((resolve) => {
      // Запускаем сохранение с задержкой для гарантии
      // завершения всех обновлений состояния
      setTimeout(() => {
        try {
          // Получаем актуальное состояние игры
          const userId = gameState._userId;
          
          if (!userId) {
            savePendingRef.current = false;
            resolve(false);
            return;
          }
          
          // Проверяем, изменилось ли значение снота с момента запуска сохранения
          // Это может указывать на то, что сбор произошел, но состояние не успело обновиться
          if (retryCount === 0 && 
              currentSnotValue !== gameState.inventory?.snot) {
            // Дополнительная задержка, чтобы дать состоянию полностью обновиться
            setTimeout(() => {
              resolve(forceSave(300, retryCount));
            }, 250);
            return;
          }
          
          // Создаем экстренное сохранение перед основным (как дополнительную страховку)
          try {
            // Создаем экстренное сохранение через SaveManager
            saveManager.createEmergencyBackup(userId, gameState);
            
            // Сохраняем копию последнего успешного сохранения
            lastSavedStateRef.current = {
              snot: gameState.inventory?.snot,
              containerSnot: gameState.inventory?.containerSnot,
              timestamp: Date.now()
            };
          } catch (emergencyError) {
            // Продолжаем выполнение даже при ошибке экстренного сохранения
          }
          
          // Сохраняем состояние с помощью SaveManager
          saveManager.save(userId, gameState)
            .then(result => {
              // Проверяем результат сохранения
              if (result.success) {
                // Проверяем валидность значений после сохранения
                if (typeof gameState.inventory?.snot !== 'number' || 
                    isNaN(gameState.inventory?.snot)) {
                  // Выполняем дополнительную попытку при некорректных значениях
                  if (retryCount < MAX_RETRY_ATTEMPTS) {
                    setTimeout(() => {
                      resolve(forceSave(300, retryCount + 1));
                    }, 800);
                    return;
                  }
                }
                
                savePendingRef.current = false;
                resolve(true);
              } else {
                // Если не достигли максимального числа повторных попыток, пробуем снова
                if (retryCount < MAX_RETRY_ATTEMPTS) {
                  // Увеличиваем задержку для следующей попытки
                  resolve(forceSave(350, retryCount + 1));
                } else {
                  savePendingRef.current = false;
                  resolve(false);
                }
              }
            })
            .catch(error => {
              // Если не достигли максимального числа повторных попыток, пробуем снова
              if (retryCount < MAX_RETRY_ATTEMPTS) {
                resolve(forceSave(350, retryCount + 1));
              } else {
                savePendingRef.current = false;
                resolve(false);
              }
            });
        } catch (error) {
          // Если не достигли максимального числа повторных попыток, пробуем снова
          if (retryCount < MAX_RETRY_ATTEMPTS) {
            resolve(forceSave(350, retryCount + 1));
          } else {
            savePendingRef.current = false;
            resolve(false);
          }
        }
      }, actualDelay);
    });
  }, [gameState, saveManager]);

  return forceSave;
} 