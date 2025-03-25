import { NextResponse } from 'next/server'
import { createToken, verifyToken } from '../../utils/jwt'
import { UserModel } from '../../utils/models'
import { logAuthInfo, AuthStep } from '../../utils/auth-logger'
import { WarpcastUser } from '../../types/warpcastAuth'
import { cookies } from 'next/headers'

// Принудительная динамичность маршрута
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BASE_URL = process.env.NEXT_PUBLIC_DOMAIN || 'https://snotcoin.online'

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
    const { searchParams } = new URL(request.url)
    const fid = searchParams.get('fid')
    const username = searchParams.get('username')
    const redirect = searchParams.get('redirect') || '/home'
    const embed = searchParams.get('embed') === 'true'

    if (!fid) {
      throw new Error('FID is required')
    }

    // Создаем сессию пользователя
    const session = {
      fid,
      username,
      isAuthenticated: true,
      timestamp: Date.now(),
    }

    // Сохраняем сессию в куки
    cookies().set('session', JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 дней
    })

    // Формируем URL для редиректа
    const redirectUrl = new URL(redirect, BASE_URL)
    if (embed) {
      redirectUrl.searchParams.set('embed', 'true')
    }

    // Редирект на указанную страницу
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error('Auth error:', error)
    
    // В случае ошибки редиректим на страницу ошибки
    const errorUrl = new URL('/error', BASE_URL)
    errorUrl.searchParams.set('message', 'Authentication failed')
    return NextResponse.redirect(errorUrl)
  }
} 