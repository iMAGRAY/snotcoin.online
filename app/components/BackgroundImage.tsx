"use client"

import React, { useReducer, useCallback, useMemo, useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, ArrowUpCircle } from "lucide-react"
import Image from "next/image"
import Resources from "./common/Resources"
import { useGameState, useGameDispatch } from "../contexts/GameContext"
import { animated, useSpring } from "@react-spring/web"
import { formatSnotValue } from "../utils/formatters"
import { useRouter } from "next/navigation"
import { useTranslation, type TFunction } from "next-i18next"
import type { GameState } from "../types/gameTypes"

interface LocalState {
  showColorButtons: boolean
  collectionResult: "success" | "fail" | null
  collectedAmount: number | null
  lastClickAmount: number | null
  lastClickPosition: { x: number; y: number } | null
  isContainerClicked: boolean
  flyingNumbers: { id: number; value: number }[]
}

type LocalAction =
  | { type: "SET_LOCAL_STATE"; payload: Partial<LocalState> }
  | { type: "ADD_FLYING_NUMBER"; payload: { id: number; value: number } }
  | { type: "REMOVE_FLYING_NUMBER"; payload: number }

const initialLocalState: LocalState = {
  showColorButtons: false,
  collectionResult: null,
  collectedAmount: null,
  lastClickAmount: null,
  lastClickPosition: null,
  isContainerClicked: false,
  flyingNumbers: [],
}

function localReducer(state: LocalState, action: LocalAction): LocalState {
  switch (action.type) {
    case "SET_LOCAL_STATE":
      return { ...state, ...action.payload }
    case "ADD_FLYING_NUMBER":
      return { ...state, flyingNumbers: [...state.flyingNumbers, action.payload] }
    case "REMOVE_FLYING_NUMBER":
      return { ...state, flyingNumbers: state.flyingNumbers.filter((fn) => fn.id !== action.payload) }
    default:
      return state
  }
}

const collectButtons = [
  { color: "from-green-400 to-green-500", text: "100%", riskText: "Safe", multiplier: 1, successChance: 0.95 },
  { color: "from-yellow-400 to-yellow-500", text: "150%", riskText: "Risky", multiplier: 1.5, successChance: 0.7 },
  { color: "from-red-400 to-red-500", text: "200%", riskText: "Very risky", multiplier: 2, successChance: 0.4 },
  { color: "from-purple-400 to-purple-500", text: "400%", riskText: "Extreme", multiplier: 4, successChance: 0.19 },
]

