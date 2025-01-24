import type { NextApiRequest, NextApiResponse } from "next"
import { verifyData, decryptData } from "../utils/security"
import type { AuthenticatedRequest } from "../middleware/authMiddleware"

export default async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    try {
      // Проверка аутентификации (предполагается, что у вас есть middleware для этого)
      if (!("user" in req)) {
        return res.status(401).json({ error: "Unauthorized" })
      }

      // Здесь вы бы загрузили encryptedData и signature из базы данных
      const encryptedData = "..." // Загрузите из базы данных
      const signature = "..." // Загрузите из базы данных

      // Расшифровка данных
      const gameState = decryptData(encryptedData)

      // Проверка целостности данных
      if (!verifyData(gameState, signature)) {
        return res.status(400).json({ error: "Data integrity check failed" })
      }

      res.status(200).json(gameState)
    } catch (error) {
      console.error("Error loading game state:", error)
      res.status(500).json({ error: "Internal server error" })
    }
  } else {
    res.setHeader("Allow", ["GET"])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}

