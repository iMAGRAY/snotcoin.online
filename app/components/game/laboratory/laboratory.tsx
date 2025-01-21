"use client"

import React, { useReducer, useCallback, useMemo, useState, useRef, useEffect } from "react"
import { useGameState, useGameDispatch, useGameContext } from "../../../contexts/GameContext"
import { localReducer, initialLocalState } from "./laboratory-state"
import BackgroundImage from "./background-image"
import UpgradeButton from "./UpgradeButton"
import CollectButton from "./CollectButton"
import { useTranslation } from "../../../contexts/TranslationContext"
import CollectOptions from "./CollectOptions"
import { motion, AnimatePresence } from "framer-motion"
import { formatSnotValue } from "../../../utils/gameUtils"
import Resources from "../../common/Resources"

type NotificationType = {
  message: string
  amount: number
  totalSnot: number
  type: "success" | "failure" | "warning"
} | null

const Laboratory: React.FC = () => {
  const gameState = useGameState()
  const gameDispatch = useGameDispatch()
  const { t } = useTranslation()
  const [localState, localDispatch] = useReducer(localReducer, initialLocalState)
  const [showCollectOptions, setShowCollectOptions] = useState(false)
  const [notification, setNotification] = useState<NotificationType>(null)
  const [isContainerClicked, setIsContainerClicked] = useState(false)
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  //const { dispatch } = useGameContext() //Removed unused destructuring

  const handleContainerClick = useCallback(() => {
    if (gameState.energy > 0) {
      const increaseAmount = 0.0005
      const newContainerSnot = Math.min(
        gameState.containerSnot + increaseAmount,
        gameState.inventory.Cap || gameState.Cap,
      )

      gameDispatch({ type: "SET_RESOURCE", resource: "containerSnot", payload: newContainerSnot })
      gameDispatch({ type: "CONSUME_ENERGY", payload: 1 })

      localDispatch({ type: "ADD_FLYING_NUMBER", payload: { id: Date.now(), value: increaseAmount } })

      requestAnimationFrame(() => {
        setIsContainerClicked((prev) => !prev)
      })
      //dispatch({ type: "SAVE_GAME_STATE" }) //moved to handleCollect
    } else {
      setNotification({
        message: t("notEnoughEnergy"),
        amount: 0,
        totalSnot: gameState.inventory.snot,
        type: "warning",
      })
    }
  }, [
    gameState.energy,
    gameState.containerSnot,
    gameState.inventory.Cap,
    gameState.Cap,
    gameState.inventory.snot,
    gameDispatch,
    localDispatch,
    t,
    //dispatch, //removed from dependency array
  ])

  useEffect(() => {
    const containerElement = document.getElementById("container-element")
    if (!containerElement) return

    let lastTapTime = 0
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      const currentTime = Date.now()
      if (currentTime - lastTapTime < 300) {
        handleContainerClick()
      }
      lastTapTime = currentTime
    }

    containerElement.addEventListener("touchstart", handleTouchStart, { passive: false })

    return () => {
      containerElement.removeEventListener("touchstart", handleTouchStart)
    }
  }, [handleContainerClick])

  const handleCollect = useCallback(
    async (amount: number, success: boolean) => {
      setShowCollectOptions(false)
      setNotification(null)
      if (success) {
        const newTotalSnot = gameState.inventory.snot + amount
        gameDispatch({ type: "ADD_TO_INVENTORY", item: "snot", amount })
        setNotification({
          message: t("snotCollected"),
          amount: Number.parseFloat(formatSnotValue(amount, 4)),
          totalSnot: Number.parseFloat(formatSnotValue(newTotalSnot, 4)),
          type: "success",
        })
        const { dispatch } = useGameContext() //moved dispatch here
        dispatch({
          type: "CREATE_GAME_TRANSACTION",
          payload: { type: "SNOT_GAIN", amount, description: "Laboratory collection" },
        })
      } else {
        setNotification({
          message: t("collectionFailed"),
          amount: 0,
          totalSnot: gameState.inventory.snot,
          type: "failure",
        })
      }
      gameDispatch({ type: "SET_RESOURCE", resource: "containerSnot", payload: 0 })
      const { dispatch } = useGameContext() //moved dispatch here
      dispatch({ type: "SAVE_GAME_STATE" })

      // Automatically clear the notification after 3 seconds
      setTimeout(() => {
        setNotification(null)
      }, 3000)
    },
    [gameDispatch, gameState.inventory.snot, t],
  )

  const handleCollectClick = useCallback(() => {
    setNotification(null)
    if (gameState?.containerSnot > 0) {
      setShowCollectOptions(true)
    } else {
      setNotification({
        message: t("containerEmpty"),
        amount: 0,
        totalSnot: gameState?.inventory?.snot,
        type: "warning",
      })
      setTimeout(() => setNotification(null), 3000)
    }
  }, [gameState?.containerSnot, gameState?.inventory?.snot, t])

  const resourcesProps = useMemo(
    () => ({
      isVisible: true,
      isSettingsOpen: false,
      setIsSettingsOpen: () => {},
      closeSettings: () => {},
      showStatusPanel: true,
      activeTab: "laboratory",
      snotCoins: gameState.inventory.snotCoins,
      snot: gameState.inventory.snot,
      energy: gameState.energy,
      maxEnergy: gameState.maxEnergy,
    }),
    [gameState.inventory.snotCoins, gameState.inventory.snot, gameState.energy, gameState.maxEnergy],
  )

  const containerSnotValue = useMemo(() => formatSnotValue(gameState?.containerSnot, 4), [gameState?.containerSnot])

  return (
    <div
      className="h-full w-full relative overflow-hidden select-none"
      style={{ WebkitUserDrag: "none" } as React.CSSProperties}
    >
      <BackgroundImage
        store={gameState}
        dispatch={gameDispatch}
        localState={localState}
        localDispatch={localDispatch}
        onContainerClick={handleContainerClick}
        allowContainerClick={true}
        isContainerClicked={isContainerClicked}
        id="container-element"
        containerSnotValue={containerSnotValue}
      />
      <Resources {...resourcesProps} />
      <AnimatePresence mode="wait">
        {!showCollectOptions ? (
          <motion.div
            key="mainButtons"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 z-50 px-4 pb-4"
          >
            <div className="flex flex-col items-center relative">
              <div className="flex w-full space-x-4 h-14 -mt-10">
                <CollectButton
                  onCollect={handleCollectClick}
                  containerSnot={gameState?.containerSnot}
                  className="pointer-events-auto flex-grow"
                />
                <UpgradeButton className="pointer-events-auto" />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="collectOptions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 z-50 px-4 pb-4"
          >
            <CollectOptions
              containerSnot={gameState?.containerSnot}
              onCollect={handleCollect}
              onCancel={() => setShowCollectOptions(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-full 
              ${
                notification.type === "success"
                  ? "bg-gradient-to-r from-emerald-400 to-green-500"
                  : notification.type === "failure"
                    ? "bg-gradient-to-r from-red-400 to-rose-500"
                    : "bg-gradient-to-r from-amber-400 to-yellow-500"
              } 
              text-white font-bold z-[9999] shadow-lg flex items-center space-x-2 whitespace-nowrap text-sm pointer-events-none`}
            style={{
              boxShadow:
                notification.type === "success"
                  ? "0 0 15px rgba(16, 185, 129, 0.6), 0 0 30px rgba(16, 185, 129, 0.3)"
                  : notification.type === "failure"
                    ? "0 0 15px rgba(239, 68, 68, 0.6), 0 0 30px rgba(239, 68, 68, 0.3)"
                    : "0 0 15px rgba(234, 179, 8, 0.6), 0 0 30px rgba(234, 179, 8, 0.3)",
              maxWidth: "90%",
            }}
          >
            <motion.span
              className="text-sm font-semibold"
              initial={{ y: -5 }}
              animate={{ y: 0 }}
              transition={{ type: "spring", stiffness: 500, delay: 0.1 }}
            >
              {notification.message}
            </motion.span>
            {notification.type === "success" && (
              <motion.div
                className="text-xs font-extrabold flex items-center bg-white/20 px-2 py-1 rounded-full"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, delay: 0.2 }}
              >
                <span className="text-yellow-300 mr-1">+</span>
                <span className="text-white">{formatSnotValue(notification.amount, 4)}</span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

Laboratory.displayName = "Laboratory"

export default React.memo(Laboratory)

