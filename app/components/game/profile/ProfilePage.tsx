"use client"

import React, { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"
import Image from "next/image"
import { useTranslation } from "../../../contexts/TranslationContext"
import { useGameState, useGameDispatch } from "../../../contexts/GameContext"
import { X, Star, BarChart2, Package, Award, Cog, Calendar } from "lucide-react"
import { Tab } from "@headlessui/react"
import type { ProfileSection } from "../../../types/profile-types"
import Resources from "../../common/Resources"
import { useRouter } from "next/navigation"
import Settings from "../settings/Settings"
import { authStore } from '../../auth/AuthenticationWindow'
import { ICONS } from "../../../constants/uiConstants"

// Import sections
import StatsSection from "./sections/StatsSection"
import InventorySection from "./sections/InventorySection"
import AchievementsSection from "./sections/AchievementsSection"

// Import modals
import SettingsModal from "./modals/SettingsModal"

type ProfilePageProps = {}

const ProfilePage: React.FC = () => {
  const { t } = useTranslation()
  const gameState = useGameState()
  const gameDispatch = useGameDispatch()
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const router = useRouter()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const state = { activeTab: "profile" } // Added state for activeTab

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

  const getUserDisplayName = () => {
    if (!gameState.user) return "Player"

    const { displayName, username, farcaster_displayname, farcaster_username } = gameState.user
    if (displayName || farcaster_displayname) {
      return displayName || farcaster_displayname || ""
    }
    return username || farcaster_username || "Player"
  }

  const handleLogout = useCallback(() => {
    authStore.clearAuthData()
    
    gameDispatch({ type: "SET_USER", payload: null })
    gameDispatch({ type: "RESET_GAME_STATE" })
    
    const logoutEvent = new Event('logout')
    window.dispatchEvent(logoutEvent)
    
    router.push("/")
  }, [gameDispatch, router])

  const handleSettingsClick = () => {
    setIsSettingsOpen(true)
  }

  const profileSectionsData: ProfileSection[] = [
    { label: "stats", icon: BarChart2, color: "from-indigo-500 to-indigo-700", content: <StatsSection /> },
    { label: "inventory", icon: Package, color: "from-pink-500 to-pink-700", content: <InventorySection /> },
    { label: "achievements", icon: Award, color: "from-amber-500 to-amber-700", content: <AchievementsSection /> },
  ]

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{
          backgroundImage:
            `url('${ICONS.PROFILE.BACKGROUND}')`,
          filter: "blur(5px)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a2b3d] via-[#2a3b4d] to-[#3a4c62] opacity-90 z-10" />

      <LayoutGroup>
        <motion.div
          className="relative z-20 p-6 space-y-6 overflow-y-auto h-full pb-24"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          layout
        >
          {/* Profile Card */}
          <motion.div
            className="bg-gradient-to-br from-[#3a5c82]/80 to-[#4a7a9e]/80 rounded-2xl p-6 shadow-lg border border-[#5889ae]/50 backdrop-blur-sm"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            layout
          >
            {/* Profile Header */}
            <motion.div className="flex items-center mb-6" layout>
              <motion.div
                className="w-20 h-20 rounded-full overflow-hidden mr-4 border-4 border-emerald-500 shadow-lg flex-shrink-0"
                whileHover={{ scale: 1.05, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                layout
              >
                <Image
                  src={
                    gameState.user?.pfp || gameState.user?.farcaster_pfp ||
                    ICONS.PROFILE.AVATAR.DEFAULT
                  }
                  alt="Profile"
                  width={80}
                  height={80}
                  className="object-cover w-full h-full"
                />
              </motion.div>
              <motion.div className="flex-grow" layout>
                <motion.h2
                  className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 mb-2"
                  layout
                >
                  {getUserDisplayName()}
                </motion.h2>
                <motion.div className="flex items-center justify-between" layout>
                  <div className="flex items-center">
                    <Star className="w-5 h-5 text-yellow-400 mr-2" />
                    <motion.p className="text-[#6899be] text-lg font-semibold" layout>
                      FID: {gameState.user?.farcaster_fid || gameState.user?.fid || "N/A"}
                    </motion.p>
                  </div>
                </motion.div>
                <motion.div className="flex items-center mt-2" layout>
                  <Calendar className="w-5 h-5 text-emerald-400 mr-2" />
                  <motion.p className="text-[#6899be] text-lg font-semibold" layout>
                    {t("consecutiveLoginDays")}: {gameState.consecutiveLoginDays}
                  </motion.p>
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Buttons */}
          <div className="mt-4">
            <motion.button
              onClick={handleSettingsClick}
              className="w-full bg-gradient-to-r from-[#3a5c82] to-[#4a7a9e] text-white py-3 px-4 rounded-xl hover:from-[#4a7a9e] hover:to-[#5889ae] transition-all duration-300 flex items-center justify-center space-x-3 group relative overflow-hidden shadow-lg border border-[#5889ae]/20"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#5889ae]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Cog className="w-5 h-5 mr-2" />
              <span className="font-semibold">{t("settings")}</span>
            </motion.button>
          </div>

          {/* Tabs */}
          <Tab.Group as={React.Fragment} key="profile-tabs">
            <Tab.List className="flex space-x-2 rounded-xl bg-[#3a5c82]/50 p-2">
              {profileSectionsData.map((section) => (
                <Tab
                  key={section.label}
                  className={({ selected }) =>
                    `w-full rounded-lg py-3 text-sm font-medium leading-5 text-white transition-all duration-300
                    ${
                      selected
                        ? "bg-gradient-to-r from-[#4a7a9e] to-[#5889ae] shadow-lg"
                        : "text-blue-100 hover:bg-white/[0.12] hover:text-white"
                    }`
                  }
                >
                  <div className="flex items-center justify-center">
                    {React.createElement(section.icon, { className: "w-5 h-5 mr-2" })}
                    {t(section.label)}
                  </div>
                </Tab>
              ))}
            </Tab.List>
            <Tab.Panels className="mt-4">
              {profileSectionsData.map((section, idx) => (
                <Tab.Panel
                  key={idx}
                  className={`rounded-xl bg-[#3a5c82]/50 p-4
                    ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2`}
                >
                  {section.content}
                </Tab.Panel>
              ))}
            </Tab.Panels>
          </Tab.Group>
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
                {t(activeSection)}
              </h2>
              {activeSection === "settings" ? <SettingsModal /> : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {isSettingsOpen && <Settings onClose={() => setIsSettingsOpen(false)} />}

      {/* Add Logout button */}
      <motion.button
        onClick={handleLogout}
        className="absolute bottom-4 right-4 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {t("logout")}
      </motion.button>
    </div>
  )
}

ProfilePage.displayName = "ProfilePage"

export default ProfilePage

