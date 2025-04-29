"use client"

import React, { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"
import Image from "next/image"
import { useTranslation } from "../../../i18n"
import { useGameState, useGameDispatch } from "../../../contexts/game/hooks"
import { X, Star, BarChart2, Package, Award, Cog, Calendar } from "lucide-react"
import { Tab } from "@headlessui/react"
import type { ProfileSection } from "../../../types/profile-types"
import { useRouter } from "next/navigation"
import Settings from "../settings/Settings"
import { authService } from '../../../services/auth/authService'
import { ICONS } from "../../../constants/uiConstants"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs"
import { FaChartLine, FaStore, FaTrophy } from "react-icons/fa"
import { useFarcaster } from "../../../contexts/FarcasterContext"
import { createInitialGameState } from '../../../constants/gameConstants'

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
  const { sdkUser } = useFarcaster()
  const [imageError, setImageError] = useState(false)

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

  useEffect(() => {
    // Отладочная информация о данных пользователя
    console.log('🚀 UserData в профиле:', gameState.user)
    if (gameState.user?.metadata) {
      console.log('🚀 Metadata пользователя:', JSON.stringify(gameState.user.metadata, null, 2))
    }
    console.log('🚀 SDK User Data:', sdkUser)
  }, [gameState.user, sdkUser])

  const getUserDisplayName = () => {
    if (sdkUser?.displayName) return sdkUser.displayName
    if (!gameState.user) return "Player"

    const { displayName, username, farcaster_displayname, farcaster_username } = gameState.user
    if (displayName || farcaster_displayname) {
      return displayName || farcaster_displayname || ""
    }
    return username || farcaster_username || "Player"
  }

  const getUserUsername = () => {
    if (sdkUser?.username) return sdkUser.username
    if (!gameState.user) return ""
    return gameState.user?.farcaster_username || gameState.user?.username || ""
  }

  const getUserFid = () => {
    if (sdkUser?.fid) return sdkUser.fid
    if (!gameState.user) return "N/A"
    return gameState.user?.farcaster_fid || gameState.user?.fid || "N/A"
  }

  const getUserProfileImage = () => {
    // Если уже была ошибка загрузки, возвращаем локальное изображение
    if (imageError) return "/images/profile/avatar/default.webp"
    
    // Проверяем данные в разных местах
    if (sdkUser?.pfpUrl) return sdkUser.pfpUrl
    if (!gameState.user) return ""
    return gameState.user?.pfp || gameState.user?.farcaster_pfp || ""
  }

  const getUserBio = () => {
    // Проверяем данные только в metadata пользователя
    if (!gameState.user?.metadata) return null;
    return gameState.user.metadata.bio as string || null;
  }

  const getUserLocation = () => {
    // Проверяем данные только в metadata пользователя
    if (!gameState.user?.metadata) return null;
    return gameState.user.metadata.location as string || null;
  }

  const handleLogout = useCallback(() => {
    authService.logout()
    
    gameDispatch((prev) => ({ ...prev, user: null }));
    gameDispatch((prev) => {
      // Создаем новое состояние, используя функциональный формат
      const initialState = createInitialGameState(prev._userId);
      return initialState;
    });
    
    const logoutEvent = new Event('logout')
    window.dispatchEvent(logoutEvent)
    
    router.push("/")
  }, [gameDispatch, router])

  const handleSettingsClick = () => {
    setIsSettingsOpen(true)
  }

  const handleImageError = () => {
    console.log("Ошибка загрузки изображения профиля, использую запасное изображение")
    setImageError(true)
  }

  const profileSectionsData: ProfileSection[] = [
    { label: "inventory", icon: Package, color: "from-pink-500 to-pink-700", content: <InventorySection /> },
  ]

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden">
      {/* Background */}
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
            <motion.div className="flex flex-col sm:flex-row items-center mb-6" layout>
              <motion.div
                className="w-24 h-24 rounded-full overflow-hidden mr-4 border-4 border-emerald-500 shadow-lg flex-shrink-0 bg-gray-700 flex items-center justify-center mb-4 sm:mb-0"
                whileHover={{ scale: 1.05, rotate: 5 }}
                whileTap={{ scale: 0.95 }}
                layout
              >
                {getUserProfileImage() ? (
                  <Image
                    src={getUserProfileImage()}
                    alt="Profile"
                    width={96}
                    height={96}
                    style={{ objectFit: "cover" }}
                    className="w-full h-full"
                    onError={handleImageError}
                    unoptimized={imageError}
                    loading="eager"
                  />
                ) : (
                  <div className="text-4xl font-bold text-white">
                    {getUserDisplayName().charAt(0).toUpperCase()}
                  </div>
                )}
              </motion.div>
              <motion.div className="flex-grow text-center sm:text-left" layout>
                <motion.h2
                  className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 mb-2"
                  layout
                >
                  {getUserDisplayName()}
                </motion.h2>
                {getUserUsername() && (
                  <motion.p
                    className="text-[#a8c7e1] text-base mb-2"
                    layout
                  >
                    @{getUserUsername()}
                  </motion.p>
                )}
                <motion.div className="flex items-center justify-center sm:justify-start mb-2" layout>
                  <div className="flex items-center">
                    <Star className="w-5 h-5 text-yellow-400 mr-2" />
                    <motion.p className="text-[#6899be] text-lg font-semibold" layout>
                      FID: {getUserFid()}
                    </motion.p>
                  </div>
                </motion.div>
                <motion.div className="flex items-center justify-center sm:justify-start mt-2" layout>
                  <Calendar className="w-5 h-5 text-emerald-400 mr-2" />
                  <motion.p className="text-[#6899be] text-lg font-semibold" layout>
                    {t("consecutiveLoginDays")}: {gameState.consecutiveLoginDays}
                  </motion.p>
                </motion.div>
              </motion.div>
            </motion.div>
            
            {/* Farcaster Data Details */}
            {(getUserFid() !== "N/A" || sdkUser) && (
              <motion.div 
                className="mt-4 pt-4 border-t border-[#5889ae]/30"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <div className="grid grid-cols-1 gap-2 text-[#a8c7e1]">
                  {/* Биография пользователя */}
                  {getUserBio() && (
                    <div className="flex flex-col">
                      <span className="text-sm text-[#6899be]">{t("bio")}</span>
                      <p className="text-[#a8c7e1]">{getUserBio()}</p>
                    </div>
                  )}
                  
                  {/* Местоположение */}
                  {getUserLocation() && (
                    <div className="flex flex-col">
                      <span className="text-sm text-[#6899be]">{t("location")}</span>
                      <p className="text-[#a8c7e1]">{getUserLocation()}</p>
                    </div>
                  )}
                  
                  {/* Подписчики */}
                  {(gameState.user?.metadata?.followerCount > 0 || gameState.user?.metadata?.profile?.followerCount > 0) && (
                    <div className="flex flex-col">
                      <span className="text-sm text-[#6899be]">{t("followers")}</span>
                      <p className="text-[#a8c7e1]">{gameState.user?.metadata?.followerCount || gameState.user?.metadata?.profile?.followerCount}</p>
                    </div>
                  )}
                  
                  {/* Подписки */}
                  {(gameState.user?.metadata?.followingCount > 0 || gameState.user?.metadata?.profile?.followingCount > 0) && (
                    <div className="flex flex-col">
                      <span className="text-sm text-[#6899be]">{t("following")}</span>
                      <p className="text-[#a8c7e1]">{gameState.user?.metadata?.followingCount || gameState.user?.metadata?.profile?.followingCount}</p>
                    </div>
                  )}
                  
                  {/* Верификация */}
                  {(gameState.user?.verified || 
                   (gameState.user?.metadata?.verifications && gameState.user.metadata.verifications.length > 0)) && (
                    <div className="flex items-center mt-1">
                      <div className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-md text-sm flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {t("verified")}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
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
                    `w-full rounded-2xl py-3 text-sm font-medium leading-5 text-white transition-all duration-300
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

