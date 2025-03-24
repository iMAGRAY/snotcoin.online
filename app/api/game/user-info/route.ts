import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Создаем клиент Supabase с админским доступом
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_KEY ?? ''
)

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  // Получаем telegram_id из URL
  const url = new URL(request.url)
  const telegramId = url.searchParams.get('telegramId')

  if (!telegramId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: telegramId' },
      { status: 400 }
    )
  }

  // Находим пользователя по telegram_id
  const { data: userData, error: userError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .single()

  if (userError) {
    if (userError.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Database error', details: userError.message },
      { status: 500 }
    )
  }

  if (!userData) {
    return NextResponse.json(
      { error: 'Invalid user data' },
      { status: 500 }
    )
  }

  // Возвращаем информацию о пользователе без чувствительных данных
  return NextResponse.json({
    id: userData.id,
    telegram_id: userData.telegram_id,
    username: userData.username,
    first_name: userData.first_name,
    last_name: userData.last_name,
    created_at: userData.created_at
  })
} 