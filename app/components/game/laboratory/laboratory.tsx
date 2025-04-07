"use client"

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useGameState, useGameDispatch } from "../../../contexts/game/hooks"
import CollectButton from "./CollectButton"
import BackgroundImage from "./BackgroundImage"
import FlyingNumber from "./flying-number"
import ContainerFlyingNumber from "./ContainerFlyingNumber"
import UpgradeButton from "./UpgradeButton"
import { formatSnotValue } from "../../../utils/formatters"
import { ANIMATION_DURATIONS, LAYOUT } from "../../../constants/uiConstants"
import { getSafeInventory, calculateFillingPercentage } from "../../../utils/resourceUtils"
import { FILL_RATES } from "../../../constants/gameConstants"
import { useEnergyRestoration } from "../../../hooks/useEnergyRestoration"
import { secureLocalSave } from "../../../utils/localSaveProtection"
import { cleanupLocalStorage, getLocalStorageSize, cleanupUserBackups } from "../../../services/localStorageManager"
import { useForceSave } from "../../../hooks/useForceSave"

// Порог заполнения localStorage, при котором запускается очистка (в процентах)
const LOCAL_STORAGE_CLEANUP_THRESHOLD = 75;
// Максимальное количество локальных сохранений для пользователя
const MAX_LOCAL_SAVES = 3;

/**
 * Компонент лаборатории - основная игровая страница
 */
