import type { GameState } from "../types/gameTypes"
import { encryptData, decryptData, signData } from "./security"
import { validateGameState } from "./gameStateValidator"
import { supabase } from "./supabase"

async function signGameState(gameState: GameState): Promise<string> {
  return await signData(gameState)
}

export async function saveGameState(gameState: GameState): Promise<void> {
  try {
    // Validate game state before saving
    const isValid = await validateGameState(gameState)
    if (!isValid) {
      throw new Error("Invalid game state")
    }

    // Sign the game state
    const signature = await signGameState(gameState)
    const stateWithSignature = { ...gameState, signature }

    // Encrypt the game state
    const encryptedState = await encryptData(stateWithSignature)

    // Save to Supabase
    const { error } = await supabase.from("game_state").upsert({
      user_id: gameState.user?.id,
      encrypted_state: encryptedState,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      throw new Error("Failed to save game state to database")
    }
  } catch (error) {
    console.error("Error saving game state:", error)
    throw error
  }
}

export async function loadGameState(userId: string): Promise<GameState> {
  try {
    // Fetch encrypted state from Supabase
    const { data, error } = await supabase.from("game_state").select("encrypted_state").eq("user_id", userId).single()

    if (error || !data) {
      throw new Error("Failed to load game state from database")
    }

    // Decrypt the state
    const decryptedState = await decryptData(data.encrypted_state)

    // Validate the decrypted state
    const isValid = await validateGameState(decryptedState)
    if (!isValid) {
      throw new Error("Invalid or tampered game state")
    }

    return decryptedState
  } catch (error) {
    console.error("Error loading game state:", error)
    throw error
  }
}

