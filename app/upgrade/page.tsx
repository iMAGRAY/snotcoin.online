"use client"

import React, { useCallback, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Zap, Database, ChevronUp, Coins } from "lucide-react"
import { useRouter } from "next/navigation"
import { useGameState, useGameDispatch } from "../contexts"
import { useTranslation } from "../i18n"
import { formatSnotValue } from "../utils/formatters"
import { calculateContainerUpgradeCost, calculateFillingSpeedUpgradeCost } from "../utils/formatters"
import Image from "next/image"
import { ICONS } from '../constants/uiConstants'
import InteractiveBall from "../components/effects/InteractiveBall"
import { UPGRADE_VALUES } from '../constants/gameConstants'

const calculateContainerCapacity = (level: number): number => {
  const safeLevel = Math.max(1, Math.min(level, UPGRADE_VALUES.containerCapacity.length));
  
  const capacity = UPGRADE_VALUES.containerCapacity[safeLevel - 1];
  
  return typeof capacity === 'number' ? capacity : 1;
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
        className="bg-gradient-to-br from-[#3a5c82]/80 to-[#4a7a9e]/80 p-6 rounded-2xl shadow-lg border border-[#5889ae]/50 backdrop-blur-sm mb-6 relative overflow-hidden"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#5889ae] to-[#3a5c82] opacity-10 rounded-bl-full" />
        <div className="flex items-center mb-4">
          <div className="mr-4 text-[#5889ae] bg-[#5889ae]/10 p-3 rounded-full border border-[#5889ae]/20">{icon}</div>
          <h3 className="text-2xl font-bold text-white">{title}</h3>
        </div>
        <p className="text-gray-300 mb-4 text-sm">{description}</p>
        <div className="flex justify-between items-center mb-4 bg-black/20 rounded-xl p-3 border border-[#5889ae]/5">
          <span className="text-gray-400">
            {t("currentLevel")}: <span className="text-white font-bold text-lg">{currentLevel}</span>
          </span>
          <span className="text-gray-400">
            {t("upgradeCost")}:
            <span className="ml-2 bg-[#5889ae]/10 px-2 py-1 rounded-lg text-[#5889ae] font-bold text-lg border border-[#5889ae]/20">
              {formatSnotValue(cost)}
            </span>
          </span>
        </div>
        <div className="flex justify-between items-center mb-4 bg-black/20 rounded-xl p-3 border border-[#5889ae]/5">
          <span className="text-gray-400">
            {t("currentEffect")}: <span className="text-white font-bold text-lg">{currentEffect}</span>
          </span>
          <span className="text-gray-400">
            {t("nextEffect")}: <span className="text-[#5889ae] font-bold text-lg">{nextEffect}</span>
          </span>
        </div>
        <motion.button
          onClick={handleUpgrade}
          disabled={!canAfford || isUpgrading}
          className={`w-full h-16 rounded-xl relative text-white text-xl font-bold flex items-center justify-center p-0 shadow-lg overflow-hidden border-2 ${
            canAfford && !isUpgrading
              ? "bg-gradient-to-b from-[#5889ae] to-[#3a5c82] hover:from-[#6899be] hover:to-[#4a6a92] border-[#5889ae]"
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
            <div className="absolute inset-0 rounded-xl" style={{ boxShadow: "0 0 25px 8px rgba(88,137,174,0.8)" }} />
          )}
        </motion.button>
      </motion.div>
    )
  },
)

UpgradeButton.displayName = "UpgradeButton"

const UpgradePageContent: React.FC = React.memo(() => {
  const gameState = useGameState()
  const gameDispatch = useGameDispatch()

  const { t } = useTranslation()
  const router = useRouter()
  const [showUpgradeEffect, setShowUpgradeEffect] = React.useState(false)

  const capacityCost = useMemo(() => calculateContainerUpgradeCost(gameState?.inventory?.containerCapacity ?? 1), [gameState?.inventory?.containerCapacity])
  const speedCost = useMemo(() => calculateFillingSpeedUpgradeCost(gameState.fillingSpeed || 1), [gameState.fillingSpeed])

  const handleBack = useCallback(() => {
    gameDispatch(prevState => ({
      ...prevState,
      _activeTab: "laboratory"
    }));
    router.push("/")
  }, [gameDispatch, router])

  const handleCapacityUpgrade = useCallback(() => {
    if (gameState.inventory?.snotCoins >= capacityCost) {
      gameDispatch(prevState => {
        const newLevel = (prevState.inventory?.containerCapacityLevel || 1) + 1;
        return {
          ...prevState,
          inventory: {
            ...prevState.inventory,
            containerCapacity: calculateContainerCapacity(newLevel),
            containerCapacityLevel: newLevel,
            snotCoins: (prevState.inventory?.snotCoins || 0) - capacityCost
          }
        };
      });
    }
  }, [gameState.inventory?.snotCoins, gameDispatch, capacityCost, calculateContainerCapacity])

  const handleSpeedUpgrade = useCallback(() => {
    if (gameState.inventory?.snotCoins !== undefined && gameState.inventory.snotCoins >= speedCost) {
      gameDispatch(prevState => {
        const currentLevel = prevState.inventory?.fillingSpeedLevel || 1;
        const newLevel = currentLevel + 1;
        return {
          ...prevState,
          inventory: {
            ...prevState.inventory,
            fillingSpeed: calculateFillingSpeed(newLevel),
            fillingSpeedLevel: newLevel,
            snotCoins: (prevState.inventory?.snotCoins || 0) - speedCost
          }
        };
      });
      setShowUpgradeEffect(true)
      setTimeout(() => setShowUpgradeEffect(false), 1000)
    }
  }, [gameState.inventory?.snotCoins, gameDispatch, speedCost, calculateFillingSpeed])

  useEffect(() => {
    router.prefetch('/')
  }, [router])

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-[#1a2b3d] to-[#2a3b4d] text-white">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-[#3a5c82] via-[#4a7a9e] to-[#3a5c82] p-3 flex items-center justify-between shadow-lg sticky top-0 z-10 border-b border-[#5889ae]/50"
      >
        <motion.button
          onClick={handleBack}
          className="relative bg-gradient-to-b from-[#3a5c82] to-[#4a7a9e] text-white font-bold py-2 px-4 rounded-xl shadow-lg overflow-hidden border-2 border-[#5889ae] transition-all duration-300"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="relative z-10 flex items-center justify-center tracking-wider">
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t("back")}
          </span>
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
        </motion.button>
        <div className="flex items-center gap-2 bg-gradient-to-r from-[#3a5c82]/90 to-[#4a7a9e]/90 rounded-full pl-1 pr-3 py-1 border border-[#5889ae]/20 shadow-[inset_0_1px_4px_rgba(0,0,0,0.4)]">
          <div className="relative w-8 h-8">
            <InteractiveBall width={32} height={32} />
          </div>
          <span className="text-lg font-bold text-white">{formatSnotValue(gameState.inventory?.snotCoins ?? 0)}</span>
        </div>
      </motion.div>
      <div className="flex-grow overflow-y-auto p-4">
        <div className="max-w-md mx-auto space-y-6 pb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <UpgradeButton
              title={t("containerCapacity")}
              description={t("increaseContainerCapacity")}
              currentLevel={gameState.containerLevel || 1}
              currentEffect={`${gameState.inventory?.containerCapacity || 1}`}
              nextEffect={calculateContainerCapacity((gameState.containerLevel || 1) + 1)}
              cost={capacityCost}
              onUpgrade={handleCapacityUpgrade}
              canAfford={gameState.inventory?.snotCoins >= capacityCost}
              icon={<Database className="w-8 h-8" />}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <UpgradeButton
              title={t("fillingSpeedUpgrade")}
              description={t("fillingSpeedDescription")}
              cost={speedCost}
              currentLevel={gameState.inventory?.fillingSpeedLevel || 1}
              currentEffect={(24 * 60 * 60 * (gameState.fillingSpeed || 1)).toFixed(2)}
              nextEffect={((gameState.inventory?.fillingSpeedLevel || 1) + 1).toFixed(2)}
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
            <div className="bg-[#3a5c82]/90 border border-[#5889ae]/50 rounded-lg px-6 py-3 flex items-center shadow-lg">
              <Coins className="w-8 h-8 mr-3 text-[#5889ae]" />
              <span className="text-xl font-bold text-[#5889ae]">{t("upgradeSuccess")}!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

UpgradePageContent.displayName = "UpgradePageContent"

const UpgradePage: React.FC = () => {
  const router = useRouter()
  
  useEffect(() => {
    router.prefetch('/')
  }, [router])
  
  return <UpgradePageContent />
}

export default UpgradePage

