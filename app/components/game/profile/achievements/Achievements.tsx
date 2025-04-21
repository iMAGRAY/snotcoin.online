"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { useTranslation } from "../../../../i18n"
import { useGameState } from "../../../../contexts/game/hooks"

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: "laboratory" | "storage" | "general"
  condition: (gameState: ReturnType<typeof useGameState>) => boolean
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: "welcome",
    name: "Welcome",
    description: "Log in to the game for the first time",
    icon: "/achievements/welcome.png",
    category: "general",
    condition: () => true,
  },
  {
    id: "collector",
    name: "Collector",
    description: "Collect your first snots",
    icon: "/achievements/collector.png",
    category: "laboratory",
    condition: (gameState) => gameState.inventory.snot > 0,
  },
  {
    id: "storage_upgrade",
    name: "Storage Upgrade",
    description: "Upgrade your storage container",
    icon: "/achievements/storage_upgrade.png",
    category: "storage",
    condition: (gameState) => (gameState.containerLevel || 0) > 1,
  },
  {
    id: "collect100coins",
    name: "Coin Collector",
    description: "Collect 100 KingCoins",
    icon: "/achievements/coin_collector.png",
    category: "general",
    condition: (gameState) => gameState.inventory.snotCoins >= 100,
  },
]

const Achievements: React.FC = () => {
  const { t } = useTranslation()
  const gameState = useGameState()
  const [selectedCategory, setSelectedCategory] = useState<Achievement["category"] | "all">("all")

  const filteredAchievements = ACHIEVEMENTS.filter(
    (achievement) => selectedCategory === "all" || achievement.category === selectedCategory,
  )

  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-b from-gray-900 to-black p-2 sm:p-4 overflow-hidden">
      <h2 className="text-2xl sm:text-3xl font-bold text-center text-emerald-400 mb-2 sm:mb-4">{t("achievements")}</h2>

      <div className="flex flex-wrap justify-center gap-2 mb-2 sm:mb-4">
        {(["all", "laboratory", "storage", "general"] as const).map((category) => (
          <motion.button
            key={category}
            className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm ${
              selectedCategory === category ? "bg-emerald-500 text-white" : "bg-gray-700 text-gray-300"
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedCategory(category)}
          >
            {t(category)}
          </motion.button>
        ))}
      </div>

      <div className="grid flex-grow grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 overflow-y-auto">
        <AnimatePresence>
          {filteredAchievements.map((achievement) => (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`bg-gray-800 rounded-lg p-3 sm:p-4 flex items-center space-x-3 sm:space-x-4 ${
                achievement.condition(gameState) ? "border-2 border-emerald-500" : "border-2 border-gray-700 opacity-50"
              }`}
            >
              <div className="relative h-28 w-28 mb-3">
                <Image
                  src={achievement.icon || "/placeholder.svg"}
                  alt={achievement.name}
                  fill
                  sizes="7rem"
                  style={{ objectFit: "contain" }}
                  quality={100}
                  className={achievement.condition(gameState) ? "" : "grayscale"}
                />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-emerald-400">{t(achievement.name)}</h3>
                <p className="text-xs sm:text-sm text-gray-400">{t(achievement.description)}</p>
              </div>
              {achievement.condition(gameState) && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-emerald-500 rounded-full p-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-white"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default React.memo(Achievements)

