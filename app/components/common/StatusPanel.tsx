import React from "react"
import { motion } from "framer-motion"
import { useTranslation } from "../../contexts/TranslationContext"
import { formatTime, calculateFillingTime, formatSnotValue } from "../../utils/gameUtils"
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

  const statusItems = [
    { icon: Database, label: "Cap", value: formatSnotValue(containerCapacity, 2), tooltip: t("capacityTooltip") },
    { icon: ArrowUp, label: "Lvl", value: containerLevel, tooltip: t("capacityLevelTooltip") },
    { icon: Zap, label: "Spd", value: fillingSpeedLevel, tooltip: t("fillingLevelTooltip") },
    {
      icon: Clock,
      label: "Fill",
      value: formatTime(calculateFillingTime(containerSnot, containerCapacity, containerFillingSpeed)),
      tooltip: t("fillTimeTooltip"),
    },
  ]

  return (
    <motion.div
      className={`flex justify-between bg-[#3a5c82] left-0 right-0 mt-0 w-full flex-1 rounded-lg overflow-hidden ${className}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {statusItems.map((item, index) => (
        <motion.div
          key={item.label}
          className="flex-1 flex items-center justify-between px-2 border-t border-[#4a7a9e] first:border-t-0 first:rounded-tl-lg last:rounded-tr-lg"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          title={item.tooltip}
        >
          <div className="flex items-center space-x-1">
            <item.icon className="w-3 h-3 text-white" />
            <span className="text-[10px] font-medium text-white">{item.label}</span>
          </div>
          <span className="text-[10px] font-bold text-white">{item.value}</span>
        </motion.div>
      ))}
    </motion.div>
  )
}

export default React.memo(StatusPanel)

