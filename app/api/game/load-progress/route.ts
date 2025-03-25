import { NextResponse } from 'next/server'
import { UserModel, ProgressModel } from '../../../utils/models'
import { verifyToken } from '../../../utils/jwt'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const requestStartTime = Date.now()

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

    // Получаем fid из запроса
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
    
    // Получаем прогресс пользователя
    const progress = await ProgressModel.findByUserId(dbUser.id)
    
    if (!progress) {
      // Если прогресс не найден, создаем и возвращаем пустой начальный прогресс
      return NextResponse.json({
        game_state: {},
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
    
    // Возвращаем данные прогресса пользователя
    return NextResponse.json({
      game_state: progress.game_state,
      version: progress.version,
      created_at: progress.created_at,
      updated_at: progress.updated_at
    })
    
  } catch (error) {
    console.error('Error loading progress:', error)
    
    return NextResponse.json(
      { error: 'Server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  } finally {
    // Логируем время выполнения запроса
    const requestEndTime = Date.now()
    console.log(`Load progress request processed in ${requestEndTime - requestStartTime}ms`)
  }
} 