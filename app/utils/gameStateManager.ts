import { supabase } from "./supabase"
import type { GameState } from "../types/gameTypes"

export async function saveGameState(userId: string, gameState: GameState): Promise<void> {
  if (!userId) {
    throw new Error("User ID is required to save game state")
  }

  try {
    const { error } = await supabase.from("game_states").upsert(
      {
        user_id: userId,
        game_state: gameState,
      },
      { onConflict: "user_id" },
    )

    if (error) {
      console.error("Supabase error while saving game state:", error)
      throw new Error(`Failed to save game state: ${error.message}`)
    }
  } catch (error) {
    console.error("Error saving game state:", error)
    throw error
  }
}

export async function loadGameState(userId: string): Promise<GameState | null> {
  if (!userId) {
    throw new Error("User ID is required to load game state")
  }

  try {
    const { data, error } = await supabase.from("game_states").select("game_state").eq("user_id", userId).single()

    if (error) throw error
    return data?.game_state || null
  } catch (error) {
    console.error("Error loading game state:", error)
    throw error
  }
}

