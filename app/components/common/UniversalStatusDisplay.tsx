"use client"

import React, { useMemo } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "../../contexts/TranslationContext"
import { useGameState } from "../../contexts/GameContext"
import { formatTime, formatSnotValue } from "../../utils/formatters"
import { calculateFillingTime } from "../../utils/gameUtils"
import { Database, Zap, Clock, ArrowUp, Trophy, Coins } from "lucide-react"
import Image from "next/image"
import { cn } from "../../lib/utils"
import type { StaticImageData } from "next/image"
import { ICONS } from "../../constants/uiConstants"

export interface StatusItemProps {
  icon: React.ElementType | string
  label: string
  value: string | number
  tooltip?: string
  color?: string
}

export interface ResourceItemProps {
  id?: string
  icon: string
  value: number
  label: string
  color?: string
}

export interface UniversalStatusDisplayProps {
  // Общие свойства
  className?: string
  position?: "fixed" | "absolute" | "relative" | "sticky"
  showResources?: boolean
  showStatusItems?: boolean
  
  // Свойства для ресурсов
  resources?: ResourceItemProps[]
  
  // Свойства для статусных элементов
  statusItems?: StatusItemProps[]
  
  // Свойства для лаборатории
  containerCapacity?: number
  containerLevel?: number
  containerSnot?: number
  containerFillingSpeed?: number
  fillingSpeedLevel?: number
  
  // Стилизация
  variant?: "full" | "compact" | "minimal"
  theme?: "dark" | "light" | "transparent"
}

const StatusItem: React.FC<StatusItemProps & { className?: string }> = React.memo(
  ({ icon, label, value, tooltip, color = "text-white", className }) => {
    const Icon = typeof icon === "string" ? undefined : icon
    
    return (
      <motion.div
        className={cn(
          "flex-1 flex items-center justify-center px-0.5 rounded-full space-x-1 hover:bg-white/20 transition-all duration-300",
          className
        )}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        whileHover={{ scale: 1.05 }}
        title={tooltip}
      >
        {Icon ? (
          <Icon className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
        ) : (
          icon && typeof icon === "string" && (
            <div className="relative w-4 h-4 sm:w-5 sm:h-5">
              <Image
                src={icon}
                alt={label}
                width={20}
                height={20}
                className="object-contain"
              />
            </div>
          )
        )}
        <span className="text-[10px] sm:text-xs font-medium text-white">{label}</span>
        <span className={`text-[10px] sm:text-xs font-bold ${color}`}>
          {typeof value === "number" ? formatSnotValue(value) : value}
        </span>
      </motion.div>
    )
  }
)

StatusItem.displayName = "StatusItem"

const ResourceItem: React.FC<ResourceItemProps & { className?: string }> = React.memo(
  ({ icon, value, label, color = "text-white", className }) => (
    <motion.div
      className={cn(
        "flex items-center space-x-1.5 py-1 px-2 sm:px-3 rounded-lg hover:bg-[#2a3b4d]/30 transition-all duration-300",
        className
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="relative w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0">
        <Image
          src={icon || ICONS.PLACEHOLDER}
          alt={label}
          width={28}
          height={28}
          className="object-contain transition-all duration-300"
        />
      </div>
      <div className="flex items-center">
        <span className={`text-base sm:text-lg font-bold leading-none ${color}`}>
          {formatSnotValue(value)}
        </span>
      </div>
    </motion.div>
  )
)

ResourceItem.displayName = "ResourceItem"

const UniversalStatusDisplay: React.FC<UniversalStatusDisplayProps> = ({
  className,
  position = "fixed",
  showResources = true,
  showStatusItems = true,
  resources,
  statusItems,
  containerCapacity,
  containerLevel,
  containerSnot,
  containerFillingSpeed,
  fillingSpeedLevel,
  variant = "full",
  theme = "dark",
}) => {
  const { t } = useTranslation()
  const gameState = useGameState()

  // Генерируем статусные элементы для лаборатории, если они не предоставлены
  const generatedStatusItems = useMemo(() => {
    if (statusItems) return statusItems
    
    if (containerCapacity !== undefined && containerLevel !== undefined && 
        containerSnot !== undefined && containerFillingSpeed !== undefined && 
        fillingSpeedLevel !== undefined) {
      return [
        {
          icon: Database,
          label: "Cap",
          value: formatSnotValue(containerCapacity, 2),
          tooltip: t("capacityTooltip"),
        },
        {
          icon: ArrowUp,
          label: "Lvl",
          value: containerLevel.toString(),
          tooltip: t("capacityLevelTooltip"),
        },
        {
          icon: Zap,
          label: "Spd",
          value: fillingSpeedLevel.toString(),
          tooltip: t("fillingLevelTooltip"),
        },
        {
          icon: Clock,
          label: "Fill",
          value: formatTime(calculateFillingTime(containerSnot, containerCapacity, containerFillingSpeed)),
          tooltip: t("fillTimeTooltip"),
        },
      ]
    }
    
    return []
  }, [
    statusItems, containerCapacity, containerLevel, containerSnot, 
    containerFillingSpeed, fillingSpeedLevel, t
  ])

  // Генерируем ресурсы, если они не предоставлены
  const resourceItems = useMemo(() => {
    if (resources) return resources;
    
    return [
      {
        id: "snotCoins",
        label: t("SNOT COINS"),
        value: gameState.inventory?.snotCoins ?? 0,
        maxValue: undefined,
        icon: ICONS.SNOTCOIN,
        color: "yellow",
        className: "flex-1 lg:flex-none",
        onClick: undefined
      },
      {
        id: "snot",
        label: t("SNOT"),
        value: gameState.inventory?.snot ?? 0,
        maxValue: undefined,
        icon: ICONS.SNOT,
        color: "greenBright",
        className: "flex-1 lg:flex-none",
        onClick: undefined
      }
    ];
  }, [resources, gameState.inventory?.snotCoins, gameState.inventory?.snot]);

  // Определяем классы для контейнера в зависимости от темы
  const containerClasses = cn(
    position === "fixed" ? "fixed top-0 left-0 right-0 z-50" : `${position} z-10`,
    theme === "dark" 
      ? "bg-gradient-to-b from-[#3a4c62] to-[#2a3b4d] shadow-lg border-b border-[#4a7a9e]" 
      : theme === "light" 
        ? "bg-gradient-to-b from-[#e0e0e0] to-[#c0c0c0] shadow-lg border-b border-[#a0a0a0]" 
        : "bg-transparent",
    className
  )

  return (
    <motion.div
      className={containerClasses}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-md mx-auto p-1 space-y-1">
        {showResources && variant !== "minimal" && (
          <div className="flex justify-between items-center">
            {resourceItems.map((item) => (
              <ResourceItem key={item.id} {...item} />
            ))}
          </div>
        )}
        
        {showStatusItems && (
          <div className={cn(
            "flex flex-wrap justify-between",
            variant !== "minimal" ? "bg-black/20 backdrop-blur-sm rounded-full py-1 px-2" : ""
          )}>
            {generatedStatusItems.map((item) => (
              <StatusItem key={item.label} {...item} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

UniversalStatusDisplay.displayName = "UniversalStatusDisplay"

export default UniversalStatusDisplay 