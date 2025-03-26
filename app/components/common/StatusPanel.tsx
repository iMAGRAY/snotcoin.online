"use client"

import React from "react"
import { motion } from "framer-motion"
import styles from "./statusPanel.module.css"
import { useTranslation } from "../../i18n"
import { formatTime, formatSnotValue } from "../../utils/formatters"
import { calculateFillingTime } from "../../utils/gameUtils"
import { Database, Zap, Clock, ArrowUp } from "lucide-react"

interface StatusPanelProps {
  containerCapacity: number
  containerLevel: number
  containerSnot: number
  containerFillingSpeed: number
  fillingSpeedLevel: number
  className?: string
}

const StatusPanel: React.FC<StatusPanelProps> = ({
  containerCapacity,
  containerLevel,
  containerSnot,
  containerFillingSpeed,
  fillingSpeedLevel,
  className,
}) => {
  const { t } = useTranslation()

  // Безопасные значения для отображения
  const safeContainerCapacity = isNaN(containerCapacity) || containerCapacity <= 0 ? 100 : containerCapacity;
  const safeContainerLevel = isNaN(containerLevel) || containerLevel <= 0 ? 1 : containerLevel;
  const safeFillingSpeedLevel = isNaN(fillingSpeedLevel) || fillingSpeedLevel <= 0 ? 1 : fillingSpeedLevel;

  const statusItems = [
    { icon: Database, label: "Cap", value: formatSnotValue(safeContainerCapacity, 2), tooltip: t("capacityTooltip") },
    { icon: ArrowUp, label: "Lvl", value: safeContainerLevel, tooltip: t("capacityLevelTooltip") },
    { icon: Zap, label: "Spd", value: safeFillingSpeedLevel, tooltip: t("fillingLevelTooltip") },
    {
      icon: Clock,
      label: "Fill",
      value: formatTime(calculateFillingTime(containerSnot, containerCapacity, containerFillingSpeed)),
      tooltip: t("fillTimeTooltip"),
    },
  ]

  return (
    <motion.div
      className={`flex flex-wrap justify-between bg-black/20 backdrop-blur-sm rounded-full ${className}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {statusItems.map((item, index) => (
        <motion.div
          key={item.label}
          className="flex-1 flex items-center justify-center px-0.5 rounded-full space-x-1 hover:bg-white/20 transition-all duration-300"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          whileHover={{ scale: 1.05 }}
          title={item.tooltip}
        >
          <item.icon className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
          <span className="text-[10px] sm:text-xs font-medium text-white">{item.label}</span>
          <span className="text-[10px] sm:text-xs font-bold text-white">{item.value}</span>
        </motion.div>
      ))}
    </motion.div>
  )
}

export default React.memo(StatusPanel)

