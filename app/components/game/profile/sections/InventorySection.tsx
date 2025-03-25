"use client"

import type React from "react"
import { useState } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "../../../../contexts/TranslationContext"

const InventorySection: React.FC = () => {
  const { t } = useTranslation()
  const inventorySize = 20
  const [inventory] = useState<(string | null)[]>(Array(inventorySize).fill(null))

  return (
    <motion.div
      className="text-white space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <h4 className="font-bold text-xl mb-3 text-[#6899be]">Inventory</h4>
      <div className="grid grid-cols-4 gap-2">
        {inventory.map((item, index) => (
          <motion.div
            key={index}
            className="bg-gray-700/50 rounded-lg p-2 aspect-square flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 * index }}
          >
            {item ? (
              <span className="text-center text-sm break-words">{item}</span>
            ) : (
              <span className="text-gray-500 text-xs">Empty</span>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

export default InventorySection

