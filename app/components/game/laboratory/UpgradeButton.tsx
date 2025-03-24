"use client"

import React, { useCallback } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import type { UpgradeButtonProps } from "../../../types/laboratory-types"
import { useTranslation } from "../../../contexts/TranslationContext"
import { ICONS } from "../../../constants/uiConstants"

/**
 * Компонент кнопки перехода к улучшениям
 */
const UpgradeButton: React.FC<UpgradeButtonProps> = React.memo(({ onClick }) => {
  const { t } = useTranslation()
  
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
  }, [onClick]);

  return (
    <motion.button
      onClick={handleClick}
      className="relative px-6 py-3 bg-gradient-to-r from-[#4a7a9e] to-[#3a4c62] rounded-full font-bold 
        text-white shadow-lg shadow-[#4a7a9e]/20 focus:outline-none focus:ring-2 
        focus:ring-[#4a7a9e] transition-all duration-200 hover:shadow-xl hover:from-[#5189b0] hover:to-[#455a72]"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="flex items-center justify-center space-x-2">
        <Image 
          src={ICONS.LABORATORY.BUTTONS.UPGRADE} 
          width={24} 
          height={24} 
          alt={t("upgradeResources")} 
          className="inline-block" 
        />
        <span>{t("upgradeResources")}</span>
      </div>
    </motion.button>
  )
})

UpgradeButton.displayName = "UpgradeButton"

export default UpgradeButton

