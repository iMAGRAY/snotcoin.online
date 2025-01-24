import type { NextApiRequest, NextApiResponse } from "next"
import { verifyToken } from "../utils/auth"

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id: number
    first_name: string
    last_name?: string
    username?: string
  }
}

export function authMiddleware(handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    try {
      const token = req.headers.authorization?.split(" ")[1]
      if (!token) {
        return res.status(401).json({ error: "No token provided" })
      }

      const decoded = verifyToken(token)
      if (!decoded) {
        return res.status(401).json({ error: "Invalid token" })
      }

      req.user = decoded.user
      return handler(req, res)
    } catch (error) {
      console.error("Auth error:", error)
      return res.status(401).json({ error: "Authentication failed" })
    }
  }
}

