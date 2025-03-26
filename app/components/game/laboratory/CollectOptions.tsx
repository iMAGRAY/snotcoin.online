"use client"

import React, { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "../../../i18n"

interface CollectOptionsProps {
  containerSnot: number
  onCollect: (amount: number, success: boolean) => void
  onCancel: () => void
}

const CollectOptions: React.FC<CollectOptionsProps> = ({ containerSnot, onCollect, onCancel }) => {
  const { t } = useTranslation()

  const options = [
    { label: "50%", value: 0.5, successRate: 1, subText: "Safe" },
    { label: "100%", value: 1, successRate: 0.75, subText: "Occasional" },
    { label: "x2", value: 2, successRate: 0.35, subText: "Seldom" },
    { label: "x4", value: 4, successRate: 0.16, subText: "Miracle" },
  ]

  const handleCollect = (multiplier: number, successRate: number) => {
    const isSuccess = Math.random() < successRate
    const amount = isSuccess ? containerSnot * multiplier : 0
    onCollect(amount, isSuccess)
  }

  return (
    <div className="flex flex-col space-y-2 px-4 w-full max-w-md mx-auto">
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <motion.button
            key={option.label}
            onClick={() => handleCollect(option.value, option.successRate)}
            className={`
              relative w-full bg-gradient-to-r text-white font-bold py-4 rounded-xl 
              shadow-lg overflow-hidden border-2 transition-all duration-300
              ${
                option.subText === "Safe"
                  ? "from-blue-400 to-blue-600 border-blue-300 hover:from-blue-500 hover:to-blue-700"
                  : option.subText === "Occasional"
                    ? "from-green-400 to-green-600 border-green-300 hover:from-green-500 hover:to-green-700"
                    : option.subText === "Seldom"
                      ? "from-yellow-400 to-yellow-600 border-yellow-300 hover:from-yellow-500 hover:to-yellow-700"
                      : "from-orange-400 to-orange-600 border-orange-300 hover:from-orange-500 hover:to-orange-700"
              }
            `}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="relative z-10 flex flex-col items-center justify-center tracking-wide">
              <span className="text-lg">{option.label}</span>
              <span className="text-xs">{t(option.subText)}</span>
            </span>
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
          </motion.button>
        ))}
      </div>
      <motion.button
        onClick={onCancel}
        className="relative w-full bg-gradient-to-r from-gray-400 to-gray-600 text-white text-lg font-bold py-4 rounded-xl shadow-lg overflow-hidden border-2 border-gray-300 hover:from-gray-500 hover:to-gray-700 transition-all duration-300"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span className="relative z-10 flex items-center justify-center tracking-wide">{t("cancel")}</span>
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
      </motion.button>
    </div>
  )
}

export default React.memo(CollectOptions)

