import { createClient } from "@supabase/supabase-js"
import type { GameState } from "../types/gameTypes"
import { encrypt, decrypt } from "./encryption"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function saveGameStateToSupabase(userId: string, gameState: GameState): Promise<void> {
  try {
    const stateToSave = {
      version: "1.2",
      state: gameState,
      lastUpdated: new Date().toISOString(),
    }
    const serializedState = JSON.stringify(stateToSave)
    const encryptedState = encrypt(serializedState)

    const { error } = await supabase.from("game_states").upsert(
      {
        user_id: userId,
        encrypted_state: encryptedState,
        version: "1.2",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

    if (error) throw error
    console.log("Game state saved to Supabase successfully")
  } catch (error) {
    console.error("Error saving game state to Supabase:", error)
    throw error
  }
}

export async function loadGameStateFromSupabase(userId: string): Promise<GameState | null> {
  try {
    const { data, error } = await supabase
      .from("game_states")
      .select("encrypted_state, version")
      .eq("user_id", userId)
      .single()

    if (error) throw error

    if (data) {
      const serializedState = decrypt(data.encrypted_state)
      const parsedState = JSON.parse(serializedState)

      if (parsedState.version === "1.2") {
        return parsedState.state as GameState
      } else {
        console.warn("Outdated game state version in Supabase, migrating...")
        return migrateGameState(parsedState.state, parsedState.version)
      }
    }
    return null
  } catch (error) {
    console.error("Error loading game state from Supabase:", error)
    return null
  }
}

export async function syncChangesToSupabase(userId: string, changes: any[]): Promise<void> {
  // Updated to use any[]
  try {
    const { error } = await supabase.from("game_state_changes").insert(
      changes.map((change) => ({
        user_id: userId,
        change: encrypt(JSON.stringify(change)),
        timestamp: new Date().toISOString(),
      })),
    )

    if (error) throw error
    console.log("Game state changes synced to Supabase successfully")
  } catch (error) {
    console.error("Error syncing game state changes to Supabase:", error)
    throw error
  }
}

function migrateGameState(oldState: any, oldVersion: string): GameState {
  // Implement migration logic here
  return oldState as GameState
}

