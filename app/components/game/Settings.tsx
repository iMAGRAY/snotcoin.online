"use client"

import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Volume2, ChevronDown, X, GamepadIcon, MapIcon, CoinsIcon, InfoIcon } from "lucide-react"
import { XIcon, TelegramIcon } from "../icons/SocialIcons"
import { useGameState, useGameDispatch } from "../../contexts/GameContext"
import { useTranslation } from "../../contexts/TranslationContext"
import GamesPage from "../settings/GamesPage"
import RoadmapPage from "../settings/RoadmapPage"
import TokenomicPage from "../settings/TokenomicPage"
import AboutPage from "../settings/AboutPage"

interface SettingsProps {
  isOpen?: boolean
  onClose: () => void
}

const SettingsToggle: React.FC<{ icon: React.ReactNode; text: string; isOn: boolean; onToggle: () => void }> = ({
  icon,
  text,
  isOn,
  onToggle,
}) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-white text-sm flex items-center space-x-2">
      {icon}
      <span>{text}</span>
    </span>
    <motion.button
      onClick={onToggle}
      className={`w-12 h-6 flex items-center rounded-full p-1 ${isOn ? "bg-emerald-500 justify-end" : "bg-gray-600 justify-start"}`}
    >
      <motion.div
        className="w-4 h-4 bg-white rounded-full shadow-md"
        layout
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
      />
    </motion.button>
  </div>
)

const MenuItem: React.FC<{ icon: React.ReactNode; text: string; onClick: () => void }> = ({ icon, text, onClick }) => (
  <motion.button
    className="flex items-center space-x-2 text-white py-3 px-3 rounded-lg hover:bg-[#4a7a9e]/50 transition-colors w-full text-left"
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
  >
    {React.cloneElement(icon as React.ReactElement, { size: 18 })}
    <span className="text-sm">{text}</span>
  </motion.button>
)

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const gameState = useGameState()
  const dispatch = useGameDispatch()
  const { language, setLanguage, t } = useTranslation()
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [currentPage, setCurrentPage] = useState<"main" | "games" | "roadmap" | "tokenomic" | "about">("main")

  const handleLanguageChange = (lang: "en" | "es" | "fr" | "de" | "ru") => {
    setLanguage(lang)
    setShowLanguageDropdown(false)
  }

  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black bg-opacity-50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleOutsideClick}
    >
      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#1a2b3d] via-[#2a3b4d] to-[#3a4c62] rounded-t-3xl shadow-lg border-t-2 border-[#4a7a9e] overflow-hidden custom-scrollbar"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        style={{ height: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-yellow-400 p-2 rounded-full bg-gray-700/50 hover:bg-gray-600/50 transition-colors border border-gray-600/50"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <X size={24} />
        </motion.button>
        <AnimatePresence mode="wait">
          {(() => {
            switch (currentPage) {
              case "main":
                return (
                  <motion.div
                    key="main"
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 50 }}
                    className="p-4 sm:p-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
                  >
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold text-white">{t("settings")}</h2>
                      <motion.button
                        onClick={onClose}
                        className="p-2 rounded-full bg-[#4a7a9e] text-white hover:bg-[#5889ae] transition-colors duration-200"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <X className="w-6 h-6" />
                      </motion.button>
                    </div>

                    <div className="space-y-6">
                      <SettingsToggle
                        icon={<Volume2 size={20} />}
                        text={t("soundEffects")}
                        isOn={!gameState.isEffectsMuted}
                        onToggle={() => dispatch({ type: "SET_EFFECTS_MUTE", payload: !gameState.isEffectsMuted })}
                      />

                      <div className="relative">
                        <button
                          onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                          className="w-full bg-[#4a7a9e] text-white text-sm rounded-lg px-3 py-2 flex justify-between items-center"
                        >
                          <span>
                            {t("language")}: {language.toUpperCase()}
                          </span>
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${showLanguageDropdown ? "rotate-180" : ""}`}
                          />
                        </button>
                        <AnimatePresence>
                          {showLanguageDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute top-full left-0 right-0 mt-1 bg-[#3a4c62] rounded-lg overflow-hidden shadow-lg z-10"
                            >
                              {["en", "es", "fr", "de", "ru"].map((lang) => (
                                <button
                                  key={lang}
                                  onClick={() => handleLanguageChange(lang as "en" | "es" | "fr" | "de" | "ru")}
                                  className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[#4a7a9e] transition-colors"
                                >
                                  {lang.toUpperCase()}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="space-y-2">
                        <MenuItem
                          icon={<GamepadIcon size={20} />}
                          text={t("game")}
                          onClick={() => setCurrentPage("games")}
                        />
                        <MenuItem
                          icon={<MapIcon size={20} />}
                          text={t("roadmap")}
                          onClick={() => setCurrentPage("roadmap")}
                        />
                        <MenuItem
                          icon={<CoinsIcon size={20} />}
                          text={t("tokenomic")}
                          onClick={() => setCurrentPage("tokenomic")}
                        />
                        <MenuItem
                          icon={<InfoIcon size={20} />}
                          text={t("about")}
                          onClick={() => setCurrentPage("about")}
                        />
                      </div>

                      <div className="flex justify-center space-x-4 mt-4">
                        <motion.a
                          href="#"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-2 bg-[#4a7a9e] rounded-full text-white hover:bg-[#5889ae] transition-colors"
                        >
                          <XIcon className="w-6 h-6" />
                        </motion.a>
                        <motion.a
                          href="#"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-2 bg-[#4a7a9e] rounded-full text-white hover:bg-[#5889ae] transition-colors"
                        >
                          <TelegramIcon className="w-6 h-6" />
                        </motion.a>
                      </div>
                    </div>
                  </motion.div>
                )
              case "games":
                return <GamesPage onBack={() => setCurrentPage("main")} />
              case "roadmap":
                return <RoadmapPage onBack={() => setCurrentPage("main")} />
              case "tokenomic":
                return <TokenomicPage onBack={() => setCurrentPage("main")} />
              case "about":
                return <AboutPage onBack={() => setCurrentPage("main")} />
              default:
                return null
            }
          })()}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

export default React.memo(Settings)

