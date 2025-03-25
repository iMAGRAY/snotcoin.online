import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { UserModel } from "../../../utils/models"
import { generateToken } from "../../../utils/jwt"

export async function POST(request: Request) {
  const jwtSecret = process.env.JWT_SECRET

  if (!jwtSecret) {
    return NextResponse.json({ error: "Server configuration error: JWT secret is missing" }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { telegramId, firstName, lastName, username } = body

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID is required" }, { status: 400 })
    }

    // Проверяем существует ли пользователь
    let user = await UserModel.findByTelegramId(telegramId)
    
    if (user) {
      // Обновляем существующего пользователя
      user = await UserModel.update({
        id: user.id,
        username: username || "",
        first_name: firstName || "",
        last_name: lastName || ""
      })
    } else {
      // Создаем нового пользователя
      user = await UserModel.create({
        telegram_id: telegramId,
        username: username || "",
        first_name: firstName || "",
        last_name: lastName || ""
      })
    }

    // Создаем JWT токен
    const token = generateToken({
      id: user.id,
      telegram_id: telegramId,
      username: username || "",
      first_name: firstName || "",
      last_name: lastName || ""
    })

    // Сохраняем токен в базе данных
    await UserModel.updateToken(user.id, token)

    // Устанавливаем куки
    const cookieStore = cookies()
    cookieStore.set("access-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    })

    return NextResponse.json({
      user: {
        id: user.id,
        telegram_id: telegramId,
        first_name: firstName,
        last_name: lastName,
        username: username,
      },
      token: token
    })
  } catch (error) {
    console.error("Auth error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
} 