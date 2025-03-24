"use client"

import React from "react"
import { motion } from "framer-motion"
import { cn } from "../../lib/utils"
import Image from "next/image"

export interface MenuItemProps {
  // Основные свойства
  icon?: React.ReactNode
  iconSrc?: string
  text: string
  onClick?: () => void
  
  // Дополнительные свойства
  description?: string
  badge?: string | number
  isActive?: boolean
  isDisabled?: boolean
  
  // Стилизация
  className?: string
  iconClassName?: string
  textClassName?: string
  badgeClassName?: string
  activeClassName?: string
  disabledClassName?: string
  
  // Анимация
  isAnimated?: boolean
  hoverScale?: number
  tapScale?: number
  
  // Прочее
  href?: string
  target?: string
  ariaLabel?: string
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  iconSrc,
  text,
  onClick,
  description,
  badge,
  isActive = false,
  isDisabled = false,
  className,
  iconClassName,
  textClassName,
  badgeClassName,
  activeClassName = "bg-primary/20",
  disabledClassName = "opacity-50 cursor-not-allowed",
  isAnimated = true,
  hoverScale = 1.02,
  tapScale = 0.98,
  href,
  target,
  ariaLabel,
}) => {
  const baseClassName = cn(
    "flex items-center p-3 rounded-lg transition-all duration-200",
    isActive && activeClassName,
    isDisabled && disabledClassName,
    className
  )
  
  const content = (
    <>
      {icon && <div className={cn("mr-3 flex-shrink-0", iconClassName)}>{icon}</div>}
      
      {iconSrc && (
        <div className={cn("relative w-6 h-6 mr-3 flex-shrink-0", iconClassName)}>
          <Image
            src={iconSrc}
            alt=""
            width={24}
            height={24}
            className="object-contain"
          />
        </div>
      )}
      
      <div className="flex-1">
        <div className={cn("text-sm font-medium", textClassName)}>{text}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      
      {badge !== undefined && (
        <div className={cn("ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/10", badgeClassName)}>
          {badge}
        </div>
      )}
    </>
  )
  
  // Если компонент должен быть ссылкой
  if (href) {
    return isAnimated ? (
      <motion.a
        href={href}
        target={target}
        className={baseClassName}
        whileHover={{ scale: isDisabled ? 1 : hoverScale }}
        whileTap={{ scale: isDisabled ? 1 : tapScale }}
        aria-label={ariaLabel || text}
        aria-disabled={isDisabled}
      >
        {content}
      </motion.a>
    ) : (
      <a
        href={href}
        target={target}
        className={baseClassName}
        aria-label={ariaLabel || text}
        aria-disabled={isDisabled}
      >
        {content}
      </a>
    )
  }
  
  // Если компонент должен быть кнопкой
  return isAnimated ? (
    <motion.button
      onClick={isDisabled ? undefined : onClick}
      className={baseClassName}
      whileHover={{ scale: isDisabled ? 1 : hoverScale }}
      whileTap={{ scale: isDisabled ? 1 : tapScale }}
      disabled={isDisabled}
      aria-label={ariaLabel || text}
    >
      {content}
    </motion.button>
  ) : (
    <button
      onClick={isDisabled ? undefined : onClick}
      className={baseClassName}
      disabled={isDisabled}
      aria-label={ariaLabel || text}
    >
      {content}
    </button>
  )
}

export default MenuItem 