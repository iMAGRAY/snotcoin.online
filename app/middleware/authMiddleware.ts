import type { NextApiRequest, NextApiResponse } from "next"
import { verifyToken } from "../utils/auth"

export function authMiddleware(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const token = req.headers.authorization?.split(" ")[1]
      if (!token) {
        return res.status(401).json({ error: "No token provided" })
      }

      const isValid = verifyToken(token)
      if (!isValid) {
        return res.status(401).json({ error: "Invalid token" })
      }
      // Add user information to the request
      ;(req as any).user = { id: "user_id" } // Replace with actual user data

      // Call the next handler
      return handler(req, res)
    } catch (error) {
      console.error("Auth error:", error)
      return res.status(401).json({ error: "Authentication failed" })
    }
  }
}

