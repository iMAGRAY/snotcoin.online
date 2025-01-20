import { GameState } from "../../types/gameTypes"

export type TabId = "fusion" | "laboratory" | "storage" | "games" | "profile"

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

