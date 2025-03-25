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
      className={`relative px-6 py-3 bg-gradient-to-r from-[#bbeb25] to-[#a3d119] rounded-full font-bold 
        text-slate-800 shadow-lg shadow-[#bbeb25]/20 focus:outline-none focus:ring-2 
        focus:ring-[#bbeb25] transition-all duration-200 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-xl hover:from-[#c8f832] hover:to-[#b1df21]'}`}
      whileHover={!isDisabled ? { scale: 1.05 } : {}}
      whileTap={!isDisabled ? { scale: 0.95 } : {}}
      disabled={isDisabled}
    >
      <div className="flex items-center justify-center space-x-2">
        <Image 
          src={ICONS.LABORATORY.BUTTONS.CLAIM} 
          width={24} 
          height={24} 
          alt={t("collectResources")} 
          className="inline-block" 
        />
        <span>{`${t("collectResources")} (${containerSnotValue})`}</span>
      </div>
    </motion.button>
  )
})

CollectButton.displayName = "CollectButton"

export default CollectButton

