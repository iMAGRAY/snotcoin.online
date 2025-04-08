"use client"

import React, { useMemo, useCallback, useEffect } from "react"
import { useGameState, useGameDispatch } from "../../contexts"
import type { TabId } from "./types"
import { tabs } from "./constants"
import TabButton from "./TabButton"
import { useTranslation } from "../../i18n"
import { useRouter } from "next/navigation"

type TabBarProps = {}

const TabBar: React.FC<TabBarProps> = () => {
  const { activeTab } = useGameState()
  const dispatch = useGameDispatch()
  const { t } = useTranslation()
  const router = useRouter()
  
  // Установка значения по умолчанию, если activeTab не определен или некорректен
  useEffect(() => {
    // Создаем массив допустимых идентификаторов вкладок
    const validTabIds = tabs.map(tab => tab.id);
    
    // Проверяем, является ли activeTab допустимым TabId
    const isValidTab = activeTab && validTabIds.includes(activeTab as TabId);
    
    if (!isValidTab) {
      console.log(`[TabBar] Некорректное значение activeTab: "${activeTab}". Устанавливаем "laboratory"`);
      dispatch(prevState => ({
        ...prevState,
        activeTab: "laboratory"
      }));
    }
  }, [activeTab, dispatch]);

  // Предварительно загружаем страницу улучшений для быстрого перехода
  useEffect(() => {
    router.prefetch('/upgrade')
  }, [router])

  const handleTabClick = useCallback(
    (id: TabId) => {
      dispatch(prevState => ({
        ...prevState,
        activeTab: id
      }))
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
      style={{ height: '5.5rem', maxHeight: '5.5rem', zIndex: 1000 }}
    >
      <div className="flex justify-evenly h-full w-full mx-auto items-center" style={{ padding: '0 8px' }}>{tabButtons}</div>
    </nav>
  )
}

export default React.memo(TabBar)

