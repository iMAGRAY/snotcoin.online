"use client"

import React, { useMemo } from "react"
import { motion } from "framer-motion"
import { useGameState } from "../../contexts/game/hooks"
import { useTranslation } from "../../i18n"
import { ErrorBoundary } from "../ErrorBoundary"
import Image from "next/image"
import { formatSnotValue } from "../../utils/formatters"
import { ICONS, COLORS, UI_CLASSES, ANIMATIONS, LAYOUT, RESOURCES } from "../../constants/uiConstants"
import { validateContainerParams } from "../../utils/resourceUtils"

/**
 * Интерфейс пропсов для компонента Resources
 */
interface ResourcesProps {
  isVisible: boolean
  activeTab: string
  showOnlyKingCoin?: boolean
  showOnlySnot?: boolean
  snot: number
  kingCoins: number
  // Параметры для StatusDisplay
  containerCapacity?: number
  containerLevel?: number
  containerSnot?: number
  containerFillingSpeed?: number
  fillingSpeedLevel?: number
}

/**
 * Компонент для отображения отдельного ресурса
 */
const ResourceItem: React.FC<{
  icon: string
  value: number
  maxValue?: number
  label: string
  colorClass: string
  ariaLabel: string
  timeToFull?: string | null | undefined
  noDecimals?: boolean | undefined
  showTimeInline?: boolean | undefined
}> = React.memo(({ icon, value, maxValue, label, colorClass, ariaLabel, timeToFull, noDecimals, showTimeInline }) => {
  // Стабилизация значения для предотвращения моргания
  const [stableValue, setStableValue] = React.useState(value);
  
  // Обновление значения с задержкой для предотвращения мерцания
  React.useEffect(() => {
    // Небольшая задержка для избежания постоянного обновления
    const timerId = setTimeout(() => {
      // Обновляем только если разница существенная (>0.01) или прошло достаточно времени
      if (Math.abs(value - stableValue) > 0.01) {
        setStableValue(value);
      }
    }, 500);
    
    return () => clearTimeout(timerId);
  }, [value, stableValue]);
  
  // Используем стабильное значение для отображения
  const formattedValue = useMemo(() => {
    if (stableValue === undefined) return "0"
    if (maxValue !== undefined) return `${Math.floor(stableValue)}/${maxValue}`
    if (noDecimals) return Math.floor(stableValue).toString()
    return formatSnotValue(stableValue, 4)
  }, [stableValue, maxValue, noDecimals])

  const { t } = useTranslation()

  return (
    <motion.div
      className={UI_CLASSES.RESOURCE_ITEM.CONTAINER}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={ariaLabel}
    >
      <div className={UI_CLASSES.RESOURCE_ITEM.IMAGE_CONTAINER}>
        <Image
          src={icon || ICONS.PLACEHOLDER}
          width={LAYOUT.RESOURCE_ICON_SIZE}
          height={LAYOUT.RESOURCE_ICON_SIZE}
          alt={t(label)}
          className="object-contain transition-all duration-300"
          draggable="false"
          style={{ height: 'auto' }}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
      <div className="flex flex-col items-center">
        <div className="flex items-center">
          <span className={`${UI_CLASSES.RESOURCE_ITEM.TEXT} ${colorClass}`}>
            {formattedValue}
          </span>
          {showTimeInline && timeToFull && (
            <span className="text-xs bg-gray-900 bg-opacity-40 px-2 py-0.5 rounded-sm text-blue-300 ml-2 whitespace-nowrap">
              {timeToFull}
            </span>
          )}
        </div>
        {!showTimeInline && timeToFull && (
          <span className="text-xs bg-gray-900 bg-opacity-40 px-2 py-0.5 rounded-sm text-blue-300 mt-0.5 whitespace-nowrap">
            {timeToFull}
          </span>
        )}
      </div>
    </motion.div>
  )
})

ResourceItem.displayName = "ResourceItem"

/**
 * Компонент отображения ресурсов
 */
const Resources: React.FC<ResourcesProps> = React.memo(
  ({
    isVisible,
    activeTab,
    showOnlyKingCoin = false,
    showOnlySnot = false,
    snot,
    kingCoins,
    containerCapacity,
    containerLevel,
    containerSnot,
    containerFillingSpeed,
    fillingSpeedLevel
  }) => {
    const { t } = useTranslation()

    // Построение списка ресурсов с использованием констант
    const resourceItems = useMemo(() => {
      // Определяем тип с нужными свойствами, позволяющий undefined в опциональных полях
      type ResourceItemType = {
        icon: string;
        value: number;
        label: string;
        colorClass: string;
        timeToFull?: string | undefined;
        noDecimals?: boolean | undefined;
        showTimeInline?: boolean | undefined;
      };
      
      const items: ResourceItemType[] = [
        {
          icon: ICONS.KINGCOIN,
          value: kingCoins,
          label: "RoyaleWay",
          colorClass: COLORS.KINGCOIN,
        },
        {
          icon: ICONS.SNOT,
          value: snot,
          label: "SNOT",
          colorClass: COLORS.SNOT,
        }
      ];
      
      if (showOnlyKingCoin) return items.filter(item => item.label === "RoyaleWay");
      if (showOnlySnot) return items.filter(item => item.label === "SNOT");
      return items;
    }, [kingCoins, snot, showOnlyKingCoin, showOnlySnot]);

    if (!isVisible) return null;

    // Рендеринг компонента
    return (
      <ErrorBoundary fallback={<div className="text-red-500">Error loading resources</div>}>
        <motion.div
          className={`${UI_CLASSES.PANEL.CONTAINER} w-full`}
          {...ANIMATIONS.RESOURCE_PANEL}
        >
          <div className="flex flex-col w-full">
            {/* Блок с ресурсами - всегда отображается */}
            <div className="flex justify-between items-center">
              <div className="flex space-x-2 sm:space-x-3">
                {resourceItems.map((item) => (
                  <ResourceItem
                    key={item.label}
                    icon={item.icon}
                    value={item.value}
                    label={item.label}
                    colorClass={item.colorClass}
                    ariaLabel={`${t(item.label)}: ${item.value}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </ErrorBoundary>
    );
  }
);

Resources.displayName = "Resources"

export default Resources