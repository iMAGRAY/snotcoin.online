"use client"

import React from "react"
import { motion } from "framer-motion"
import styles from "./statusPanel.module.css"
import { useTranslation } from "../../i18n"
import { formatTime, formatSnotValue } from "../../utils/formatters"
import { calculateFillingTime, getFillingSpeedByLevel } from "../../utils/gameUtils"
import { Database, Zap, Clock, ArrowUp } from "lucide-react"
import { useSelector } from "react-redux"
import { RootState } from "../../redux/rootReducer"
import { checkIfContainerFull } from "../../utils/inventory"
import StatInfo from "./StatInfo"

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
  const inventory = useSelector((state: RootState) => state.game.inventory)
  
  const safeContainerCapacity = isNaN(containerCapacity) || containerCapacity <= 0 ? 100 : containerCapacity
  const safeContainerLevel = isNaN(containerLevel) || containerLevel <= 0 ? 1 : containerLevel
  const safeFillingSpeedLevel = isNaN(fillingSpeedLevel) || fillingSpeedLevel <= 0 ? 1 : fillingSpeedLevel

  // Получаем корректное значение скорости заполнения на основе уровня
  const correctFillingSpeed = getFillingSpeedByLevel(fillingSpeedLevel ?? 1)
  
  // Проверяем, заполнен ли контейнер полностью
  const isContainerFull = checkIfContainerFull(containerSnot, containerCapacity)
  
  const stats = [
    {
      id: "snotcoins",
      label: t("snotcoins"),
      value: formatSnotValue(inventory?.snotcoins || 0, 2),
      tooltip: t("snotcoinsTooltip")
    },
    {
      id: "container",
      label: t("container"),
      value: `${Math.floor(containerSnot)}/${containerCapacity}`,
      tooltip: t("containerTooltip")
    }
  ]
  
  // Добавляем время до заполнения только если контейнер не полон
  if (!isContainerFull) {
    stats.push({
      id: "timeToFill",
      label: t("timeToFill"),
      value: formatTime(calculateFillingTime(containerSnot, containerCapacity, correctFillingSpeed).timeInSeconds),
      tooltip: t("timeToFillTooltip")
    })
  }
  
  return (
    <motion.div
      className={`flex flex-wrap justify-between bg-black/20 backdrop-blur-sm rounded-full ${className}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {stats.map((stat) => (
        <StatInfo
          key={stat.id}
          label={stat.label}
          value={stat.value}
          tooltip={stat.tooltip}
        />
      ))}
    </motion.div>
  )
}

export default React.memo(StatusPanel)

