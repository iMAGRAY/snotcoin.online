"use client"

import React from "react"
import { motion } from "framer-motion"
import { ChevronLeft } from "lucide-react"
import { useTranslation } from "../../../i18n"

interface GamesPageProps {
  onBack: () => void
}

const GamesPage: React.FC<GamesPageProps> = ({ onBack }) => {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="absolute inset-0 bg-gradient-to-t from-[#1a2b3d] via-[#2a3b4d] to-[#3a4c62] p-4 overflow-y-auto h-full"
    >
      <button onClick={onBack} className="mb-4 flex items-center text-white">
        <ChevronLeft size={24} />
        <span>{t("back")}</span>
      </button>
      <h2 className="text-2xl font-bold text-white mb-4">{t("game")}</h2>
      <div className="text-white">
        <p>{t("comingSoon")}</p>
      </div>
    </motion.div>
  )
}

export default GamesPage

