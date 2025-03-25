import type React from "react"

export type TabId = "laboratory" | "storage" | "quests" | "profile"

export interface TabInfo {
  id: TabId
  icon: string
  label: string
}

export interface TabBarProps {
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>
  closeSettings: () => void
}

export interface TabButtonProps {
  id: TabId
  icon: string
  label: string
  isActive: boolean
  onClick: () => void
}

declare module "../../contexts/TranslationContext" {
  interface Translations {
    mainNavigation: string
  }
}

