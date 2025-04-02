"use client"

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useGameState, useGameDispatch } from "../../../contexts/game/hooks"
import CollectButton from "./CollectButton"
import BackgroundImage from "./BackgroundImage"
import FlyingNumber from "./flying-number"
import UpgradeButton from "./UpgradeButton"
import { formatSnotValue } from "../../../utils/formatters"
import { ANIMATION_DURATIONS, LAYOUT } from "../../../constants/uiConstants"
import { getSafeInventory, calculateFillingPercentage } from "../../../utils/resourceUtils"
import { FILL_RATES } from "../../../constants/gameConstants"

/**
 * Компонент лаборатории - основная игровая страница
 */
const Laboratory: React.FC = () => {
  const gameState = useGameState()
  const dispatch = useGameDispatch()
  const router = useRouter()
  const [isCollecting, setIsCollecting] = useState(false)
  const [flyingNumberValue, setFlyingNumberValue] = useState<number | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Ссылка на текущее состояние и dispatch для доступа в интервалах без перерендера
  const gameStateRef = useRef(gameState)
  const dispatchRef = useRef(dispatch)
  
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
    
    // Не модифицируем inventory напрямую, так как это ведет к непредсказуемым результатам
    
    // Диспатчим действие сбора
    dispatch({ 
      type: "COLLECT_CONTAINER_SNOT", 
      payload: { amount: amountToCollect } 
    })
    
    // Принудительно обнуляем containerSnot в Redux
    dispatch({
      type: "UPDATE_CONTAINER_SNOT",
      payload: 0
    })
    
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
    
  }, [dispatch, inventory.containerSnot, isCollecting]) // Уточняем зависимости

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
    >
      <div className={`w-full flex-grow relative`}>
        <BackgroundImage
          store={gameState}
          onContainerClick={null}
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
    </motion.div>
  )
}

export default React.memo(Laboratory)

