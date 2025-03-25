import { NextResponse } from 'next/server'
import { UserModel } from '../../../utils/models'
import { verifyToken } from '../../../utils/jwt'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    // Получаем токен из заголовка
    let token: string | null = null;
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // Валидация токена
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized access - no token' },
        { status: 401 }
      )
    }
    
    // Проверяем валидность токена
    const { valid, user, error: tokenError } = verifyToken(token);
    
    if (!valid || !user) {
      return NextResponse.json(
        { error: 'Unauthorized access - invalid token', details: tokenError },
        { status: 401 }
      )
    }

    // Получаем telegramId из URL
    const url = new URL(request.url)
    const telegramId = url.searchParams.get('telegramId')
    
    if (!telegramId) {
      return NextResponse.json(
        { error: 'Missing telegramId parameter' },
        { status: 400 }
      )
    }
    
    // Проверяем, соответствует ли telegramId пользователю из токена
    if (user.telegram_id.toString() !== telegramId) {
      return NextResponse.json(
        { error: 'Unauthorized access - telegramId mismatch' },
        { status: 403 }
      )
    }
    
    // Получаем данные пользователя из БД
    const dbUser = await UserModel.findByTelegramId(parseInt(telegramId))
    
    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Возвращаем информацию о пользователе без чувствительных данных
    return NextResponse.json({
      id: dbUser.id,
      telegram_id: dbUser.telegram_id,
      username: dbUser.username,
      first_name: dbUser.first_name,
      last_name: dbUser.last_name,
      created_at: dbUser.created_at,
      updated_at: dbUser.updated_at
    })
    
  } catch (error) {
    console.error('Error getting user info:', error)
    
    return NextResponse.json(
      { error: 'Server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 