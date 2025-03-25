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
    const { fid, username, displayName, pfp, address } = body

    if (!fid) {
      return NextResponse.json({ error: "Farcaster ID (FID) is required" }, { status: 400 })
    }

    // Проверяем id пользователя
    const fidNumber = typeof fid === 'string' ? parseInt(fid) : fid
    
    if (isNaN(fidNumber)) {
      return NextResponse.json({ error: 'Invalid Farcaster ID' }, { status: 400 })
    }

    // Проверяем существование пользователя
    let user = await UserModel.findByFid(fidNumber)
    
    if (user) {
      // Обновляем существующего пользователя
      await UserModel.upsert({
        fid: fidNumber,
        username: username || "",
        displayName: displayName || null,
        pfp: pfp || null,
        address: address || null
      })
    } else {
      // Создаем нового пользователя
      user = await UserModel.create({
        fid: fidNumber,
        username: username || "",
        displayName: displayName || null,
        pfp: pfp || null,
        address: address || null
      })
    }

    // Создаем JWT токен
    const token = generateToken({
      id: user.id,
      fid: fidNumber,
      username: username || "",
      displayName: displayName || null,
      pfp: pfp || null,
      address: address || null
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
        fid: fidNumber,
        username: username,
        displayName: displayName || null,
        pfp: pfp || null,
        address: address || null
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