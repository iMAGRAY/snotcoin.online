import { supabase } from "./supabase"
import type { User } from "../types/gameTypes"

export function parseInitDataUnsafe(initDataUnsafe: any): User | null {
  console.log("Parsing initDataUnsafe:", initDataUnsafe)

  // Handle string input (sometimes initDataUnsafe comes as a string)
  if (typeof initDataUnsafe === "string") {
    try {
      initDataUnsafe = JSON.parse(initDataUnsafe)
    } catch (e) {
      console.error("Error parsing initDataUnsafe string:", e)
      return null
    }
  }

  // Validate input
  if (!initDataUnsafe || typeof initDataUnsafe !== "object") {
    console.error("Invalid initDataUnsafe:", initDataUnsafe)
    return null
  }

  // Handle both direct user object and nested user object
  const user = initDataUnsafe.user || initDataUnsafe

  if (!user || !user.id) {
    console.error("No valid user data in initDataUnsafe:", initDataUnsafe)
    return null
  }

  // Parse and validate user data
  const telegram_id = typeof user.id === "string" ? Number.parseInt(user.id, 10) : user.id

  if (isNaN(telegram_id)) {
    console.error("Invalid user ID:", user.id)
    return null
  }

  return {
    id: telegram_id,
    telegram_id: telegram_id,
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    username: user.username || "",
    language_code: user.language_code || "",
    photo_url: user.photo_url || "",
    auth_date:
      typeof initDataUnsafe.auth_date === "string"
        ? Number.parseInt(initDataUnsafe.auth_date, 10)
        : initDataUnsafe.auth_date || Math.floor(Date.now() / 1000),
  }
}

export function validateInitData(initData: string): boolean {
  if (!initData) return false

  try {
    const urlParams = new URLSearchParams(initData)
    const hash = urlParams.get("hash")
    if (!hash) return false

    // Remove hash from initData
    urlParams.delete("hash")
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")

    // Here you would normally validate the hash using HMAC-SHA-256
    // For now, we'll return true if we have a hash
    return true
  } catch (e) {
    console.error("Error validating initData:", e)
    return false
  }
}

export async function saveOrUpdateUser(user: User): Promise<User> {
  try {
    const { data, error } = await supabase
      .from("users")
      .upsert(
        {
          telegram_id: user.telegram_id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          photo_url: user.photo_url,
          language_code: user.language_code,
          auth_date: user.auth_date,
        },
        { onConflict: "telegram_id" },
      )
      .select()
      .single()

    if (error) {
      console.error("Error saving/updating user:", error)
      throw error
    }

    return data
  } catch (error) {
    console.error("Error in saveOrUpdateUser:", error)
    throw error
  }
}

export function isTelegramWebAppReady(): boolean {
  return typeof window !== "undefined" && !!window.Telegram?.WebApp && !!window.Telegram.WebApp.initDataUnsafe
}

export function waitForTelegramWebApp(timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isTelegramWebAppReady()) {
      resolve()
      return
    }

    const startTime = Date.now()
    const checkInterval = setInterval(() => {
      if (isTelegramWebAppReady()) {
        clearInterval(checkInterval)
        resolve()
        return
      }

      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval)
        reject(new Error("Telegram WebApp initialization timeout"))
      }
    }, 100)
  })
}

