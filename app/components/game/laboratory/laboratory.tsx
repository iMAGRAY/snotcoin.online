"use client"

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useGameState, useGameDispatch } from "../../../contexts/GameContext"
import CollectButton from "./CollectButton"
import Resources from "../../common/Resources"
import BackgroundImage from "./BackgroundImage"
import FlyingNumber from "./flying-number"
import UpgradeButton from "./UpgradeButton"
import { formatSnotValue } from "../../../utils/formatters"
import { ANIMATION_DURATIONS, LAYOUT } from "../../../constants/uiConstants"
import { getSafeInventory, calculateFillingPercentage } from "../../../utils/resourceUtils"

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
  
  // Обновление ресурсов по таймеру
  useEffect(() => {
    // Сохраняем ссылку на интервал в переменной
    const resourceUpdateInterval = setInterval(() => {
      // Обновление состояния контейнера и ресурсов
      dispatch({ type: 'UPDATE_RESOURCES' });
    }, ANIMATION_DURATIONS.RESOURCE_UPDATE_INTERVAL);

    // Очищаем интервал при размонтировании компонента или изменении интервала
    return () => {
      clearInterval(resourceUpdateInterval);
    };
  }, [dispatch, ANIMATION_DURATIONS.RESOURCE_UPDATE_INTERVAL]); // Добавляем зависимость от интервала обновления

  /**
   * Обработчик сбора ресурсов
   */
  const handleCollect = useCallback(() => {
    // Проверяем возможность сбора
    if (inventory.containerSnot <= 0 || isCollecting || isNaN(inventory.containerSnot)) return
    
    // Устанавливаем состояние сбора
    setIsCollecting(true)
    
    // Получаем проверенное значение для сбора
    const amountToCollect = Math.max(0, inventory.containerSnot)
    
    // Диспатчим действие сбора
    dispatch({ 
      type: "COLLECT_CONTAINER_SNOT", 
      payload: { amount: amountToCollect } 
    })
    
    // Показываем анимацию с текущим значением
    setFlyingNumberValue(amountToCollect)
    
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
    
  }, [dispatch, inventory.containerSnot, isCollecting])

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
          containerSnotValue={formatSnotValue(inventory.containerSnot)}
          containerFilling={containerFilling}
        />
      </div>
      
      <div className="w-full px-4 py-4 flex items-center justify-center space-x-4 mb-6">
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

