import { NextResponse } from 'next/server'
import { createToken, verifyToken } from '../../utils/jwt'
import { UserModel } from '../../utils/models'
import { logAuthInfo, AuthStep } from '../../utils/auth-logger'
import { WarpcastUser } from '../../types/warpcastAuth'

// Принудительная динамичность маршрута
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Обработчик POST запроса для авторизации/регистрации пользователя
 */
export async function POST(request: Request) {
  try {
    // Получаем данные пользователя из тела запроса
    const data = await request.json()
    
    if (!data || !data.user || !data.user.fid) {
      return NextResponse.json(
        { error: 'Missing user data', step: AuthStep.AUTH_ERROR },
        { status: 400 }
      )
    }
    
    // Получаем данные пользователя
    const user: WarpcastUser = data.user
    
    // Логирование данных авторизации
    logAuthInfo(AuthStep.USER_INTERACTION, `User data received: fid=${user.fid}, username=${user.username}`)
    
    // Проверяем, существует ли пользователь
    let dbUser = await UserModel.findByFid(user.fid)
    
    if (!dbUser) {
      // Если пользователь не найден, создаем нового
      logAuthInfo(AuthStep.USER_INTERACTION, `Creating new user with fid: ${user.fid}`)
      
      dbUser = await UserModel.create({
        fid: user.fid,
        username: user.username,
        displayName: user.displayName,
        pfp: user.pfp,
        address: user.address
      })
    } else {
      // Если пользователь найден, обновляем его данные
      logAuthInfo(AuthStep.USER_INTERACTION, `Updating existing user with fid: ${user.fid}`)
      
      dbUser = await UserModel.update({
        id: dbUser.id,
        username: user.username,
        displayName: user.displayName,
        pfp: user.pfp,
        address: user.address
      })
    }
    
    // Создаем JWT токен для пользователя
    const token = createToken({
      id: dbUser.id,
      fid: dbUser.fid,
      username: dbUser.username || '',
      displayName: dbUser.displayName || null, 
      pfp: dbUser.pfp || null,
      address: dbUser.address || null
    })
    
    // Сохраняем токен в базе данных
    await UserModel.updateToken(dbUser.id, token)
    
    // Логирование успешной авторизации
    logAuthInfo(AuthStep.AUTH_COMPLETE, `Authentication successful for user: ${user.username} (ID: ${dbUser.id})`)
    
    // Возвращаем данные пользователя и токен
    return NextResponse.json({
      user: {
        id: dbUser.id,
        fid: dbUser.fid,
        username: dbUser.username,
        displayName: dbUser.displayName,
        pfp: dbUser.pfp,
        address: dbUser.address
      },
      token
    })
    
  } catch (error) {
    console.error('Authentication error:', error)
    
    // Логирование ошибки
    logAuthInfo(
      AuthStep.AUTH_ERROR,
      `Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    
    return NextResponse.json(
      { 
        error: 'Authentication failed',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

/**
 * Обработчик GET запроса для проверки токена
 */
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
    
    // Проверяем, существует ли токен в базе данных
    const isValidToken = await UserModel.validateToken(user.id, token);
    
    if (!isValidToken) {
      return NextResponse.json(
        { error: 'Unauthorized access - token revoked' },
        { status: 401 }
      )
    }
    
    // Логируем успешную проверку токена
    logAuthInfo(AuthStep.TOKEN_RECEIVED, `Token validated for user ID: ${user.id}`);
    
    // Возвращаем данные пользователя
    return NextResponse.json({ user })
    
  } catch (error) {
    console.error('Token validation error:', error)
    
    return NextResponse.json(
      { error: 'Token validation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 