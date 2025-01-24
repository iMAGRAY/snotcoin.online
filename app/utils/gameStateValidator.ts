import type { GameState } from "../types/gameTypes"
import { signData, verifyData } from "./security"

export async function validateGameState(gameState: GameState): Promise<boolean> {
  try {
    // Basic validation checks
    if (!gameState.user || !gameState.inventory || !gameState.containerLevel) {
      return false
    }

    // Value range validations
    if (gameState.energy < 0 || gameState.energy > gameState.maxEnergy) {
      return false
    }

    if (gameState.containerLevel < 1 || gameState.containerLevel > 100) {
      return false
    }

    // Data consistency checks
    if (gameState.containerSnot > gameState.inventory.containerCapacity) {
      return false
    }

    // Verify data integrity using signature
    if (gameState.signature) {
      const isValid = await verifyData(
        { ...gameState, signature: undefined }, // Exclude signature from verification
        gameState.signature,
      )
      if (!isValid) {
        console.error("Game state signature verification failed")
        return false
      }
    }

    return true
  } catch (error) {
    console.error("Error validating game state:", error)
    return false
  }
}

export async function signGameState(gameState: GameState): Promise<string> {
  return await signData({ ...gameState, signature: undefined })
}

