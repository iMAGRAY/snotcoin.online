'use client';

import { useCallback, useContext, useState, useEffect } from 'react';
import { useResources } from '../contexts/ResourceContext';
import { GameContext } from '../contexts/game/GameContext';

/**
 * Расширенный хук для работы с контейнером снота
 * Добавляет обработку ошибок и fallback в случае проблем с контекстом
 */
export const useContainer = () => {
  const [isCollecting, setIsCollecting] = useState(false);
  const [lastCollectError, setLastCollectError] = useState<string | null>(null);
  const gameContext = useContext(GameContext);
  const resources = useResources();
  
  // Добавляем защиту от зависания сборки
  const [collectTimeout, setCollectTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Сбрасываем состояние сборки, если она "зависла"
  useEffect(() => {
    const MAX_COLLECT_TIME = 5000; // 5 секунд максимум для сбора
    
    // Если начали сбор, устанавливаем таймер для сброса
    if (isCollecting) {
      const timeout = setTimeout(() => {
        console.warn('[useContainer] Сбор ресурсов занял слишком много времени, сбрасываем состояние');
        setIsCollecting(false);
        setLastCollectError('Таймаут сборки ресурсов');
      }, MAX_COLLECT_TIME);
      
      setCollectTimeout(timeout);
      
      return () => {
        if (timeout) clearTimeout(timeout);
      };
    } else if (collectTimeout) {
      // Если сбор завершился, очищаем таймер
      clearTimeout(collectTimeout);
      setCollectTimeout(null);
    }
    
    return undefined;
  }, [isCollecting, collectTimeout]);
  
  // Проверка, что ресурсы правильно инициализированы
  useEffect(() => {
    if (resources) {
      // Убедимся, что resourceManager инициализирован
      try {
        const allResources = resources.getAllResources();
        console.log('[useContainer] Проверка инициализации ResourceManager:', {
          resourcesAvailable: !!resources,
          hasGetAll: !!resources.getAllResources,
          allResourcesLength: Object.keys(allResources).length,
          hasContainerSnot: 'containerSnot' in allResources,
          containerSnotValue: allResources.containerSnot
        });
        
        // Если ресурсы пустые, но есть данные в gameContext
        if (Object.keys(allResources).length === 0 && gameContext?.state?.inventory) {
          console.log('[useContainer] ResourceManager инициализирован, но ресурсы пустые - синхронизируем с игровым состоянием');
          resources.syncWithGameState();
        }
      } catch (error) {
        console.error('[useContainer] Ошибка при проверке инициализации ресурсов:', error);
      }
    }
  }, [resources, gameContext]);
  
  const containerSnot = resources?.getResource('containerSnot') ?? 0;
  const containerCapacity = resources?.getResource('containerCapacity') ?? 1;
  const fillingSpeed = resources?.getResource('fillingSpeed') ?? 0.01;
  
  /**
   * Метод для принудительного обновления контейнера без сохранения
   * @returns {boolean} - успешность операции
   */
  const forceUpdateContainer = useCallback(() => {
    try {
      if (!resources) {
        console.warn('[useContainer] forceUpdateContainer: ресурсы не инициализированы');
        return false;
      }
      
      // Получаем значение из ресурсов
      const containerSnot = resources.getResource('containerSnot');
      
      // Если контейнер пуст, нет смысла обновлять
      if (containerSnot <= 0) {
        console.debug('[useContainer] forceUpdateContainer: контейнер пуст, обновление не требуется');
        return true;
      }
      
      // Если есть GameContext, обновляем значение в контексте
      if (gameContext?.dispatch && gameContext.state) {
        try {
          console.debug('[useContainer] Обновляем контейнер в GameContext:', containerSnot);
          gameContext.dispatch({
            type: 'UPDATE_INVENTORY',
            payload: {
              containerSnot
            }
          });
        } catch (updateError) {
          console.error('[useContainer] Ошибка при обновлении контейнера в GameContext:', updateError);
        }
      }
      
      return true;
    } catch (error) {
      console.error('[useContainer] Ошибка при принудительном обновлении контейнера:', error);
      return false;
    }
  }, [resources, gameContext]);
  
  // Добавляем проверку значений ресурсов перед отображением
  useEffect(() => {
    // Проверяем корректность значений
    if (Number.isNaN(containerSnot) || containerSnot < 0) {
      console.warn('[useContainer] Обнаружено некорректное значение containerSnot:', containerSnot);
      
      // Если есть gameContext, пытаемся исправить значение
      if (gameContext?.state?.inventory && gameContext.dispatch) {
        const correctValue = Math.max(0, gameContext.state.inventory.containerSnot || 0);
        console.log(`[useContainer] Пытаемся исправить значение containerSnot: ${containerSnot} -> ${correctValue}`);
        
        if (resources) {
          try {
            resources.setResource('containerSnot', correctValue);
          } catch (e) {
            console.error('[useContainer] Не удалось исправить containerSnot через resources:', e);
          }
        }
        
        gameContext.dispatch({
          type: 'UPDATE_INVENTORY',
          payload: {
            containerSnot: correctValue
          }
        });
      }
    }
  }, [containerSnot, gameContext, resources]);
  
  /**
   * Безопасная функция для расчета процента заполнения с проверкой на ошибки
   */
  const getFillingPercentage = useCallback(() => {
    if (!resources) return 0;
    
    try {
      return resources.getContainerFillingPercentage();
    } catch (error) {
      console.warn('[useContainer] Ошибка при расчете процента заполнения:', error);
      // Fallback: рассчитываем вручную
      const snot = containerSnot || 0;
      const capacity = containerCapacity || 1;
      return Math.min(100, Math.max(0, (snot / capacity) * 100));
    }
  }, [resources, containerSnot, containerCapacity]);
  
  /**
   * Безопасная функция сбора с дополнительными проверками и fallback в случае ошибок
   */
  const collectSafely = useCallback(async (externalContainerSnot?: number) => {
    // Если уже происходит сбор, предотвращаем повторное выполнение
    if (isCollecting) {
      console.warn('[useContainer] Сбор уже выполняется, игнорируем повторный запрос');
      return false;
    }
    
    setIsCollecting(true);
    setLastCollectError(null);
    
    // Используем внешнее значение контейнера, если оно предоставлено
    // Это обеспечивает совместимость с обоими подходами (prop и context)
    let containerSnotToUse = externalContainerSnot !== undefined ? 
      externalContainerSnot : containerSnot;
    
    try {
      // Проверка значения перед сбором
      if (typeof containerSnotToUse !== 'number' || isNaN(containerSnotToUse) || containerSnotToUse <= 0) {
        const errorMessage = 'Контейнер пуст или содержит некорректное значение';
        setLastCollectError(errorMessage);
        console.warn('[useContainer] Ошибка перед сбором:', {
          containerSnotToUse,
          error: errorMessage
        });
        setIsCollecting(false);
        return false;
      }
      
      // Если есть нормальный ResourceContext, используем его
      if (resources) {
        console.log(`[useContainer] Сбор ресурсов из контейнера через ResourceContext: ${containerSnotToUse}`);
        
        // Дополнительное логирование для отладки доступных методов
        console.log('[useContainer] Доступные методы ResourceContext:', 
          Object.keys(resources).filter(key => typeof (resources as any)[key] === 'function'));
        console.log('[useContainer] Текущие ресурсы:', resources.getAllResources ? resources.getAllResources() : 'getAllResources недоступен');
        
        // Сначала проверим текущее значение в ResourceContext
        const currentContainerSnot = resources.getResource('containerSnot');
        
        // Если значения не совпадают, но оба положительные, используем большее
        if (currentContainerSnot !== containerSnotToUse && 
            currentContainerSnot > 0 && 
            containerSnotToUse > 0) {
          console.log('[useContainer] Обнаружено расхождение в значениях контейнера:', {
            contextValue: currentContainerSnot,
            providedValue: containerSnotToUse,
            usingHigher: Math.max(currentContainerSnot, containerSnotToUse)
          });
        }
        
        // Выполняем сбор, если значение > 0
        if (containerSnotToUse > 0) {
          console.log(`[useContainer] Выполняем сбор: ${containerSnotToUse} снота`);
          
          try {
            // Получаем эффективность сбора
            const efficiency = resources.getResource('collectionEfficiency') || 1;
            
            // Вычисляем количество соплей с учетом эффективности
            const snotToAdd = containerSnotToUse * efficiency;
            
            if (gameContext.dispatch) {
              gameContext.dispatch({
                type: 'COLLECT_CONTAINER_SNOT',
                payload: containerSnotToUse
              });
              
              // Обновляем ресурсы
              if (resources) {
                resources.setResource('containerSnot', 0);
                resources.setResource('snot', resources.getResource('snot') + snotToAdd);
              }
              
              console.log(`[useContainer] Ресурсы собраны: ${snotToAdd} снота добавлено`);
            } else {
              throw new Error('Диспетчер контекста игры недоступен');
            }
            
            // Обновляем состояние для UI
            setIsCollecting(false);
            return true;
          } catch (error) {
            console.error('[useContainer] Ошибка при сборе ресурсов:', error);
            setLastCollectError(`Ошибка при сборе: ${error}`);
            setIsCollecting(false);
            return false;
          }
        } else {
          console.log('[useContainer] Контейнер пуст, нечего собирать');
          setIsCollecting(false);
          setLastCollectError('Контейнер пуст');
          return false;
        }
      } else {
        throw new Error('Ресурсы или контекст игры недоступны');
      }
    } catch (error) {
      console.error('[useContainer] Критическая ошибка при сборе:', error);
      setLastCollectError(`Критическая ошибка: ${error}`);
      setIsCollecting(false);
      return false;
    }
  }, [resources, gameContext, containerSnot, isCollecting]);
  
  return {
    containerSnot,
    containerCapacity,
    fillingSpeed,
    fillingSpeedLevel: resources?.getResource('fillingSpeedLevel') ?? 1,
    containerCapacityLevel: resources?.getResource('containerCapacityLevel') ?? 1,
    collect: collectSafely,
    getFillingPercentage,
    isCollecting,
    lastCollectError,
    forceUpdateContainer
  };
}; 