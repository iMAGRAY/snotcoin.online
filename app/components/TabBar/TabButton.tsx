"use client"

import React from "react"
import { motion } from "framer-motion"
import { cn } from "../../lib/utils"
import { useTranslation } from "../../i18n"
import { TabButtonProps } from "./types"
import type { TranslationKeys } from "../../i18n/types/translationTypes"
import audioService from "../../services/audioService"

const TabButton: React.FC<TabButtonProps> = ({ id, icon, label, isActive, onClick }) => {
  const { t } = useTranslation()
  
  // Функция для обработки клика с воспроизведением звука
  const handleClick = () => {
    // Воспроизводим звук при клике на кнопку
    audioService.playSound('tabbarSound');
    
    // Вызываем оригинальный обработчик клика
    onClick();
  };
  
  // Обработка иконок: для неактивных состояний используем вариант с "1" в названии
  const getIconSrc = () => {
    if (!isActive) {
      // Получаем путь к изображению
      const iconPath = icon.split('.')
      const extension = iconPath.pop() // Получаем расширение файла
      
      // Учитываем все возможные варианты вкладок
      switch (id) {
        case "storage":
          return "/images/storage/Storage1.webp"
        case "laboratory":
          return "/images/laboratory/Laboratory1.webp"
        case "merge":
          return "/images/merge/merge1.webp"
        case "quests":
          return "/images/quests/Quests1.webp"
        case "profile":
          return "/images/profile/Profile1.webp"
        default:
          return icon
      }
    }
    return icon
  }

  return (
    <div
      className={cn(
        "relative h-full flex flex-col items-center justify-center overflow-visible transition-all duration-300 isolate pointer-events-auto flex-1 mx-[1%] min-w-[18%] max-w-[19%]",
        isActive
          ? "before:absolute before:inset-0 before:bg-gradient-to-t before:from-[#3a5c82] before:via-[#4a7a9e] before:to-[#5889ae] before:z-10 before:shadow-[inset_0_1px_3px_rgba(255,255,255,0.3),0_-2px_4px_rgba(0,0,0,0.1)]"
          : "bg-transparent",
      )}
    >
      <motion.button
        onClick={handleClick}
        aria-label={t(label as keyof TranslationKeys)}
        aria-selected={isActive}
        role="tab"
        className="relative z-30 isolate select-none w-full h-full flex flex-col items-center justify-center overflow-visible"
        style={{ WebkitTapHighlightColor: "transparent" }}
        animate={{ 
          y: isActive ? -14 : -6,
        }}
        transition={{ duration: 0.3 }}
      >
        <motion.div 
          className="flex-shrink-0 flex items-center justify-center overflow-visible"
          initial={{ scale: 1, filter: "grayscale(100%) brightness(0.8)" }}
          animate={{ 
            scale: isActive ? 1.4 : 1.1,
            filter: isActive ? "grayscale(0%) brightness(1)" : "grayscale(100%) brightness(0.8)",
            y: isActive ? -3 : 0,
          }}
          transition={{ duration: 0.3 }}
          style={{
            width: isActive ? '3.4rem' : '3.2rem',
            height: isActive ? '3.4rem' : '3.2rem',
            marginTop: isActive ? '-0.1rem' : '0.1rem',
          }}
        >
          <img 
            src={getIconSrc()} 
            alt={t(label as keyof TranslationKeys)}
            className="max-w-full max-h-full object-contain"
            style={{ width: '100%', height: 'auto' }}
          />
        </motion.div>
      </motion.button>
    </div>
  )
}

export default React.memo(TabButton)

