import type { User } from "../types/gameTypes"
import axios from "axios"

const BOT_API_KEY = process.env.NEXT_PUBLIC_TELEGRAM_BOT_API_KEY || "7443461159:AAGFtEVk1qMMz68DAjtD-8eDYcQTSBwyn_A"

if (!BOT_API_KEY) {
  console.error("Telegram Bot API key is not set in the environment variables")
}

export async function validateTelegramUser(initData: string): Promise<User | null> {
  try {
    const response = await axios.post(`https://api.telegram.org/bot${BOT_API_KEY}/getMe`, { init_data: initData })

    if (response.data.ok) {
      const userData = response.data.result
      return {
        id: userData.id,
        telegram_id: userData.id,
        first_name: userData.first_name,
        last_name: userData.last_name,
        username: userData.username,
        language_code: userData.language_code,
        photo_url: userData.photo_url,
        auth_date: Math.floor(Date.now() / 1000),
      }
    }
    return null
  } catch (error) {
    console.error("Error validating Telegram user:", error)
    return null
  }
}

export async function getTelegramUser(): Promise<User | null> {
  if (typeof window !== "undefined" && window.Telegram?.WebApp?.initData) {
    const initData = window.Telegram.WebApp.initData
    return await validateTelegramUser(initData)
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

