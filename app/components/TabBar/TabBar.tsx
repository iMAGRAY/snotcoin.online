"use client"

import React, { useMemo, useCallback, useEffect } from "react"
import { useGameState, useGameDispatch } from "../../contexts/GameContext"
import type { TabId } from "./types"
import { tabs } from "./constants"
import TabButton from "./TabButton"
import { useTranslation } from "../../contexts/TranslationContext"
import { useRouter } from "next/navigation"

type TabBarProps = {}

const TabBar: React.FC<TabBarProps> = () => {
  const { activeTab } = useGameState()
  const dispatch = useGameDispatch()
  const { t } = useTranslation()
  const router = useRouter()

  // Предварительно загружаем страницу улучшений для быстрого перехода
  useEffect(() => {
    router.prefetch('/upgrade')
  }, [router])

  const handleTabClick = useCallback(
    (id: TabId) => {
      dispatch({ type: "SET_ACTIVE_TAB", payload: id })
    },
    [dispatch],
  )

  const tabButtons = useMemo(
    () =>
      tabs.map((tab) => (
        <TabButton
          key={tab.id}
          id={tab.id}
          icon={tab.icon}
          label={tab.label}
          isActive={activeTab === tab.id}
          onClick={() => handleTabClick(tab.id)}
        />
      )),
    [activeTab, handleTabClick],
  )

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 w-full bg-gradient-to-t from-[#1a2b3d] via-[#2a3b4d] to-[#3a4c62] border-t-2 border-[#4a7a9e] backdrop-blur-md z-50 pb-safe"
      aria-label={t("mainNavigation")}
      style={{ height: 'var(--tab-bar-height, 4rem)', maxHeight: 'var(--tab-bar-height, 4rem)', zIndex: 1000 }}
    >
      <div className="flex justify-between h-16 max-w-md mx-auto px-4">{tabButtons}</div>
    </nav>
  )
}

export default React.memo(TabBar)

