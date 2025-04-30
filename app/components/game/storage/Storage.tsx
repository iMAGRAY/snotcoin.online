"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"
import Image from "next/image"
import { useTranslation } from "../../../i18n"
import { useGameState, useGameDispatch } from "../../../contexts/game/hooks"
import { X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useFarcaster } from "../../../contexts/FarcasterContext"

type StoragePageProps = {}

const Storage: React.FC = () => {
  const { t } = useTranslation()
  const gameState = useGameState()
  const gameDispatch = useGameDispatch()
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const router = useRouter()
  const { sdkUser } = useFarcaster()

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveSection(null)
      }
    }
    window.addEventListener("keydown", handleEsc)

    return () => {
      window.removeEventListener("keydown", handleEsc)
    }
  }, [])

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden">
      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0" 
        style={{ backgroundImage: "url('/images/storage/background/storage-background.webp')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a2b3d]/90 via-[#2a3b4d]/80 to-[#3a4c62]/70 z-10" />

      <LayoutGroup>
        <motion.div
          className="relative z-20 overflow-y-auto h-full pb-24"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          layout
        >
          {/* Storage Card */}
          <motion.div
            className="bg-gradient-to-br from-[#3a5c82]/80 to-[#4a7a9e]/80 shadow-lg border-y border-[#5889ae]/50 backdrop-blur-sm w-full overflow-hidden mt-10"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            layout
          >
            {/* Storage Header */}
            <motion.div className="flex flex-col items-center mb-6" layout>
              <motion.div className="w-full" layout>
                {/* 12 ячеек в сетке 4x3 */}
                <div className="grid grid-cols-4 sm:grid-cols-4 grid-rows-3 sm:grid-rows-3 gap-x-0 gap-y-2 w-full px-0 pb-0 mt-4 place-items-center max-w-2xl mx-auto">
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <motion.div
                      key={idx}
                      className="bg-gray-700/80 backdrop-blur-sm border-2 border-white/30 
                      rounded-xl overflow-hidden shadow-lg shadow-black/60 hover:shadow-xl 
                      transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95 
                      relative flex flex-col aspect-[4/5] w-full max-w-[4.8rem] sm:max-w-[5.8rem] md:max-w-[7.3rem]"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {/* Глянцевый эффект */}
                      <div className="absolute inset-0 z-0 overflow-hidden rounded-xl">
                        {/* Диагональный блик */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent"></div>
                        
                        {/* Тонкая верхняя подсветка */}
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/60"></div>
                        
                        {/* Тонкая нижняя тень */}
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/30"></div>
                      </div>
                      
                      {/* Контент ячейки */}
                      <div className="relative flex-grow w-full h-full flex items-center justify-center">
                        <span className="text-white opacity-70 font-semibold">{idx + 1}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Разделитель */}
          <div className="w-full h-1 bg-gradient-to-r from-[#5889ae]/30 via-[#a8c7e1]/50 to-[#5889ae]/30 my-8 shadow-md"></div>

          {/* Второй бар с карточками (100 ячеек) */}
          <motion.div
            className="bg-gradient-to-br from-[#3a5c82]/80 to-[#4a7a9e]/80 shadow-lg border-y border-[#5889ae]/50 backdrop-blur-sm w-full overflow-hidden"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            layout
          >
            <motion.div className="flex flex-col items-center mb-6 py-4" layout>
              <motion.div className="w-full" layout>
                {/* 100 ячеек в сетке 10x10 */}
                <div className="grid grid-cols-4 sm:grid-cols-4 grid-rows-25 sm:grid-rows-25 gap-x-0 gap-y-2 w-full px-0 pb-0 mt-4 place-items-center max-w-2xl mx-auto">
                  {Array.from({ length: 100 }).map((_, idx) => (
                    <motion.div
                      key={`second-grid-${idx}`}
                      className="bg-gray-700/80 backdrop-blur-sm border-2 border-white/30 
                      rounded-xl overflow-hidden shadow-lg shadow-black/60 hover:shadow-xl 
                      transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95 
                      relative flex flex-col aspect-[4/5] w-full max-w-[4.8rem] sm:max-w-[5.8rem] md:max-w-[7.3rem]"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {/* Упрощенный глянцевый эффект */}
                      <div className="absolute inset-0 z-0 overflow-hidden rounded-xl">
                        {/* Диагональный блик */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent"></div>
                        
                        {/* Тонкая верхняя подсветка */}
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/60"></div>
                        
                        {/* Тонкая нижняя тень */}
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/30"></div>
                      </div>
                      
                      {/* Контент ячейки */}
                      <div className="relative flex-grow w-full h-full flex items-center justify-center">
                        <span className="text-white opacity-70 font-semibold text-xs">{idx + 1}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      </LayoutGroup>

      {/* Modal */}
      <AnimatePresence>
        {activeSection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setActiveSection(null)
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-gray-800/95 to-gray-900/95 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative border border-yellow-500/20 shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-sm"
            >
              <motion.button
                className="absolute top-4 right-4 text-gray-400 hover:text-yellow-400 p-2 rounded-full bg-gray-700/50 hover:bg-gray-600/50 transition-colors border border-gray-600/50"
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveSection(null)
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X size={24} />
              </motion.button>
              <h2 className="text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 mb-6">
                {t(activeSection || "")}
              </h2>
              {/* Модальное содержимое будет здесь */}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back button */}
      <motion.button
        onClick={() => router.back()}
        className="absolute bottom-4 right-4 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {t("back")}
      </motion.button>
    </div>
  )
}

export default Storage

