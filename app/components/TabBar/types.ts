import type React from "react"
import type { NavigationTranslations, LaboratoryTranslations } from "../../i18n/types/translationTypes"

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

// Обратная совместимость для старых ключей переводов
declare module "../../i18n" {
  interface TranslationKeys {
    storage: string;
    quests: string;
    profile: string;
  }
}

