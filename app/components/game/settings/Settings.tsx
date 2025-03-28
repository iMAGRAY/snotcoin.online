"use client"

import React, { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, X, GamepadIcon, MapIcon, CoinsIcon, InfoIcon, LogOut } from "lucide-react"
import { useGameState, useGameDispatch } from "../../../contexts/game/hooks"
import { useTranslation } from "../../../i18n"
import GamesPage from "./GamesPage"
import RoadmapPage from "./RoadmapPage"
import TokenomicPage from "./TokenomicPage"
import AboutPage from "./AboutPage"
import { useRouter } from "next/navigation"
import MenuItem from "../../../components/ui/menu-item"
import { authService } from '../../../services/auth/authService'
import Link from "next/link"
import Image from "next/image"
import { ICONS } from "../../../constants/uiConstants"

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

const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const gameState = useGameState()
  const { language, t } = useTranslation()
  const [currentPage, setCurrentPage] = useState<"main" | "games" | "roadmap" | "tokenomic" | "about">("main")
  const router = useRouter()
  const dispatch = useGameDispatch()

  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleLogout = useCallback(() => {
    authService.logout()

    // Dispatch a custom event to notify other components
    window.dispatchEvent(new Event("logout"))

    // Reset game state
    dispatch({ type: "RESET_GAME_STATE" })

    // Clear user data
    dispatch({ type: "SET_USER", payload: null })

    // Close settings
    onClose()

    // Redirect to the home page, which will show the authentication screen
    router.push("/")
  }, [dispatch, router, onClose])

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
                      <div className="relative">
                        <div className="w-full bg-[#4a7a9e] text-white text-sm rounded-lg px-3 py-2 flex justify-between items-center">
                          <span>
                            {t("language")}: {language.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <MenuItem
                          icon={<GamepadIcon size={20} />}
                          text={t("game")}
                          onClick={() => setCurrentPage("games")}
                          className="hover:bg-[#4a7a9e]/50"
                          textClassName="text-white"
                        />
                        <MenuItem
                          icon={<MapIcon size={20} />}
                          text={t("roadmap")}
                          onClick={() => setCurrentPage("roadmap")}
                          className="hover:bg-[#4a7a9e]/50"
                          textClassName="text-white"
                        />
                        <MenuItem
                          icon={<CoinsIcon size={20} />}
                          text={t("tokenomic")}
                          onClick={() => setCurrentPage("tokenomic")}
                          className="hover:bg-[#4a7a9e]/50"
                          textClassName="text-white"
                        />
                        <MenuItem
                          icon={<InfoIcon size={20} />}
                          text={t("about")}
                          onClick={() => setCurrentPage("about")}
                          className="hover:bg-[#4a7a9e]/50"
                          textClassName="text-white"
                        />
                        <MenuItem 
                          icon={<LogOut size={20} />} 
                          text={t("logout")} 
                          onClick={handleLogout}
                          className="hover:bg-[#4a7a9e]/50"
                          textClassName="text-white"
                        />
                      </div>

                      <div className="flex justify-center space-x-4 mt-4">
                        <Link 
                          href="https://twitter.com/SnotcoinGame"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center bg-black text-white px-4 py-3 rounded-lg mb-2"
                        >
                          <Image 
                            src={ICONS.SOCIAL_NETWORKS.X}
                            alt="X"
                            width={24}
                            height={24}
                            className="w-6 h-6"
                          />
                          <span className="ml-2">Twitter</span>
                        </Link>
                        <Link
                          href="https://warpcast.com/~/channel/snotcoin" 
                          target="_blank"
                          rel="noopener noreferrer" 
                          className="flex items-center bg-purple-600 text-white px-4 py-3 rounded-lg mb-2"
                        >
                          <Image 
                            src={ICONS.SOCIAL_NETWORKS.WARPCAST}
                            alt="Warpcast"
                            width={24}
                            height={24}
                            className="w-6 h-6"
                          />
                          <span className="ml-2">Warpcast</span>
                        </Link>
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

