"use client"

import React, { useCallback, useState, useEffect } from "react"
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
  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  
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

  // Стили для эффекта при наведении и нажатии
  const buttonStyles = {
    transform: isPressed ? 'scale(0.95)' : (isHovered ? 'scale(1.05)' : 'scale(1)'),
    boxShadow: isHovered ? "0 0 12px rgba(250, 204, 21, 0.7)" : "0 0 0px rgba(250, 204, 21, 0)",
    transition: 'all 0.2s ease-in-out'
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center justify-center rounded-2xl bg-gradient-to-r from-yellow-400 to-yellow-600 text-white font-bold border-2 border-yellow-300 w-16 h-16 z-50"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={buttonStyles}
    >
      <Image 
        src={ICONS.LABORATORY.BUTTONS.UPGRADE} 
        width={32} 
        height={32} 
        alt={t("upgradeResources")} 
        draggable="false"
        onContextMenu={(e) => e.preventDefault()}
      />
    </button>
  )
})

UpgradeButton.displayName = "UpgradeButton"

export default UpgradeButton