const FlyingNumber: React.FC<{ id: number; value: number }> = React.memo(({ id, value }) => {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      animate={{ opacity: 0, y: -70, scale: 1.2, filter: "blur(2px)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[70] pointer-events-none select-none"
    >
      <span
        className="text-green-400 font-bold text-4xl drop-shadow-lg"
        style={{
          textShadow: "0 0 15px rgba(34, 197, 94, 0.7), 0 0 30px rgba(34, 197, 94, 0.5)",
          WebkitTextStroke: "2px black",
        }}
      >
        +{formatSnotValue(value)}
      </span>
    </motion.div>
  )
})

FlyingNumber.displayName = "FlyingNumber"

const BackgroundImage: React.FC = React.memo(() => {
  const { t } = useTranslation("common") as { t: TFunction }
  const router = useRouter()
  const state = useGameState()
  const dispatch = useGameDispatch()
  const {
    inventory,
    energy = 0,
    maxEnergy = 100,
    containerSnot = 0,
    containerCapacity = 10,
    fillingSpeed = 1 / (24 * 60 * 60),
    energyRecoveryTime = 0,
    fusionGameActive = false,
    snotCollected = 0,
    fusionGamesAvailable = 0,
    lastFusionGameTime = 0,
  } = state as GameState
  const { snotCoins = 0, snot = 0 } = inventory || {}
  const [localState, localDispatch] = useReducer(localReducer, initialLocalState)
  const [lastClickTime, setLastClickTime] = useState<number>(0)
  const [flyingNumberId, setFlyingNumberId] = useState<number>(0)
  const [containerScale, setContainerScale] = useSpring(() => ({ scale: 1 }))

  const consumeEnergy = useCallback(() => {
    if (energy >= 1) {
      dispatch({ type: "CONSUME_ENERGY", payload: 1 })
      return true
    }
    return false
  }, [energy, dispatch])

  const handleContainerClick = useCallback(() => {
    const now = Date.now()
    if (now - lastClickTime > 100 && consumeEnergy()) {
      setLastClickTime(now)
      const amountToAdd = fillingSpeed
      const newContainerSnot = Math.min(containerSnot + amountToAdd, containerCapacity)

      dispatch({ type: "SET_RESOURCE", resource: "containerSnot", payload: newContainerSnot })

      if (localState.flyingNumbers.length < 5) {
        const newId = flyingNumberId + 1
        setFlyingNumberId(newId)
        localDispatch({ type: "ADD_FLYING_NUMBER", payload: { id: newId, value: amountToAdd } })

        setTimeout(() => {
          localDispatch({ type: "REMOVE_FLYING_NUMBER", payload: newId })
        }, 500)
      }

      setContainerScale({ scale: 1.02 })
      setTimeout(() => setContainerScale({ scale: 1 }), 50)
    }
  }, [
    consumeEnergy,
    dispatch,
    containerSnot,
    containerCapacity,
    fillingSpeed,
    lastClickTime,
    flyingNumberId,
    localState.flyingNumbers.length,
    setContainerScale,
  ])

  const handleCollectClick = useCallback(() => {
    if (containerSnot >= containerCapacity) {
      localDispatch({ type: "SET_LOCAL_STATE", payload: { showColorButtons: true } })
    } else {
      console.log(t("containerNotFullYet"))
    }
  }, [containerSnot, containerCapacity, t])

  const handleColorSelect = useCallback(
    (button: (typeof collectButtons)[0]) => {
      localDispatch({ type: "SET_LOCAL_STATE", payload: { showColorButtons: false } })

      const isSuccess = Math.random() < button.successChance
      const amountToCollect = isSuccess
        ? Math.floor(
            button.multiplier === 1
              ? Math.floor(containerSnot)
              : Math.round(Math.floor(containerSnot) * button.multiplier),
          )
        : 0

      if (isSuccess) {
        dispatch({ type: "ADD_TO_INVENTORY", item: "snot", amount: amountToCollect })
        dispatch({ type: "SET_RESOURCE", resource: "containerSnot", payload: 0 })
        localDispatch({
          type: "SET_LOCAL_STATE",
          payload: {
            collectionResult: "success",
            collectedAmount: amountToCollect,
          },
        })
      } else {
        dispatch({ type: "SET_RESOURCE", resource: "containerSnot", payload: 0 })
        localDispatch({
          type: "SET_LOCAL_STATE",
          payload: {
            collectionResult: "fail",
            collectedAmount: null,
          },
        })
      }

      setTimeout(() => {
        localDispatch({
          type: "SET_LOCAL_STATE",
          payload: {
            collectionResult: null,
            collectedAmount: null,
          },
        })
      }, 2000)
    },
    [containerSnot, dispatch],
  )

  const buttonBaseStyles = useMemo(
    () => `
    w-full relative bg-gradient-to-b text-white text-xl font-bold py-4 rounded-xl 
    shadow-lg overflow-hidden border-2 transition-all duration-300
  `,
    [],
  )

  const renderColorButtons = useMemo(
    () => (
      <motion.div
        className="grid grid-cols-2 gap-2 relative"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
      >
        {collectButtons.map((button, index) => (
          <motion.button
            key={index}
            onClick={() => handleColorSelect(button)}
            className={`relative bg-gradient-to-b ${button.color} text-white font-bold py-2 px-3 rounded-xl shadow-[inset_0_-8px_0_rgba(0,0,0,0.3),0_0_4px_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-[inset_0_-4px_0_rgba(0,0,0,0.3),0_0_4px_rgba(0,0,0,0.3)] overflow-hidden border-2 border-black`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span
              className="relative z-10 flex flex-col items-center justify-center"
              style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.3)" }}
            >
              <span className="text-lg">{t(button.text)}</span>
              <span className="text-xs">{t(button.riskText)}</span>
            </span>
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
          </motion.button>
        ))}
      </motion.div>
    ),
    [handleColorSelect, t],
  )

  const renderCollectButton = useMemo(
    () => (
      <motion.button
        onClick={handleCollectClick}
        disabled={containerSnot < containerCapacity}
        className={`${buttonBaseStyles} ${
          containerSnot >= containerCapacity
            ? "from-yellow-400 to-yellow-600 border-yellow-300 hover:from-yellow-500 hover:to-yellow-700"
            : "from-gray-400 to-gray-500 border-gray-400"
        }`}
        whileHover={containerSnot >= containerCapacity ? { scale: 1.05 } : {}}
        whileTap={containerSnot >= containerCapacity ? { scale: 0.95 } : {}}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
      >
        <span
          className="relative z-10 flex items-center justify-center tracking-wider"
          style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.5)" }}
        >
          {t("collect")}
          <Sparkles className="ml-2 h-5 w-5" />
        </span>
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
        {containerSnot >= containerCapacity && (
          <div
            className="absolute inset-0 rounded-xl"
            style={{ boxShadow: "inset 0 0 20px 5px rgba(255,215,0,0.5)" }}
          />
        )}
      </motion.button>
    ),
    [buttonBaseStyles, containerSnot, containerCapacity, handleCollectClick, t],
  )

  const renderUpgradeButton = useMemo(
    () => (
      <motion.button
        onClick={() => router.push("/upgrade")}
        className={`${buttonBaseStyles} from-emerald-400 to-emerald-600 border-emerald-300 hover:from-emerald-500 hover:to-emerald-700`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
      >
        <span
          className="relative z-10 flex items-center justify-center tracking-wider"
          style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.5)" }}
        >
          {t("upgrade")}
          <ArrowUpCircle className="ml-2 h-5 w-5" />
        </span>
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
        <div className="absolute inset-0 rounded-xl" style={{ boxShadow: "inset 0 0 20px 5px rgba(72,187,120,0.5)" }} />
      </motion.button>
    ),
    [buttonBaseStyles, router, t],
  )

  const MemoizedResources = useMemo(
    () => (
      <Resources
        isVisible={true}
        isSettingsOpen={false}
        setIsSettingsOpen={() => {}}
        closeSettings={() => {}}
        activeTab={state.activeTab}
        showStatusPanel={false}
        energy={energy}
        maxEnergy={maxEnergy}
        snot={inventory.snot}
        snotCoins={inventory.snotCoins}
      />
    ),
    [inventory.snotCoins, inventory.snot, energy, maxEnergy, state.activeTab],
  )

  return (
    <div className="h-full w-full relative overflow-hidden">
      {MemoizedResources}
      <div className="absolute inset-0 overflow-hidden z-0">
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/BackGround-roFy2aCmjJeL7dszvygbyQqvdcnGAo.png"
          layout="fill"
          objectFit="cover"
          quality={100}
          priority
          alt="Factory background with green slime"
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative z-20 w-40 h-52">
          <div className="absolute inset-0 bg-black/80 rounded-3xl backdrop-blur-sm border-2 border-gray-800">
            <div className="absolute inset-0 flex items-end justify-center overflow-hidden rounded-3xl">
              <motion.div
                className="w-full transition-all duration-300 ease-in-out"
                style={{
                  height: `${(containerSnot / containerCapacity) * 100}%`,
                  background: "rgb(16, 165, 109)",
                  borderRadius: "0 0 1rem 1rem",
                }}
              />
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <AnimatePresence>
              {localState.collectionResult === null ? (
                <motion.div
                  key="fillLevel"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-black bg-opacity-80 rounded-full pl-3 pr-5 py-2 inline-block"
                >
                  <span className="text-emerald-300 font-bold text-3xl drop-shadow-lg">
                    {isNaN(containerSnot) ? 0 : Math.floor(containerSnot)}
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="collectionResult"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`${localState.collectionResult === "success" ? "bg-green-500" : "bg-red-500"} text-white rounded-full px-4 py-2 inline-block`}
                >
                  <span className="font-bold text-3xl drop-shadow-lg">
                    {localState.collectionResult === "success" ? `+${localState.collectedAmount}` : "Failed"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <animated.div
          className="absolute z-30 w-96 h-96"
          style={{
            transform: containerScale.scale.to((s) => `scale(${s})`),
          }}
          onClick={handleContainerClick}
        >
          <div className="absolute inset-0 z-40 cursor-pointer" />
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Storage-HMzNJvLafbiiSqJM2GUsSKmRlDTugH.png"
            layout="responsive"
            width={100}
            height={100}
            alt="Storage Machine"
            priority
            className="drop-shadow-[0_0_15px_rgba(0,255,0,0.3)]"
          />
          <AnimatePresence>
            {localState.flyingNumbers.map((flyingNumber) => (
              <FlyingNumber key={flyingNumber.id} id={flyingNumber.id} value={flyingNumber.value} />
            ))}
          </AnimatePresence>
        </animated.div>
      </div>
      <div className="absolute bottom-8 left-0 right-0 z-50 px-4">
        <div className="w-full max-w-md mx-auto flex space-x-2">
          <AnimatePresence>
            {localState.showColorButtons ? (
              renderColorButtons
            ) : (
              <>
                <motion.div
                  className="flex-1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {renderCollectButton}
                </motion.div>
                <motion.div
                  className="flex-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  {renderUpgradeButton}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
})

BackgroundImage.displayName = "BackgroundImage"

export default BackgroundImage

