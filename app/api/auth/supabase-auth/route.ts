import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { SignJWT } from "jose"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
  const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET

  if (!supabaseUrl || !supabaseServiceKey || !supabaseJwtSecret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const body = await request.json()
    const { telegramId, firstName, lastName, username } = body

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID is required" }, { status: 400 })
    }

    const { data: userData, error: upsertError } = await supabase.rpc("upsert_user_and_progress_v4", {
      p_telegram_id: telegramId,
      p_username: username || "",
      p_first_name: firstName || "",
      p_last_name: lastName || "",
      p_game_state: {},
    })

    if (upsertError) {
      return NextResponse.json({ error: "Failed to create/update user", details: upsertError }, { status: 500 })
    }

    const userId = userData

    const token = await new SignJWT({ sub: userId })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1w")
      .sign(new TextEncoder().encode(supabaseJwtSecret))

    const cookieStore = cookies()
    cookieStore.set("sb-access-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    })

    return NextResponse.json({
      user: {
        id: userId,
        telegram_id: telegramId,
        first_name: firstName,
        last_name: lastName,
        username: username,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

