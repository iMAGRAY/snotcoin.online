"use client"

import React, { useMemo, useCallback } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { useTranslation } from "../../../contexts/TranslationContext"
import type { CollectButtonProps } from "../../../types/laboratory-types"
import { formatSnotValue } from "../../../utils/formatters"
import { ICONS } from "../../../constants/uiConstants"

/**
 * Компонент кнопки сбора ресурсов
 */
const CollectButton: React.FC<CollectButtonProps> = React.memo(({ 
  onCollect, 
  containerSnot, 
  isCollecting 
}) => {
  const { t } = useTranslation()
  const isDisabled = typeof containerSnot !== 'number' || isNaN(containerSnot) || containerSnot <= 0 || isCollecting

  const containerSnotValue = useMemo(() => {
    if (typeof containerSnot !== 'number' || isNaN(containerSnot)) {
      return '0';
    }
    return formatSnotValue(Math.max(0, containerSnot));
  }, [containerSnot]);

  const handleClick = useCallback(() => {
    if (!isDisabled && onCollect) {
      onCollect();
    }
  }, [isDisabled, onCollect]);

  return (
    <motion.button
      onClick={handleClick}
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
        />
        <span>{t("collect")}</span>
      </div>
    </motion.button>
  )
})

CollectButton.displayName = "CollectButton"

export default CollectButton

