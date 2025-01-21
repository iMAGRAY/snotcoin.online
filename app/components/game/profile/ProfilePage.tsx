"use client"

import React, { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"
import Image from "next/image"
import { useTranslation } from "../../../contexts/TranslationContext"
import { useGameState, useGameDispatch } from "../../../contexts/GameContext"
import { X, Star, BarChart2, Package, Award, TypeIcon as type, LucideIcon } from "lucide-react"
import { Tab } from "@headlessui/react"
import type { ProfileSection } from "../../../types/profile-types"
import Resources from "../../common/Resources"
import WalletBar from "./WalletBar"
import { supabase } from "../../../utils/supabase"
import type { User } from "../../../types/gameTypes"

// Import sections
import StatsSection from "./sections/StatsSection"
import InventorySection from "./sections/InventorySection"
import AchievementsSection from "./sections/AchievementsSection"

// Import modals
import DepositModal from "./modals/DepositModal"
import WithdrawModal from "./withdraw/WithdrawModal"
import SettingsModal from "./modals/SettingsModal"

type ProfilePageProps = {}

const ProfilePage: React.FC<ProfilePageProps> = () => {
  const { t } = useTranslation()
  const gameState = useGameState()
  const gameDispatch = useGameDispatch()
  const wallet = gameState.wallet
  const generateWallet = async () => {
    /* Implement wallet generation logic */
  }
  const getEthBalance = async (address: string) => {
    /* Implement balance fetching logic */
  }
  const [activeSection, setActiveSection] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!wallet) {
        await generateWallet()
      }
      if (gameState.user) {
        try {
          const { data: dbUser, error } = await supabase
            .from("users")
            .select("*, inventories(*), game_progress(*), wallets(*)")
            .eq("telegram_id", gameState.user.telegram_id)
            .single()

          if (error) throw error

          await gameDispatch({
            type: "LOAD_GAME_STATE",
            payload: {
              inventory: dbUser.inventories,
              ...dbUser.game_progress,
              wallet: dbUser.wallets[0],
            },
          })
        } catch (error) {
          console.error("Error loading user data:", error)
        }
      }
    }
    loadData()
  }, [wallet, generateWallet, gameState.user, gameDispatch])

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
    if (wallet && wallet.address) {
      getEthBalance(wallet.address).catch((error: Error) => {
        console.error("Failed to get ETH balance:", error)
        // You might want to show an error message to the user here
      })
    }
  }, [wallet, getEthBalance])

  const getUserDisplayName = () => {
    if (gameState.user) {
      if (gameState.user.first_name && gameState.user.last_name) {
        return `${gameState.user.first_name} ${gameState.user.last_name}`
      } else if (gameState.user.first_name) {
        return gameState.user.first_name
      } else if (gameState.user.username) {
        return gameState.user.username
      }
    }
    return "Anonymous Player"
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
            "url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/profile-background-Rl9Hy7Uy5Ib5Ue5Ue5Ue5Ue5Ue5Ue.jpg')",
          filter: "blur(5px)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a2b3d] via-[#2a3b4d] to-[#3a4c62] opacity-90 z-10" />

      <LayoutGroup>
        <motion.div
          className="relative z-20 p-6 space-y-6 overflow-y-auto h-full pb-20"
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
                    gameState.user?.photo_url ||
                    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Profile-usMOz4iK8UmmhBOtQJI34mXX8uXQhT.webp" ||
                    "/placeholder.svg" ||
                    "/placeholder.svg" ||
                    "/placeholder.svg" ||
                    "/placeholder.svg" ||
                    "/placeholder.svg" ||
                    "/placeholder.svg" ||
                    "/placeholder.svg"
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
                      Level {gameState.highestLevel || 1}
                    </motion.p>
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>

            {/* Balance Bars */}
            <div className="mt-4">
              {/* SnotCoin Bar */}
              <motion.div className="h-12 bg-gradient-to-r from-[#3a5c82] to-[#4a7a9e] rounded-xl border border-[#5889ae]/30 shadow-md flex items-center justify-between px-2">
                <div className="flex-1">
                  <Resources
                    showStatusPanel={false}
                    activeTab="profile"
                    hideEnergy={true}
                    hideSettings={true}
                    showOnlySnotCoin={true}
                    isSettingsOpen={false}
                    setIsSettingsOpen={() => {}}
                    closeSettings={() => {}}
                    snotCoins={gameState.inventory.snotCoins}
                    snot={gameState.inventory.snot}
                    energy={gameState.energy}
                    maxEnergy={gameState.maxEnergy}
                    isVisible={true}
                  />
                </div>
                <div className="flex space-x-2 ml-2">
                  <motion.button
                    onClick={() => setActiveSection("deposit")}
                    className="bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-bold py-2 px-3 rounded-md shadow-md hover:from-green-600 hover:to-green-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {t("Deposit")}
                  </motion.button>
                  <motion.button
                    onClick={() => setActiveSection("withdraw")}
                    className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-sm font-bold py-2 px-3 rounded-md shadow-md hover:from-yellow-600 hover:to-yellow-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {t("Claim")}
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* WalletBar */}
          <WalletBar setActiveSection={setActiveSection} />

          {/* Tabs */}
          <Tab.Group as={React.Fragment} key="profile-tabs">
            <Tab.List className="flex space-x-2 rounded-xl bg-[#3a5c82]/50 p-2">
              {profileSectionsData.map((section) => (
                <Tab
                  key={section.label}
                  className={({ selected }: { selected: boolean }) =>
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
              {activeSection === "deposit" ? (
                <DepositModal userEthAddress={wallet?.address} />
              ) : activeSection === "withdraw" ? (
                <WithdrawModal />
              ) : activeSection === "settings" ? (
                <SettingsModal />
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

ProfilePage.displayName = "ProfilePage"

export default ProfilePage

