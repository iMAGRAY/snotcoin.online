import type { GameState } from "../types/gameTypes"
import { getUserByTelegramId, updateUserGameState } from "./db"

export async function loadGameState(userId: string): Promise<Partial<GameState>> {
  try {
    const user = await getUserByTelegramId(userId)
    if (user) {
      return {
        inventory: user.inventories,
        ...user.game_progress,
        wallet: user.wallets[0],
      }
    }
    return {}
  } catch (error) {
    console.error("Error loading game state:", error)
    return {}
  }
}

export async function saveGameState(userId: string, gameState: Partial<GameState>): Promise<void> {
  try {
    await updateUserGameState(userId, gameState)
  } catch (error) {
    console.error("Error saving game state:", error)
  }
}

