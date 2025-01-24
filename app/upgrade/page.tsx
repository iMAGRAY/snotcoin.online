"use client"

import React, { useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Zap, Database, ChevronUp, Coins } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslation } from "../contexts/TranslationContext"
import { GameProvider, useGameState, useGameDispatch } from "../contexts/GameContext"
import { TranslationProvider } from "../contexts/TranslationContext"
import { formatSnotValue } from "../utils/gameUtils"
import Image from "next/image"

const calculateContainerCapacity = (level: number): number => {
  return level
}

const calculateFillingSpeed = (level: number): number => {
  return level / (24 * 60 * 60)
}

interface UpgradeButtonProps {
  title: string
  description: string
  cost: number
  currentLevel: number
  currentEffect: number | string
  nextEffect: number | string
  onUpgrade: () => void
  canAfford: boolean
  icon: React.ReactNode
}

const UpgradeButton: React.FC<UpgradeButtonProps> = React.memo(
  ({ title, description, cost, currentLevel, currentEffect, nextEffect, onUpgrade, canAfford, icon }) => {
    const { t } = useTranslation()
    const [isUpgrading, setIsUpgrading] = React.useState(false)

    const handleUpgrade = useCallback(() => {
      if (canAfford) {
        setIsUpgrading(true)
        onUpgrade()
        setTimeout(() => setIsUpgrading(false), 1000)
      }
    }, [canAfford, onUpgrade])

    return (
      <motion.div
        className="bg-gradient-to-br from-gray-800/95 to-gray-900/95 p-6 rounded-2xl shadow-lg border border-yellow-500/10 mb-6 relative overflow-hidden backdrop-blur-sm"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 opacity-10 rounded-bl-full" />
        <div className="flex items-center mb-4">
          <div className="mr-4 text-yellow-400 bg-yellow-400/10 p-3 rounded-full border border-yellow-400/20">
            {icon}
          </div>
          <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500">
            {title}
          </h3>
        </div>
        <p className="text-gray-300 mb-4 text-sm">{description}</p>
        <div className="flex justify-between items-center mb-4 bg-black/20 rounded-xl p-3 border border-yellow-500/5">
          <span className="text-gray-400">
            {t("currentLevel")}: <span className="text-white font-bold text-lg">{currentLevel}</span>
          </span>
          <span className="text-gray-400">
            {t("upgradeCost")}:
            <span className="ml-2 bg-yellow-500/10 px-2 py-1 rounded-lg text-yellow-400 font-bold text-lg border border-yellow-500/20">
              {formatSnotValue(cost)}
            </span>
          </span>
        </div>
        <div className="flex justify-between items-center mb-4 bg-black/20 rounded-xl p-3 border border-yellow-500/5">
          <span className="text-gray-400">
            {t("currentEffect")}: <span className="text-white font-bold text-lg">{currentEffect}</span>
          </span>
          <span className="text-gray-400">
            {t("nextEffect")}: <span className="text-emerald-400 font-bold text-lg">{nextEffect}</span>
          </span>
        </div>
        <motion.button
          onClick={handleUpgrade}
          disabled={!canAfford || isUpgrading}
          className={`w-full h-16 rounded-xl relative text-white text-xl font-bold flex items-center justify-center p-0 shadow-lg overflow-hidden border-2 ${
            canAfford && !isUpgrading
              ? "bg-gradient-to-b from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 border-yellow-300"
              : "bg-gradient-to-b from-gray-500 to-gray-600 border-gray-400 opacity-50 cursor-not-allowed"
          }`}
          whileHover={canAfford && !isUpgrading ? { scale: 1.05 } : {}}
          whileTap={canAfford && !isUpgrading ? { scale: 0.95 } : {}}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          aria-label={t("upgradeButton")}
        >
          <AnimatePresence>
            {isUpgrading ? (
              <motion.div
                key="upgrading"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <ChevronUp className="w-8 h-8 text-white animate-bounce" />
              </motion.div>
            ) : (
              <motion.span
                key="upgrade"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="relative z-10 flex items-center justify-center tracking-wider"
              >
                {t("upgrade")}
              </motion.span>
            )}
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
          {canAfford && !isUpgrading && (
            <div className="absolute inset-0 rounded-xl" style={{ boxShadow: "0 0 25px 8px rgba(255,102,0,0.8)" }} />
          )}
        </motion.button>
      </motion.div>
    )
  },
)

UpgradeButton.displayName = "UpgradeButton"

