import axios from "axios"

export interface TelegramAuthResponse {
  verified: boolean
  user?: {
    id: number
    first_name?: string
    last_name?: string
    username?: string
    language_code?: string
    photo_url?: string
  }
  error?: string
}

export async function verifyTelegramAuth(initData: string): Promise<TelegramAuthResponse> {
  try {
    console.log("Verifying Telegram auth with initData:", initData) // Добавлено для отладки
    const response = await axios.post("/api/auth/verify-telegram", { initData })
    console.log("Verification response:", response.data) // Добавлено для отладки
    return response.data
  } catch (error) {
    console.error("Error verifying Telegram auth:", error)
    if (axios.isAxiosError(error)) {
      console.error("Axios error details:", error.response?.data) // Добавлено для отладки
    }
    return {
      verified: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    }
  }
}

