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
    const { valid, user, expired } = verifyToken(token);
    
    if (!valid || !user) {
      return NextResponse.json(
        { error: 'Unauthorized access - invalid token', details: expired ? 'Token expired' : 'Invalid token' },
        { status: 401 }
      )
    }

    // Получаем fid из URL
    const url = new URL(request.url)
    const fidParam = url.searchParams.get('fid')
    
    if (!fidParam) {
      return NextResponse.json(
        { error: 'Missing fid parameter' },
        { status: 400 }
      )
    }
    
    // Проверяем, соответствует ли fid пользователю из токена
    if (user.fid.toString() !== fidParam) {
      return NextResponse.json(
        { error: 'Unauthorized access - fid mismatch' },
        { status: 403 }
      )
    }
    
    // Получаем данные пользователя из БД
    const dbUser = await UserModel.findByFid(parseInt(fidParam))
    
    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Возвращаем информацию о пользователе без чувствительных данных
    return NextResponse.json({
      id: dbUser.id,
      fid: dbUser.fid,
      username: dbUser.username || "",
      displayName: dbUser.displayName || "",
      pfp: dbUser.pfp || null,
      address: dbUser.address || null,
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