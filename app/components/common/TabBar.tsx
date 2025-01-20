"use client"

import React, { useMemo, useCallback } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { cn } from "../../lib/utils"
import { useGameState, useGameDispatch } from "../../contexts/GameContext"
import { useTranslation } from "../../contexts/TranslationContext"
import type { GameState } from "../../types/gameTypes"

type TabId = Exclude<GameState["activeTab"], "settings">

interface TabInfo {
  id: TabId
  icon: string
  label: string
}

interface TabBarProps {
  // Удалены неиспользуемые пропсы, чтобы избежать лишних предупреждений
  closeSettings: () => void
}

const tabs: TabInfo[] = [
  {
    id: "fusion",
    icon: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/MergeMicrobs-GR0sBHgLJziNPoeN99cxLVylxd9qTB.webp",
    label: "fusionTab",
  },
  {
    id: "laboratory",
    icon: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Laboratory-QLz6DMBJOgQKMAmu5qw5gmlqCUOl1j.webp",
    label: "laboratoryTab",
  },
  {
    id: "storage",
    icon: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Storage2-JyGrplmohN4NIozd4co8HOR9y3EgYW.webp",
    label: "storageTab",
  },
  {
    id: "games",
    icon: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Games%201-3A8eefFvVUlzA0Qdy7uqKDbTHJ71Al.webp",
    label: "gamesTab",
  },
  {
    id: "profile",
    icon: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Profile-usMOz4iK8UmmhBOtQJI34mXX8uXQhT.webp",
    label: "profile",
  },
]

const TabButton: React.FC<TabInfo & { isActive: boolean; onClick: () => void }> = React.memo(
  ({ icon, label, isActive, onClick }) => {
    const { t } = useTranslation()

    return (
      <motion.button
        onClick={onClick}
        className={cn(
          "relative h-full flex flex-col items-center justify-between overflow-visible transition-all duration-300 isolate pointer-events-auto",
          isActive
            ? "w-[28%] before:absolute before:inset-0 before:bg-gradient-to-t before:from-[#3a5c82] before:via-[#4a7a9e] before:to-[#5889ae] before:z-10 before:shadow-[inset_0_1px_3px_rgba(255,255,255,0.3),0_-2px_4px_rgba(0,0,0,0.1)]"
            : "w-[24%] bg-transparent",
        )}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <motion.div
          animate={{
            scale: isActive ? 1.3 : 1,
            y: isActive ? -14 : 0,
          }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 30,
          }}
          className="relative z-30 mt-1 isolate select-none"
        >
          <Image
            src={icon || ""}
            width={44}
            height={44}
            alt={t(label)}
            className={`w-11 h-11 drop-shadow-glow-sm relative z-30 ${
              isActive ? "" : "opacity-50 grayscale"
            } pointer-events-none`}
          />
        </motion.div>
        {isActive && (
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="text-xs font-semibold text-white absolute bottom-1 left-0 right-0 text-center text-outline z-20"
            style={{
              textShadow:
                "-1px -1px 0 rgba(0,0,0,0.7), 1px -1px 0 rgba(0,0,0,0.7), -1px 1px 0 rgba(0,0,0,0.7), 1px 1px 0 rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,0.5)",
            }}
          >
            {t(label)}
          </motion.span>
        )}
      </motion.button>
    )
  },
)

TabButton.displayName = "TabButton"

const TabBar: React.FC<TabBarProps> = ({ closeSettings }) => {
  const { activeTab } = useGameState()
  const dispatch = useGameDispatch()

  const handleTabClick = useCallback(
    (id: TabId) => {
      closeSettings()
      dispatch({ type: "SET_ACTIVE_TAB", payload: id })
    },
    [dispatch, closeSettings],
  )

  const tabButtons = useMemo(
    () =>
      tabs.map((tab) => (
        <TabButton key={tab.id} {...tab} isActive={activeTab === tab.id} onClick={() => handleTabClick(tab.id)} />
      )),
    [activeTab, handleTabClick],
  )

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full bg-gradient-to-t from-[#1a2b3d] via-[#2a3b4d] to-[#3a4c62] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1),0_-2px_4px_-1px_rgba(0,0,0,0.06),inset_0_2px_4px_rgba(255,255,255,0.1)] border-t-2 border-[#4a7a9e] backdrop-blur-md relative z-50">
      <div className="flex justify-between h-16 max-w-md mx-auto px-4">{tabButtons}</div>
    </nav>
  )
}

export default React.memo(TabBar)

