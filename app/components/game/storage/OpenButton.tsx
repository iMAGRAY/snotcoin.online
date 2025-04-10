"use client"

import React from "react"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import { useTranslation } from "../../../i18n"
import type { TranslationKeys } from "../../../i18n/types/translationTypes"

// Определяем тип Chest непосредственно в файле
interface Chest {
  id: string;
  name: string;
  description?: string;
  image: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  cost: number;
  requiredSnot: number; 
  contents: {
    min: number;
    max: number;
  };
  reward?: number;
}

interface OpenButtonProps {
  chest: Chest
  currentSnot: number
}

export const OpenButton: React.FC<OpenButtonProps> = React.memo(({ chest, currentSnot }) => {
  const canOpen = currentSnot >= chest.requiredSnot
  const { t } = useTranslation()

  return (
    <motion.button
      disabled={true}
      className={`w-full relative bg-gradient-to-b from-gray-400 to-gray-500
        text-white text-lg font-bold py-4 px-2 rounded-xl 
        shadow-[inset_0_-4px_0_rgba(0,0,0,0.2)] 
        disabled:opacity-60 disabled:cursor-not-allowed 
        overflow-hidden group transition-all duration-300`}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <span className="relative z-10 flex flex-col items-center justify-center tracking-wide">
        <span className="text-gray-200">{t("open")}</span>
        <span className="text-xs font-normal mt-1 text-gray-300">
          {`${chest.requiredSnot.toFixed(chest.id === "1" ? 2 : 0)} SNOT - ${t(chest.description as keyof TranslationKeys)}`}
        </span>
      </span>
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
    </motion.button>
  )
})

OpenButton.displayName = "OpenButton"

