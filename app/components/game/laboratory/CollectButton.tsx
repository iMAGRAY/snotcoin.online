"use client"

import React, { useMemo, useCallback, useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { useTranslation } from "../../../i18n"
import type { CollectButtonProps } from "../../../types/laboratory-types"
import { formatSnotValue } from "../../../utils/formatters"
import { ICONS } from "../../../constants/uiConstants"
import { useGameState, useGameDispatch } from "../../../contexts/game/hooks"
import { useForceSave } from "../../../hooks/useForceSave"

// Длительность анимации сбора ресурсов
const ANIMATION_DURATION = 1000; // 1 секунда

/**
 * Компонент кнопки сбора ресурсов
 */
const CollectButton: React.FC<CollectButtonProps> = React.memo(({ 
  onCollect, 
  containerSnot, 
  isCollecting 
}) => {
  const { t } = useTranslation()
  const store = useGameState()
  const dispatch = useGameDispatch()
  const forceSave = useForceSave()
  const [collectAnimationActive, setCollectAnimationActive] = useState(false)
  
  const isDisabled = typeof containerSnot !== 'number' || isNaN(containerSnot) || containerSnot <= 0 || isCollecting || collectAnimationActive

  const containerSnotValue = useMemo(() => {
    if (typeof containerSnot !== 'number' || isNaN(containerSnot)) {
      return '0';
    }
    return formatSnotValue(Math.max(0, containerSnot));
  }, [containerSnot]);

  const handleCollect = useCallback(() => {
    if (isDisabled) return;
    
    const currentSnot = store.inventory.snot;
    const expectedFinalSnot = currentSnot + containerSnot;
    
    // Логируем детали операции для отладки
    console.log(`[Laboratory] Начинаем сбор ресурсов: 
    {initialSnot: ${currentSnot}, amountToCollect: ${containerSnot}, expectedFinalSnot: ${expectedFinalSnot}, время: '${new Date().toISOString()}'}`);
    
    // Отправляем действие с указанием ожидаемого результата
    dispatch({
      type: 'COLLECT_CONTAINER_SNOT',
      payload: {
        containerSnot: containerSnot,
        expectedSnot: currentSnot // Передаем ожидаемое начальное значение для корректировки
      }
    });
    
    // Обновляем анимацию и запускаем эффект сбора
    setCollectAnimationActive(true);
    setTimeout(() => {
      setCollectAnimationActive(false);
      if (onCollect) onCollect();
    }, ANIMATION_DURATION);
    
    // Сохраняем игру после сбора
    forceSave(300);
  }, [isDisabled, containerSnot, store.inventory.snot, dispatch, onCollect, forceSave]);

  return (
    <motion.button
      onClick={handleCollect}
      className={`relative px-6 py-3 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-2xl font-bold 
        text-white shadow-lg border-2 border-yellow-300 focus:outline-none focus:ring-2 
        focus:ring-yellow-300 focus:ring-opacity-50 h-16 flex-grow ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      whileHover={!isDisabled ? { 
        scale: 1.05,
        boxShadow: "0 0 12px rgba(250, 204, 21, 0.7)",
      } : {}}
      whileTap={!isDisabled ? { scale: 0.95 } : {}}
      disabled={isDisabled}
    >
      <div className="flex items-center justify-center space-x-2">
        <Image 
          src={ICONS.LABORATORY.BUTTONS.CLAIM} 
          width={28} 
          height={28} 
          alt={t("collectResources")} 
          className="inline-block" 
          draggable="false"
          onContextMenu={(e) => e.preventDefault()}
        />
        <span>{t("collect")}</span>
      </div>
    </motion.button>
  )
})

CollectButton.displayName = "CollectButton"

export default CollectButton

