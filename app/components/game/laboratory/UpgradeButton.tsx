"use client"

import React, { useCallback, useState, useEffect } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import type { UpgradeButtonProps } from "../../../types/laboratory-types"
import { useTranslation } from "../../../i18n"
import { ICONS } from "../../../constants/uiConstants"
import { useRouter, usePathname } from "next/navigation"

/**
 * Компонент кнопки перехода к улучшениям
 */
const UpgradeButton: React.FC<UpgradeButtonProps> = React.memo(({ onClick }) => {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  
  // Предзагружаем страницу улучшений
  useEffect(() => {
    if (pathname === '/') {
      // Используем prefetch для предварительной загрузки страницы
      void router.prefetch('/upgrade')
    }
  }, [router, pathname])
  
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    }
  }, [onClick]);

  return (
    <motion.button
      onClick={handleClick}
      className="relative p-3 bg-gradient-to-r from-[#4a7a9e] to-[#3a4c62] rounded-2xl font-bold 
        text-white shadow-lg border-2 border-[#5889ae] focus:outline-none focus:ring-2 
        focus:ring-[#4a7a9e] transition-all duration-200 h-16 w-16 flex items-center justify-center"
      whileHover={{ 
        scale: 1.05,
        boxShadow: "0 0 12px rgba(74, 122, 158, 0.7)",
      }}
      whileTap={{ scale: 0.95 }}
    >
      <Image 
        src={ICONS.LABORATORY.BUTTONS.UPGRADE} 
        width={32} 
        height={32} 
        alt={t("upgradeResources")} 
        className="inline-block" 
      />
    </motion.button>
  )
})

UpgradeButton.displayName = "UpgradeButton"

export default UpgradeButton