const Laboratory: React.FC = () => {
  // Используем хук для восстановления энергии
  useEnergyRestoration(500, 8);
  
  const gameState = useGameState()
  const dispatch = useGameDispatch()
  const router = useRouter()
  const [isCollecting, setIsCollecting] = useState(false)
  const [flyingNumberValue, setFlyingNumberValue] = useState<number | null>(null)
  
  // Состояние для анимации числа при клике на контейнер
  const [containerClickNumbers, setContainerClickNumbers] = useState<Array<{
    id: number;
    value: number;
    x: number;
    y: number;
  }>>([])
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  // Ссылка на счетчик для уникальных ID анимаций
  const counterRef = useRef(0)
  
  // Ссылка на текущее состояние и dispatch для доступа в интервалах без перерендера
  const gameStateRef = useRef(gameState)
  const dispatchRef = useRef(dispatch)
  
  // Предотвращаем контекстное меню для защиты изображений от сохранения
  const preventContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  }, []);
  
  // Обновляем ссылки при изменении
  useEffect(() => {
    gameStateRef.current = gameState
    dispatchRef.current = dispatch
  }, [gameState, dispatch])

  // Безопасно получаем данные инвентаря
  const inventory = useMemo(() => 
    getSafeInventory(gameState), 
    [gameState]
  )
  
  // Вычисляем процент заполнения контейнера
  const containerFilling = useMemo(() => 
    calculateFillingPercentage(inventory), 
    [inventory]
  )
  
  // Очищаем таймер при размонтировании компонента
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])
  
  // Обновление ресурсов по таймеру - без зависимостей, которые меняются при рендере
  useEffect(() => {
    // Вычисляем скорость заполнения для 1 snot за 24 часа при уровне скорости 1
    const updateResourcesAndFillContainer = () => {
      // Получаем текущие значения из gameStateRef, чтобы избежать цикла обновлений
      const currentState = gameStateRef.current;
      const currentInventory = getSafeInventory(currentState);
      
      const currentContainerSnot = currentInventory.containerSnot ?? 0;
      const containerCapacity = currentInventory.containerCapacity ?? 1;
      const fillingSpeed = currentInventory.fillingSpeed ?? 1;
      
      // Используем константу для базовой скорости заполнения
      const baseIncreasePerSecond = FILL_RATES.BASE_CONTAINER_FILL_RATE;
      
      // Учитываем текущий уровень скорости заполнения
      const actualIncreasePerSecond = baseIncreasePerSecond * fillingSpeed;
      
      // Одно обновление каждую секунду
      const increasePerInterval = actualIncreasePerSecond * (ANIMATION_DURATIONS.RESOURCE_UPDATE_INTERVAL / 1000);
      
      // Ограничиваем новое значение вместимостью контейнера
      const newContainerSnot = Math.min(
        containerCapacity,
        currentContainerSnot + increasePerInterval
      );
      
      // Диспатчим действие обновления контейнера только при реальном изменении
      if (Math.abs(newContainerSnot - currentContainerSnot) > 0.00001) {
        dispatchRef.current({ 
          type: "UPDATE_CONTAINER_SNOT", 
          payload: newContainerSnot 
        });
      }
    };
    
    // Убеждаемся, что константа задана
    const updateInterval = ANIMATION_DURATIONS.RESOURCE_UPDATE_INTERVAL || 1000;
    
    // Сохраняем ссылку на интервал в переменной
    const resourceUpdateInterval = setInterval(updateResourcesAndFillContainer, updateInterval);
    
    // Вызываем функцию сразу при монтировании, но через setTimeout с нулевой задержкой, 
    // чтобы избежать проблем с рендерингом
    const initialUpdateTimeout = setTimeout(updateResourcesAndFillContainer, 0);

    // Очищаем интервал и таймаут при размонтировании компонента
    return () => {
      clearInterval(resourceUpdateInterval);
      clearTimeout(initialUpdateTimeout);
    };
  }, []); // Пустой массив зависимостей, чтобы эффект выполнялся только один раз при монтировании

  // Состояние для хранения последнего нажатия на контейнер
  const lastContainerClickRef = useRef<number>(0);
  
  // Функция для сохранения состояния игры локально
  const saveGameLocally = useCallback(() => {
    const userId = gameState._userId;
    if (!userId) return;
    
    try {
      // Проверяем время последнего сохранения, чтобы избежать слишком частых сохранений
      const now = Date.now();
      const timeSinceLastSave = now - lastContainerClickRef.current;
      
      // Если с последнего сохранения прошло менее 5 секунд, пропускаем сохранение
      const MIN_SAVE_INTERVAL = 5000; // 5 секунд
      if (timeSinceLastSave < MIN_SAVE_INTERVAL) {
        console.log(`[Laboratory] Сохранение пропущено (последнее было ${timeSinceLastSave}мс назад)`);
        return;
      }
      
      // Обновляем время последнего сохранения
      lastContainerClickRef.current = now;
      
      // Проверяем заполнение localStorage
      const { percent } = getLocalStorageSize();
      
      // Если заполнение выше порога, запускаем очистку
      if (percent > LOCAL_STORAGE_CLEANUP_THRESHOLD) {
        console.log(`[Laboratory] Заполнение localStorage: ${percent.toFixed(2)}%, запуск очистки...`);
        cleanupLocalStorage(LOCAL_STORAGE_CLEANUP_THRESHOLD, userId);
      }
      
      // Сохраняем состояние в защищенное локальное хранилище
      const saved = secureLocalSave(userId, gameState);
      if (saved) {
        console.log(`[Laboratory] Состояние игры успешно сохранено локально`);
        
        // После успешного сохранения очищаем старые копии, оставляя только MAX_LOCAL_SAVES последних
        const removedCount = cleanupUserBackups(userId, MAX_LOCAL_SAVES);
        if (removedCount > 0) {
          console.log(`[Laboratory] Удалено ${removedCount} старых локальных сохранений`);
        }
      } else {
        console.warn(`[Laboratory] Не удалось сохранить состояние игры локально`);
      }
    } catch (error) {
      console.error(`[Laboratory] Ошибка при локальном сохранении:`, error);
    }
  }, [gameState]);
  
  // Используем хук для принудительного сохранения
  const forceSave = useForceSave();
  
  /**
   * Обработчик сбора ресурсов
   */
  const handleCollect = useCallback(() => {
    // Проверяем возможность сбора
    if (inventory.containerSnot <= 0 || isCollecting || isNaN(inventory.containerSnot)) return
    
    // Получаем проверенное значение для сбора
    const amountToCollect = Math.max(0, inventory.containerSnot)
    
    // Немедленно устанавливаем состояние сбора для блокировки повторного нажатия
    setIsCollecting(true)
    
    // Показываем анимацию с текущим значением
    setFlyingNumberValue(amountToCollect)
    
    // ВАЖНО: Сохраняем исходное значение снота ДО операции сбора
    const initialSnot = gameState.inventory.snot || 0;
    const expectedFinalSnot = initialSnot + amountToCollect;
    
    console.log('[Laboratory] Начинаем сбор ресурсов:', {
      initialSnot,
      amountToCollect,
      expectedFinalSnot,
      время: new Date().toISOString()
    });
    
    // 1. СНАЧАЛА собираем ресурсы - обновляем состояние в Redux
    
    // Диспатчим действие сбора (увеличивает snot и обнуляет containerSnot)
    dispatch({ 
      type: "COLLECT_CONTAINER_SNOT", 
      payload: { amount: amountToCollect } 
    })
    
    // Принудительно обнуляем containerSnot в Redux
    dispatch({
      type: "UPDATE_CONTAINER_SNOT",
      payload: 0
    })
    
    // 2. Проверка и коррекция значений через задержку
    // Функция для явного обновления snot, если не произошло автоматически
    const forceCorrectSnot = () => {
      const currentSnot = gameState.inventory.snot;
      
      // Проверяем корректность значения snot после сбора
      if (currentSnot !== expectedFinalSnot) {
        console.warn('[Laboratory] Проблема с обновлением snot, корректируем:', {
          текущее: currentSnot,
          ожидаемое: expectedFinalSnot,
          разница: expectedFinalSnot - (currentSnot || 0)
        });
        
        // Явно устанавливаем правильное значение
        dispatch({
          type: "SET_RESOURCE",
          payload: {
            resource: "snot",
            value: expectedFinalSnot
          }
        });
        
        // Возвращаем true если было обнаружено расхождение
        return true;
      }
      return false;
    };
    
    // Запускаем серию проверок и сохранений с возрастающими задержками
    // Первая проверка через 200мс чтобы убедиться что Redux успел обновиться
    setTimeout(() => {
      const corrected = forceCorrectSnot();
      
      console.log('[Laboratory] Проверка snot после сбора:', {
        значение: gameState.inventory.snot,
        ожидаемое: expectedFinalSnot,
        исправлено: corrected
      });
      
      // 3. ТОЛЬКО ПОСЛЕ обновления состояния начинаем сохранение
      // Первое сохранение через 300мс (т.е. 500мс от начала сбора)
      setTimeout(() => {
        // Еще раз проверяем и корректируем значения перед сохранением
        forceCorrectSnot();
        
        // Первое сохранение
        forceSave(400).then(success => {
          console.log('[Laboratory] Результат первого сохранения:', {
            успех: success,
            сохранено: gameState.inventory.snot,
            ожидалось: expectedFinalSnot
          });
          
          // Второе сохранение через 500мс
          setTimeout(() => {
            // Проверяем и корректируем перед вторым сохранением
            forceCorrectSnot();
            
            forceSave(500).then(secondSuccess => {
              console.log('[Laboratory] Результат второго сохранения:', {
                успех: secondSuccess,
                сохранено: gameState.inventory.snot,
                ожидалось: expectedFinalSnot
              });
              
              // Третье финальное сохранение еще через 500мс
              setTimeout(() => {
                // Финальная проверка перед последним сохранением
                forceCorrectSnot();
                
                forceSave(600).then(finalSuccess => {
                  console.log('[Laboratory] Финальное сохранение завершено:', {
                    успех: finalSuccess,
                    финальноеЗначение: gameState.inventory.snot,
                    ожидалось: expectedFinalSnot
                  });
                });
              }, 500);
            });
          }, 500);
        });
      }, 300);
    }, 200);
    
    // Очищаем предыдущий таймер если он есть
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    
    // Устанавливаем таймер для скрытия анимации
    timerRef.current = setTimeout(() => {
      setFlyingNumberValue(null)
      setIsCollecting(false)
      timerRef.current = null
    }, ANIMATION_DURATIONS.FLYING_NUMBER)
    
  }, [dispatch, inventory.containerSnot, isCollecting, forceSave, gameState])

  /**
   * Переход на страницу улучшений
   */
  const handleUpgradeClick = useCallback(() => {
    // Добавляем минимальную задержку для обновления состояния, но не ждем его завершения
    dispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" });
    // Сразу переходим на страницу улучшений
    router.push("/upgrade", { scroll: false });
  }, [router, dispatch]);

  // Предварительно загружаем страницу улучшений при монтировании компонента
  useEffect(() => {
    router.prefetch('/upgrade');
  }, [router]);

  const handleContainerClick = useCallback((event: React.MouseEvent) => {
    // Уменьшаем энергию при клике на контейнер если она больше 0
    if (gameState.inventory.energy > 0) {
      // Для отладки
      console.log(`Using energy: ${gameState.inventory.energy} -> ${gameState.inventory.energy - 1}`);
      
      // Получаем координаты клика относительно окна
      const x = event.clientX;
      const y = event.clientY;
      
      // Добавляем некоторое количество в контейнер при клике
      const currentContainerSnot = gameState.inventory.containerSnot || 0;
      const containerCapacity = gameState.inventory.containerCapacity || 1;
      
      // Увеличиваем значение в контейнере на 0,05% от вместимости контейнера
      const clickIncrement = containerCapacity * 0.0005; // 0,05% от вместимости
      const newContainerSnot = Math.min(containerCapacity, currentContainerSnot + clickIncrement);
      
      console.log(`Увеличиваем содержимое контейнера: ${currentContainerSnot.toFixed(4)} -> ${newContainerSnot.toFixed(4)} (+ ${clickIncrement.toFixed(6)} = 0,05% от емкости ${containerCapacity})`);
      
      // Увеличиваем счетчик для уникального ID
      const numberId = counterRef.current++;
      
      // Добавляем новую анимацию числа с небольшим рандомным смещением
      setContainerClickNumbers(prev => [
        ...prev,
        {
          id: numberId,
          value: clickIncrement,
          x: x + (Math.random() * 40 - 20), // Добавляем случайное смещение по X
          y: y + (Math.random() * 20 - 10)  // Добавляем случайное смещение по Y
        }
      ]);
      
      // Удаляем анимацию через 1.5 секунды
      setTimeout(() => {
        setContainerClickNumbers(prev => 
          prev.filter(item => item.id !== numberId)
        );
      }, 1500);
      
      // Обновляем значение в контейнере
      dispatch({
        type: "UPDATE_CONTAINER_SNOT",
        payload: newContainerSnot
      });
      
      // Уменьшаем энергию на 1
      dispatch({ 
        type: "SET_RESOURCE", 
        payload: { 
          resource: "energy", 
          value: gameState.inventory.energy - 1,
          skipUpdateTime: true // Пропускаем обновление времени в редюсере
        } 
      });
      
      // Отдельно обновляем время последнего обновления энергии
      dispatch({ 
        type: "SET_RESOURCE", 
        payload: { 
          resource: "lastEnergyUpdateTime", 
          value: Date.now() 
        } 
      });
    } else {
      console.log('Недостаточно энергии для действия');
    }
  }, [gameState.inventory.energy, gameState.inventory.containerSnot, gameState.inventory.containerCapacity, dispatch]);

  return (
    <motion.div
      className="relative w-full h-full flex flex-col items-center justify-between"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onContextMenu={preventContextMenu}
    >
      <div className="w-full md:w-4/5 lg:w-3/4 xl:w-2/3 mx-auto flex-1 flex flex-col justify-center overflow-hidden" style={{ maxHeight: '70vh' }}>
        <BackgroundImage 
          store={gameState}
          onContainerClick={handleContainerClick}
          allowContainerClick={true}
          isContainerClicked={isCollecting}
          id="container-element"
          containerSnotValue={formatSnotValue(inventory.containerSnot, 4)}
          containerFilling={(inventory.containerSnot / Math.max(1, inventory.containerCapacity)) * 100}
        />
      </div>
      
      <div className="w-full px-4 py-4 flex items-center justify-center space-x-4 mb-24">
        <CollectButton 
          onCollect={handleCollect} 
          containerSnot={inventory.containerSnot} 
          isCollecting={isCollecting} 
        />
        <UpgradeButton onClick={handleUpgradeClick} />
      </div>
      
      {flyingNumberValue !== null && (
        <FlyingNumber value={flyingNumberValue} />
      )}
      
      {/* Отображаем все активные анимации чисел при клике на контейнер */}
      {containerClickNumbers.map(item => (
        <ContainerFlyingNumber 
          key={item.id}
          value={item.value}
          positionX={item.x}
          positionY={item.y}
        />
      ))}
    </motion.div>
  )
}

export default React.memo(Laboratory)

