import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sign } from '@/app/utils/jwt';
import { prisma } from '@/app/lib/prisma';
import { logAuth, AuthStep, AuthLogType } from '@/app/utils/auth-logger';
import * as jwt from 'jsonwebtoken';

/**
 * Указываем Next.js, что этот маршрут должен быть динамическим
 * и не должен пытаться рендериться статически
 */
export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-do-not-use-in-production';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-refresh-secret-do-not-use-in-production';

// Срок действия JWT токена: 1 час
const TOKEN_EXPIRY = '1h';
// Срок действия Refresh токена: 30 дней
const REFRESH_EXPIRY = '30d';

/**
 * Обработчик для обновления JWT токена с помощью refresh token
 */
export async function POST(request: NextRequest) {
  try {
    logAuth(AuthStep.TOKEN_REFRESH, AuthLogType.INFO, 'Начало обновления токена');
    
    // Получаем refresh_token из cookies или запроса
    const cookieStore = cookies();
    const refreshCookie = cookieStore.get('refresh_token');
    
    let refreshToken: string | undefined;
    
    // Если токен не в cookies, пробуем получить из body запроса
    if (!refreshCookie?.value) {
      const data = await request.json().catch(() => ({}));
      refreshToken = data.refresh_token;
      
      if (!refreshToken) {
        logAuth(
          AuthStep.TOKEN_REFRESH, 
          AuthLogType.ERROR, 
          'Токен обновления не найден ни в cookies, ни в теле запроса'
        );
        return NextResponse.json({ 
          success: false, 
          error: 'Refresh token is required' 
        }, { status: 400 });
      }
    } else {
      refreshToken = refreshCookie.value;
    }

    // Декодируем refresh токен для получения fid пользователя
    try {
      const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as { fid?: string; userId?: string };
      
      if (!decoded.fid && !decoded.userId) {
        logAuth(
          AuthStep.TOKEN_REFRESH, 
          AuthLogType.ERROR, 
          'Токен обновления не содержит fid или userId'
        );
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid refresh token format' 
        }, { status: 401 });
      }
      
      // Ищем пользователя по fid или userId
      const user = await prisma.user.findFirst({
        where: decoded.fid 
          ? { farcaster_fid: decoded.fid } 
          : decoded.userId ? { id: decoded.userId } : {}
      });
      
      if (!user) {
        logAuth(
          AuthStep.TOKEN_REFRESH, 
          AuthLogType.ERROR, 
          'Пользователь не найден по данным из токена обновления',
          { fid: decoded.fid, userId: decoded.userId }
        );
        return NextResponse.json({ 
          success: false, 
          error: 'User not found' 
        }, { status: 401 });
      }
      
      // Генерируем новый JWT токен
      const newToken = sign({
        userId: user.id,
        fid: user.farcaster_fid,
        username: user.farcaster_username,
        displayName: user.farcaster_displayname,
        provider: 'farcaster'
      }, TOKEN_EXPIRY);
      
      // Генерируем новый refresh токен
      const newRefreshToken = sign({
        userId: user.id,
        fid: user.farcaster_fid,
        provider: 'farcaster'
      }, REFRESH_EXPIRY);
      
      // Обновляем токены в cookies
      cookieStore.set({
        name: 'session',
        value: newToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 // 1 час в секундах
      });
      
      cookieStore.set({
        name: 'refresh_token',
        value: newRefreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 // 30 дней в секундах
      });
      
      // Не обновляем токены в базе данных, чтобы упростить систему
      // и избежать дублирования информации
      
      logAuth(
        AuthStep.TOKEN_REFRESH, 
        AuthLogType.INFO, 
        'Токен успешно обновлен',
        { userId: user.id, fid: user.farcaster_fid }
      );
      
      return NextResponse.json({
        success: true,
        token: newToken,
        user: {
          id: user.id,
          fid: user.farcaster_fid ? Number(user.farcaster_fid) : undefined,
          username: user.farcaster_username,
          displayName: user.farcaster_displayname || user.farcaster_username,
          avatar: user.farcaster_pfp
        }
      });
    } catch (tokenError) {
      logAuth(
        AuthStep.TOKEN_REFRESH, 
        AuthLogType.ERROR, 
        'Ошибка при проверке токена обновления',
        {},
        tokenError
      );
      
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid refresh token' 
      }, { status: 401 });
    }
  } catch (error) {
    logAuth(
      AuthStep.TOKEN_REFRESH, 
      AuthLogType.ERROR, 
      'Внутренняя ошибка при обновлении токена',
      {},
      error
    );
    
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 