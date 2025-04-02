"use client"

import React, { useMemo } from "react"
import { motion } from "framer-motion"
import { useGameState } from "../../contexts/game/hooks"
import { useTranslation } from "../../i18n"
import { ErrorBoundary } from "../ErrorBoundary"
import Image from "next/image"
import { formatSnotValue } from "../../utils/formatters"
import StatusDisplay from "../game/laboratory/status-display"
import { ICONS, COLORS, UI_CLASSES, ANIMATIONS, LAYOUT, RESOURCES } from "../../constants/uiConstants"
import { validateContainerParams } from "../../utils/resourceUtils"

/**
 * Интерфейс пропсов для компонента Resources
 */
interface ResourcesProps {
  isVisible: boolean
  activeTab: string
  showOnlySnotCoin?: boolean
  showOnlySnot?: boolean
  snot: number
  snotCoins: number
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
}> = React.memo(({ icon, value, maxValue, label, colorClass, ariaLabel }) => {
  const formattedValue = useMemo(() => {
    if (value === undefined) return "0"
    if (maxValue !== undefined) return `${Math.floor(value)}/${maxValue}`
    return formatSnotValue(value, 4)
  }, [value, maxValue])

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
        />
      </div>
      <div className="flex items-center">
        <span className={`${UI_CLASSES.RESOURCE_ITEM.TEXT} ${colorClass}`}>
          {formattedValue}
        </span>
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
    showOnlySnotCoin = false,
    showOnlySnot = false,
    snot,
    snotCoins,
    containerCapacity,
    containerLevel,
    containerSnot,
    containerFillingSpeed,
    fillingSpeedLevel
  }) => {
    const { t } = useTranslation()

    // Построение списка ресурсов с использованием констант
    const resourceItems = useMemo(() => {
      const items = [
        {
          icon: ICONS.SNOTCOIN,
          value: snotCoins,
          label: "SnotCoins",
          colorClass: COLORS.SNOTCOIN,
        },
        {
          icon: ICONS.SNOT,
          value: snot,
          label: "SNOT",
          colorClass: COLORS.SNOT,
        }
      ];

      if (showOnlySnotCoin) return items.filter(item => item.label === "SnotCoins");
      if (showOnlySnot) return items.filter(item => item.label === "SNOT");
      return items;
    }, [snotCoins, snot, showOnlySnotCoin, showOnlySnot]);

    if (!isVisible) return null;

    // Проверка условий для отображения StatusDisplay
    const isLaboratoryTab = activeTab === 'laboratory';
    const hasAllRequiredProps = 
      containerCapacity !== undefined && 
      containerLevel !== undefined && 
      containerSnot !== undefined && 
      containerFillingSpeed !== undefined &&
      fillingSpeedLevel !== undefined;
    
    // Правильное вычисление props для StatusDisplay
    const statusDisplayProps = useMemo(() => {
      if (!isLaboratoryTab || !hasAllRequiredProps) return null;
      
      return validateContainerParams({
        containerCapacity: containerCapacity ?? RESOURCES.DEFAULTS.MIN_CAPACITY,
        containerLevel: containerLevel ?? RESOURCES.DEFAULTS.MIN_LEVEL,
        containerSnot: containerSnot ?? 0,
        containerFillingSpeed: containerFillingSpeed ?? RESOURCES.DEFAULTS.MIN_FILLING_SPEED,
        fillingSpeedLevel: fillingSpeedLevel ?? RESOURCES.DEFAULTS.MIN_LEVEL
      });
    }, [
      isLaboratoryTab, 
      hasAllRequiredProps, 
      containerCapacity, 
      containerLevel, 
      containerSnot, 
      containerFillingSpeed, 
      fillingSpeedLevel
    ]);

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
            
            {/* StatusDisplay - отображается только в лаборатории */}
            {statusDisplayProps && (
              <div className="mt-2 px-2 pb-2">
                <StatusDisplay {...statusDisplayProps} />
              </div>
            )}
          </div>
        </motion.div>
      </ErrorBoundary>
    );
  }
);

Resources.displayName = "Resources"

export default Resources

