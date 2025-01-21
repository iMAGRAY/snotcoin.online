import { supabase } from "./supabase"
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

export async function saveOrUpdateUser(user: User): Promise<User> {
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
}

