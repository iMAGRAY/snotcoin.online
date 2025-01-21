import type { User } from "../types/gameTypes"

export function parseInitDataUnsafe(initDataUnsafe: any): User | null {
  if (typeof initDataUnsafe === "string") {
    try {
      initDataUnsafe = JSON.parse(initDataUnsafe)
    } catch (e) {
      console.error("Error parsing initDataUnsafe:", e)
      return null
    }
  }

  if (!initDataUnsafe || !initDataUnsafe.user) {
    console.error("Invalid initDataUnsafe structure:", initDataUnsafe)
    return null
  }

  return {
    id: Number.parseInt(initDataUnsafe.user.id || "0", 10),
    telegram_id: Number.parseInt(initDataUnsafe.user.id || "0", 10),
    first_name: initDataUnsafe.user.first_name,
    last_name: initDataUnsafe.user.last_name,
    username: initDataUnsafe.user.username,
    language_code: initDataUnsafe.user.language_code,
    photo_url: initDataUnsafe.user.photo_url,
    auth_date: Number.parseInt(initDataUnsafe.auth_date || "0", 10),
  }
}

