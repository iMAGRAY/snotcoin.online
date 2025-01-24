import type { NextApiRequest, NextApiResponse } from "next"
import { authMiddleware } from "../middleware/authMiddleware"
import { encryptData, signData } from "../utils/security"
import { validateGameState } from "../utils/gameStateValidator"
import { saveGameStateToDatabase } from "../utils/database" // Предполагается, что у вас есть такая функция

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const gameState = req.body
    const userId = (req as any).user.id

    // Валидация игрового состояния
    if (!validateGameState(gameState)) {
      return res.status(400).json({ error: "Invalid game state" })
    }

    // Добавление метки времени
    gameState.lastUpdated = new Date().toISOString()

    // Шифрование данных
    // Подпись данных
    await saveGameStateToDatabase(userId, await encryptData(gameState), await signData(gameState))

    res.status(200).json({ message: "Game state saved successfully" })
  } catch (error) {
    console.error("Error saving game state:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

export default authMiddleware(handler)

