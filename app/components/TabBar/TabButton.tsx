"use client"

import React from "react"
import { motion } from "framer-motion"
import { cn } from "../../lib/utils"
import { useTranslation } from "../../contexts/TranslationContext"
import type { TabButtonProps } from "./types"

const TabButton: React.FC<TabButtonProps> = ({ id, icon, label, isActive, onClick }) => {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        "relative h-full flex flex-col items-center justify-center overflow-visible transition-all duration-300 isolate pointer-events-auto",
        isActive
          ? "w-[28%] before:absolute before:inset-0 before:bg-gradient-to-t before:from-[#3a5c82] before:via-[#4a7a9e] before:to-[#5889ae] before:z-10 before:shadow-[inset_0_1px_3px_rgba(255,255,255,0.3),0_-2px_4px_rgba(0,0,0,0.1)]"
          : "w-[24%] bg-transparent",
      )}
    >
      <motion.button
        onClick={onClick}
        aria-label={t(label)}
        aria-selected={isActive}
        role="tab"
        className="relative z-30 isolate select-none w-full h-full flex flex-col items-center justify-center"
        style={{ WebkitTapHighlightColor: "transparent" }}
        animate={{ 
          y: isActive ? -5 : 0,
        }}
        transition={{ duration: 0.3 }}
      >
        <motion.div 
          className="flex-shrink-0 flex items-center justify-center"
          initial={{ scale: 1, filter: "grayscale(100%) brightness(0.8)" }}
          animate={{ 
            scale: isActive ? 1.35 : 1,
            filter: isActive ? "grayscale(0%) brightness(1)" : "grayscale(100%) brightness(0.8)",
          }}
          transition={{ duration: 0.3 }}
          style={{
            width: isActive ? '3rem' : '2.2rem',
            height: isActive ? '3rem' : '2.2rem',
          }}
        >
          <img 
            src={icon} 
            alt={t(label)}
            className="max-w-full max-h-full object-contain"
            style={{ width: '100%', height: '100%' }}
          />
        </motion.div>
        
        <motion.span
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 5 }}
          exit={{ opacity: 0, y: 5 }}
          className="text-xs font-semibold text-white text-center text-outline z-20 mt-1"
          style={{
            textShadow:
              "-1px -1px 0 rgba(0,0,0,0.7), 1px -1px 0 rgba(0,0,0,0.7), -1px 1px 0 rgba(0,0,0,0.7), 1px 1px 0 rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,0.5)",
          }}
        >
          {t(label)}
        </motion.span>
      </motion.button>
    </div>
  )
}

export default React.memo(TabButton)

