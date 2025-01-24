import WebApp from "@twa-dev/sdk"

export const validateTelegramAuth = async (): Promise<{
  success: boolean
  error?: string
  data?: any
}> => {
  try {
    const initData = WebApp.initData
    if (!initData) {
      throw new Error("Telegram WebApp data not found")
    }

    const response = await fetch("https://snotauth.online/validate", {
      method: "POST",
      mode: "cors",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ initData }),
    })

    if (!response.ok) {
      throw new Error(`Validation failed: ${response.status}`)
    }

    const result = await response.json()
    return {
      success: true,
      data: result.data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Validation failed",
    }
  }
}

