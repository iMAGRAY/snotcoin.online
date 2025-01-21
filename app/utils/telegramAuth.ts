import type { User } from "../types/gameTypes"

export function getTelegramUser(): User | null {
  if (typeof window !== "undefined" && window.Telegram?.WebApp?.initDataUnsafe) {
    const { user } = window.Telegram.WebApp.initDataUnsafe
    if (user) {
      return {
        id: user.id,
        telegram_id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        language_code: user.language_code,
        photo_url: user.photo_url,
        auth_date: Math.floor(Date.now() / 1000),
      }
    }
  }
  return null
}

export function isTelegramWebAppAvailable(): boolean {
  return typeof window !== "undefined" && !!window.Telegram?.WebApp
}

export function getTelegramInitData(): string | null {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    return window.Telegram.WebApp.initData
  }
  return null
}

export function getTelegramThemeParams(): any {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    return window.Telegram.WebApp.themeParams
  }
  return null
}

export function setTelegramBackButton(show: boolean): void {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    if (show) {
      window.Telegram.WebApp.BackButton.show()
    } else {
      window.Telegram.WebApp.BackButton.hide()
    }
  }
}

export function closeTelegramWebApp(): void {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    window.Telegram.WebApp.close()
  }
}

export function expandTelegramWebApp(): void {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    window.Telegram.WebApp.expand()
  }
}

export function setTelegramMainButton(params: {
  text: string
  color: string
  textColor: string
  isVisible: boolean
  isActive: boolean
  onClick: () => void
}): void {
  if (typeof window !== "undefined" && window.Telegram?.WebApp) {
    const { MainButton } = window.Telegram.WebApp
    MainButton.text = params.text
    MainButton.color = params.color
    MainButton.textColor = params.textColor
    if (params.isVisible) {
      MainButton.show()
    } else {
      MainButton.hide()
    }
    if (params.isActive) {
      MainButton.enable()
    } else {
      MainButton.disable()
    }
    MainButton.onClick(params.onClick)
  }
}

