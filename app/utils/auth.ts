import { sign, verify } from "jsonwebtoken"
import type { TelegramUser } from "../types/gameTypes"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

export function generateToken(user: TelegramUser): string {
  return sign({ user }, JWT_SECRET, { expiresIn: "7d" })
}

export function verifyToken(token: string): { user: TelegramUser } | null {
  try {
    return verify(token, JWT_SECRET) as { user: TelegramUser }
  } catch (error) {
    return null
  }
}