const UpgradePageContent: React.FC = React.memo(() => {
  const { t } = useTranslation()
  const router = useRouter()
  const gameState = useGameState()
  const gameDispatch = useGameDispatch()
  const [showUpgradeEffect, setShowUpgradeEffect] = React.useState(false)

  const capacityCost = useMemo(
    () => Math.floor(100 * Math.pow(1.1, (gameState.containerLevel || 1) - 1)),
    [gameState.containerLevel],
  )
  const speedCost = useMemo(
    () => Math.floor(100 * Math.pow(1.5, gameState.fillingSpeedLevel - 1)),
    [gameState.fillingSpeedLevel],
  )

  const handleBack = useCallback(() => {
    gameDispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" })
    router.push("/")
  }, [gameDispatch, router])

  const handleCapacityUpgrade = useCallback(() => {
    if (gameState.inventory?.snotCoins !== undefined && gameState.inventory.snotCoins >= capacityCost) {
      const newCapacityLevel = Math.min((gameState.containerLevel || 1) + 1, 100)
      gameDispatch({ type: "UPGRADE_CONTAINER_CAPACITY" })
      setShowUpgradeEffect(true)
      setTimeout(() => setShowUpgradeEffect(false), 1000)
    }
  }, [gameState.inventory?.snotCoins, gameState.containerLevel, capacityCost, gameDispatch])

  const handleSpeedUpgrade = useCallback(() => {
    if (gameState.inventory?.snotCoins !== undefined && gameState.inventory.snotCoins >= speedCost) {
      const newSpeedLevel = Math.min(gameState.fillingSpeedLevel + 1, 100)
      gameDispatch({ type: "UPGRADE_FILLING_SPEED" })
      setShowUpgradeEffect(true)
      setTimeout(() => setShowUpgradeEffect(false), 1000)
    }
  }, [gameState.inventory?.snotCoins, gameState.fillingSpeedLevel, speedCost, gameDispatch])

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-gray-900 to-black text-white flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-gray-900 via-gray-800/95 to-gray-900 p-3 flex items-center justify-between shadow-lg sticky top-0 z-10 border-b border-yellow-500/20"
      >
        <div className="flex items-center gap-3">
          <motion.button
            onClick={handleBack}
            className="p-2 rounded-full bg-gradient-to-r from-yellow-600/80 to-yellow-500/80 hover:from-yellow-500/80 hover:to-yellow-400/80 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-50 shadow-lg border border-yellow-500/30"
            whileHover={{ rotate: -10 }}
            whileTap={{ scale: 0.95 }}
            aria-label={t("backButton")}
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </motion.button>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200">
            {t("upgrades")}
          </h1>
        </div>
        <div className="flex items-center gap-2 bg-gradient-to-r from-gray-800/90 to-gray-900/90 rounded-full pl-1 pr-3 py-1 border border-yellow-500/20 shadow-[inset_0_1px_4px_rgba(0,0,0,0.4)]">
          <div className="relative w-8 h-8">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Coin-a2GBTJ75mu1bwG6EaCihxvYEXwcpvy.webp"
              width={32}
              height={32}
              alt={t("snotCoinImage")}
              className="w-8 h-8 drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]"
              priority
            />
          </div>
          <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200">
            {formatSnotValue(gameState.inventory?.snotCoins ?? 0)}
          </span>
        </div>
      </motion.div>
      <div className="flex-grow p-4 overflow-y-auto">
        <div className="max-w-md mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <UpgradeButton
              title={t("containerCapacityUpgrade")}
              description={t("containerCapacityDescription")}
              cost={capacityCost}
              currentLevel={gameState.containerLevel}
              currentEffect={gameState.inventory.containerCapacity}
              nextEffect={gameState.containerLevel + 1}
              onUpgrade={handleCapacityUpgrade}
              canAfford={(gameState.inventory?.snotCoins ?? 0) >= capacityCost}
              icon={<Database className="w-8 h-8" />}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <UpgradeButton
              title={t("fillingSpeedUpgrade")}
              description={t("fillingSpeedDescription")}
              cost={speedCost}
              currentLevel={gameState.fillingSpeedLevel}
              currentEffect={(24 * 60 * 60 * gameState.fillingSpeed).toFixed(2)}
              nextEffect={(gameState.fillingSpeedLevel + 1).toFixed(2)}
              onUpgrade={handleSpeedUpgrade}
              canAfford={(gameState.inventory?.snotCoins ?? 0) >= speedCost}
              icon={<Zap className="w-8 h-8" />}
            />
          </motion.div>
        </div>
      </div>
      <AnimatePresence>
        {showUpgradeEffect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div className="bg-gray-900/90 border border-yellow-500/50 rounded-lg px-6 py-3 flex items-center shadow-lg">
              <Coins className="w-8 h-8 mr-3 text-yellow-400" />
              <span className="text-xl font-bold text-yellow-400">{t("upgradeSuccess")}!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

UpgradePageContent.displayName = "UpgradePageContent"

const UpgradePage: React.FC = () => {
  return (
    <GameProvider>
      <TranslationProvider>
        <UpgradePageContent />
      </TranslationProvider>
    </GameProvider>
  )
}

export default UpgradePage

