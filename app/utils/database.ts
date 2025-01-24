import { supabase } from "./supabase"
import type { GameState } from "../types/gameTypes"

export async function saveGameStateToDatabase(
  userId: number,
  encryptedState: string,
  signature: string,
): Promise<void> {
  const { error } = await supabase.from("game_state").upsert({
    user_id: userId,
    encrypted_state: encryptedState,
    signature,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    throw new Error(`Failed to save game state: ${error.message}`)
  }
}

export async function loadGameStateFromDatabase(userId: number): Promise<string | null> {
  const { data, error } = await supabase.from("game_state").select("encrypted_state").eq("user_id", userId).single()

  if (error) {
    throw new Error(`Failed to load game state: ${error.message}`)
  }

  return data?.encrypted_state || null
}

