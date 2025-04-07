/**
 * Хук для принудительного сохранения игрового состояния
 * с гарантией успешного обновления перед сохранением
 */

import { useCallback, useRef } from 'react';
import { useGameState } from '../contexts/game/hooks';
import { secureLocalSave } from '../utils/localSaveProtection';
import { safeSetItem } from '../services/localStorageManager';

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
  const savePendingRef = useRef(false);
  const saveAttemptRef = useRef(0);
  const lastSavedStateRef = useRef<any>(null);

  /**
   * Принудительно сохраняет текущее состояние игры с задержкой
   * для гарантии завершения всех обновлений состояния
   * @param delay Задержка перед сохранением в мс (по умолчанию 600мс)
   * @param retryCount Текущая попытка сохранения (для внутреннего использования)
   * @returns Promise, который разрешается после сохранения
   */
  const forceSave = useCallback((delay: number = 600, retryCount: number = 0): Promise<boolean> => {
    // Если сохранение уже в процессе и это не повторная попытка, возвращаем существующий промис
    if (savePendingRef.current && retryCount === 0) {
      console.log('[useForceSave] Сохранение уже в процессе, пропускаем');
      return Promise.resolve(false);
    }

    // Увеличиваем счетчик попыток для текущей сессии
    saveAttemptRef.current++;
    const currentAttempt = saveAttemptRef.current;
    
    // Для повторных попыток используем более короткую задержку
    const actualDelay = retryCount > 0 ? 350 : delay;
    
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
            console.error('[useForceSave] Отсутствует ID пользователя, сохранение невозможно');
            savePendingRef.current = false;
            resolve(false);
            return;
          }
          
          // Проверяем, изменилось ли значение снота с момента запуска сохранения
          // Это может указывать на то, что сбор произошел, но состояние не успело обновиться
          if (retryCount === 0 && 
              currentSnotValue !== gameState.inventory?.snot) {
            console.log('[useForceSave] Обнаружено изменение snot во время ожидания сохранения:', {
              было: currentSnotValue,
              стало: gameState.inventory?.snot
            });
            
            // Дополнительная задержка, чтобы дать состоянию полностью обновиться
            setTimeout(() => {
              resolve(forceSave(300, retryCount));
            }, 250);
            return;
          }
          
          // Создаем экстренное сохранение перед основным (как дополнительную страховку)
          try {
            // Сохраняем только ключевые данные, чтобы не перегружать localStorage
            const emergencyData = {
              userId: userId,
              timestamp: Date.now(),
              inventory: {
                snot: gameState.inventory?.snot,
                snotCoins: gameState.inventory?.snotCoins,
                containerSnot: gameState.inventory?.containerSnot,
              },
              _lastSaved: new Date().toISOString(),
              _attemptId: currentAttempt,
              _saveVersion: gameState._saveVersion || 1
            };
            
            // Сохраняем экстренную копию
            const emergencyKey = `${EMERGENCY_SAVE_PREFIX}${userId}_${Date.now()}`;
            safeSetItem(emergencyKey, JSON.stringify(emergencyData), true);
            
            // Сохраняем копию последнего успешного сохранения
            lastSavedStateRef.current = {
              snot: gameState.inventory?.snot,
              containerSnot: gameState.inventory?.containerSnot,
              timestamp: Date.now()
            };
            
            console.log(`[useForceSave] Создана экстренная копия данных:`, {
              key: emergencyKey,
              snot: gameState.inventory?.snot
            });
          } catch (emergencyError) {
            console.warn('[useForceSave] Ошибка при создании экстренного сохранения:', emergencyError);
            // Продолжаем выполнение даже при ошибке экстренного сохранения
          }
          
          // Логируем состояние для отладки
          console.log(`[useForceSave] Попытка #${retryCount + 1} сохранения игрового состояния:`, {
            userId,
            snot: gameState.inventory?.snot,
            containerSnot: gameState.inventory?.containerSnot,
            timestamp: new Date().toISOString(),
            attemptId: currentAttempt
          });
          
          // Сохраняем состояние в защищенное локальное хранилище
          const saved = secureLocalSave(userId, gameState);
          
          if (saved) {
            console.log(`[useForceSave] Состояние успешно сохранено (попытка #${retryCount + 1})`);
            
            // Проверяем валидность значений после сохранения
            if (typeof gameState.inventory?.snot !== 'number' || 
                isNaN(gameState.inventory?.snot)) {
              console.warn(`[useForceSave] Обнаружены некорректные значения после сохранения`, {
                snot: gameState.inventory?.snot,
                type: typeof gameState.inventory?.snot
              });
              
              // Выполняем дополнительную попытку при некорректных значениях
              if (retryCount < MAX_RETRY_ATTEMPTS) {
                console.log(`[useForceSave] Принудительная повторная попытка из-за некорректных значений`);
                setTimeout(() => {
                  resolve(forceSave(300, retryCount + 1));
                }, 800);
                return;
              }
            }
            
            savePendingRef.current = false;
            resolve(true);
          } else {
            console.warn(`[useForceSave] Ошибка при сохранении состояния (попытка #${retryCount + 1})`);
            
            // Если не достигли максимального числа повторных попыток, пробуем снова
            if (retryCount < MAX_RETRY_ATTEMPTS) {
              console.log(`[useForceSave] Повторная попытка #${retryCount + 2} через 350мс...`);
              // Увеличиваем задержку для следующей попытки
              resolve(forceSave(350, retryCount + 1));
            } else {
              console.error(`[useForceSave] Достигнуто максимальное количество попыток (${MAX_RETRY_ATTEMPTS + 1})`);
              savePendingRef.current = false;
              resolve(false);
            }
          }
        } catch (error) {
          console.error(`[useForceSave] Ошибка при сохранении (попытка #${retryCount + 1}):`, error);
          
          // Если не достигли максимального числа повторных попыток, пробуем снова
          if (retryCount < MAX_RETRY_ATTEMPTS) {
            console.log(`[useForceSave] Повторная попытка #${retryCount + 2} после ошибки через 350мс...`);
            resolve(forceSave(350, retryCount + 1));
          } else {
            savePendingRef.current = false;
            resolve(false);
          }
        }
      }, actualDelay);
    });
  }, [gameState]);

  return forceSave;
} 