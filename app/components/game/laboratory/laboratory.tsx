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

    // Диспатчим ОДНО действие сбора с полной информацией
    dispatch({ 
      type: "COLLECT_CONTAINER_SNOT", 
      payload: { 
        containerSnot: amountToCollect,
        expectedSnot: expectedFinalSnot  // Передаем ожидаемое итоговое значение
      } 
    })
    
    // Запускаем единичную проверку и сохранение с задержкой
    setTimeout(() => {
      // Проверим значение snot после обновления Redux
      const currentSnot = gameState.inventory.snot;
      
      // Проверяем и корректируем только при существенной разнице
      if (Math.abs(currentSnot - expectedFinalSnot) > 0.001) {
        console.warn('[Laboratory] Корректируем snot:', {
          было: currentSnot,
          должно_быть: expectedFinalSnot
        });
        
        // Корректируем, только если обнаружена ошибка
        dispatch({
          type: "SET_RESOURCE",
          payload: {
            resource: "snot",
            value: expectedFinalSnot
          }
        });
      }
      
      // Сохраняем результат
      forceSave(300).then(success => {
        console.log('[Laboratory] Сохранение завершено:', {
          успех: success,
          итоговоеЗначение: gameState.inventory.snot
        });
      });
    }, 100);
    
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
          onContainerClick={() => {}}
          allowContainerClick={false}
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

