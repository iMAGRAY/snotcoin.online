"use client"

import type React from "react"
import { motion } from "framer-motion"
import { Trophy } from "lucide-react"
import { useTranslation } from "../../../../contexts/TranslationContext"
import type { AchievementCategory } from "../../../../types/profile-types"

const achievements: AchievementCategory[] = [
  {
    category: "Collection",
    items: [
      { name: "Snot Novice", description: "Collect your first SNOT", points: 5, completed: true },
      { name: "Snot Enthusiast", description: "Collect 1,000 SNOT", points: 10, completed: true },
      { name: "Snot Master", description: "Collect 1,000,000 SNOT", points: 50, completed: false },
      { name: "Snot Billionaire", description: "Collect 1,000,000,000 SNOT", points: 100, completed: false },
    ],
  },
  {
    category: "Upgrades",
    items: [
      { name: "Container Upgrade", description: "Upgrade your container for the first time", points: 5, completed: true },
      { name: "Storage Expert", description: "Reach container level 10", points: 25, completed: false },
      { name: "Storage Master", description: "Max out your container capacity", points: 50, completed: false },
    ],
  },
  // ... other categories
]

const AchievementsSection: React.FC = () => {
  const { t } = useTranslation()

  const totalPoints = achievements.reduce(
    (total, category) =>
      total + category.items.reduce((catTotal, item) => catTotal + (item.completed ? item.points : 0), 0),
    0,
  )

  return (
    <motion.div className="text-white space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-r from-[#4a7a9e] to-[#5889ae] rounded-xl p-4 mb-6 shadow-lg"
      >
        <h3 className="text-2xl font-bold text-center">Total Achievement Score</h3>
        <p className="text-4xl font-bold text-center text-yellow-300 mt-2">{totalPoints} points</p>
      </motion.div>

      {achievements.map((category, categoryIndex) => (
        <motion.div
          key={category.category}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * categoryIndex }}
        >
          <h4 className="font-bold text-xl mb-3 text-[#6899be]">{category.category} Achievements</h4>
          <ul className="space-y-3">
            {category.items.map((item, itemIndex) => (
              <motion.li
                key={item.name}
                className={`bg-gradient-to-br from-[#3a5c82] to-[#4a7a9e] rounded-xl p-4 shadow-md ${item.completed ? "opacity-100" : "opacity-70"}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * categoryIndex + 0.05 * itemIndex }}
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-grow">
                    <span className="text-lg font-semibold text-white">{item.name}</span>
                    <p className="text-sm text-gray-300 mt-1">{item.description}</p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="text-yellow-300 font-bold text-lg">{item.points} pts</span>
                    {item.completed && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2 + 0.1 * categoryIndex + 0.05 * itemIndex }}
                        className="mt-2"
                      >
                        <Trophy className="w-6 h-6 text-yellow-400" />
                      </motion.div>
                    )}
                  </div>
                </div>
                <div className="mt-2 w-full bg-[#2a3b4d] rounded-full h-2">
                  <motion.div
                    className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full"
                    style={{ width: item.completed ? "100%" : "0%" }}
                    initial={{ width: 0 }}
                    animate={{ width: item.completed ? "100%" : "0%" }}
                    transition={{ duration: 1, delay: 0.5 + 0.1 * categoryIndex + 0.05 * itemIndex }}
                  />
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      ))}
    </motion.div>
  )
}

export default AchievementsSection

