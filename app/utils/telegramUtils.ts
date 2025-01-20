import { supabase } from "./supabase"
import type { User } from "../types/gameTypes"

export function isTokenExpired(authDate: number): boolean {
  const currentTime = Math.floor(Date.now() / 1000)
  return currentTime - authDate > 3600 // Token expires after 1 hour
}

export function parseInitDataUnsafe(initDataUnsafe: any): User {
  return {
    id: Number.parseInt(initDataUnsafe.user.id || "0", 10),
    telegram_id: Number.parseInt(initDataUnsafe.user.id || "0", 10),
    first_name: initDataUnsafe.user.first_name || undefined,
    last_name: initDataUnsafe.user.last_name || undefined,
    username: initDataUnsafe.user.username || undefined,
    language_code: initDataUnsafe.user.language_code || undefined,
    photo_url: initDataUnsafe.user.photo_url || undefined,
    auth_date: Number.parseInt(initDataUnsafe.auth_date || "0", 10),
  }
}

export async function compareAndUpdateUserData(dbUser: User, telegramUser: User): Promise<User> {
  const updates: Partial<User> = {}

  if (dbUser.username !== telegramUser.username) updates.username = telegramUser.username
  if (dbUser.first_name !== telegramUser.first_name) updates.first_name = telegramUser.first_name
  if (dbUser.last_name !== telegramUser.last_name) updates.last_name = telegramUser.last_name
  if (dbUser.photo_url !== telegramUser.photo_url) updates.photo_url = telegramUser.photo_url
  if (dbUser.language_code !== telegramUser.language_code) updates.language_code = telegramUser.language_code

  if (Object.keys(updates).length > 0) {
    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("telegram_id", telegramUser.telegram_id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  return dbUser
}

