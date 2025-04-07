"use client"

import React, { useMemo } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "../../../i18n"
import { formatTime, formatSnotValue } from "../../../utils/formatters"
import { calculateFillingTime, getFillingSpeedByLevel } from "../../../utils/gameUtils"
import { validateContainerParams } from "../../../utils/resourceUtils"
import { Database, Zap, Clock, ArrowUp } from "lucide-react"
import type { StatusDisplayProps } from "../../../types/laboratory-types"
import { UI_CLASSES, ANIMATIONS } from "../../../constants/uiConstants"

/**
 * Компонент отображения отдельного статусного элемента
 */
const StatusItem: React.FC<{ 
  icon: React.ElementType; 
  label: string; 
  value: string; 
  tooltip: string 
}> = React.memo(({ icon: Icon, label, value, tooltip }) => (
  <motion.div
    className="flex-1 flex items-center justify-center px-0.5 rounded-full space-x-1 hover:bg-white/20 transition-all duration-300"
    {...ANIMATIONS.STATUS_ITEM}
    whileHover={{ scale: 1.05 }}
    title={tooltip}
  >
    <Icon className={UI_CLASSES.STATUS.ICON} />
    <span className={UI_CLASSES.STATUS.TEXT}>{label}</span>
    <span className={UI_CLASSES.STATUS.BOLD_TEXT}>{value}</span>
  </motion.div>
))

StatusItem.displayName = "StatusItem"

/**
 * Компонент отображения статусной панели контейнера
 */
const StatusDisplay: React.FC<StatusDisplayProps> = React.memo(({ 
  containerCapacity, 
  containerLevel, 
  containerSnot, 
  containerFillingSpeed, 
  fillingSpeedLevel 
}) => {
  const { t } = useTranslation()
  
  // Валидируем входные данные для безопасного отображения
  const validatedParams = useMemo(() => validateContainerParams({
    containerCapacity,
    containerLevel,
    containerSnot,
    containerFillingSpeed,
    fillingSpeedLevel
  }), [
    containerCapacity,
    containerLevel,
    containerSnot,
    containerFillingSpeed,
    fillingSpeedLevel
  ]);
  
  // Получаем корректное значение скорости заполнения на основе уровня
  const correctFillingSpeed = useMemo(() => {
    return getFillingSpeedByLevel(validatedParams.fillingSpeedLevel);
  }, [validatedParams.fillingSpeedLevel]);
  
  // Расчет времени заполнения контейнера с использованием корректной скорости
  const fillingTimeInfo = useMemo(() => {
    return calculateFillingTime(
      validatedParams.containerSnot, 
      validatedParams.containerCapacity, 
      correctFillingSpeed
    );
  }, [
    validatedParams.containerSnot, 
    validatedParams.containerCapacity, 
    correctFillingSpeed
  ]);
  
  // Форматирование времени в человекочитаемый формат
  const formattedTime = useMemo(() => {
    return formatTime(fillingTimeInfo.timeInSeconds);
  }, [fillingTimeInfo.timeInSeconds]);
  
  // Процент заполнения
  const fillPercentage = useMemo(() => {
    return Math.min(100, (containerSnot / Math.max(1, containerCapacity)) * 100);
  }, [containerSnot, containerCapacity]);
  
  // Создаем массив элементов статуса
  const statusItems = useMemo(() => [
    {
      icon: Database,
      label: "Capacity",
      value: formatSnotValue(validatedParams.containerCapacity, 2),
      tooltip: t("capacityTooltip"),
    },
    {
      icon: ArrowUp,
      label: "Lvl",
      value: validatedParams.containerLevel.toString(),
      tooltip: t("capacityLevelTooltip"),
    },
    {
      icon: Zap,
      label: "Spd",
      value: validatedParams.fillingSpeedLevel.toString(),
      tooltip: t("fillingLevelTooltip"),
    },
    {
      icon: Clock,
      label: "Fill",
      value: formattedTime,
      tooltip: t("fillTimeTooltip"),
    },
  ], [
    validatedParams.containerCapacity, 
    validatedParams.containerLevel, 
    validatedParams.fillingSpeedLevel, 
    t,
    formattedTime
  ]);

  // Обработка случая когда контейнер недоступен
  if (!validatedParams) {
    return (
      <motion.div
        className={UI_CLASSES.STATUS.CONTAINER}
        {...ANIMATIONS.STATUS_ITEM}
      >
        <div className="text-center py-1 px-2">
          <span className={UI_CLASSES.STATUS.BOLD_TEXT}>
            {t("containerUnavailable")}
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={UI_CLASSES.STATUS.CONTAINER}
      {...ANIMATIONS.STATUS_ITEM}
    >
      <div className="flex flex-wrap justify-between">
        {statusItems.map((item) => (
          <StatusItem key={item.label} {...item} />
        ))}
      </div>
    </motion.div>
  )
})

StatusDisplay.displayName = "StatusDisplay"

export default StatusDisplay

