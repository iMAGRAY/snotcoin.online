import { NextRequest, NextResponse } from 'next/server';
import { sign, verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { UserModel } from '../../../utils/models';
import { authService } from '../../../services/auth/authService';
import { prisma } from '../../../lib/prisma';

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
    // Получаем refresh_token из запроса
    const data = await request.json();
    const { refresh_token } = data;

    if (!refresh_token) {
      return NextResponse.json({ success: false, error: 'Refresh token is required' }, { status: 400 });
    }

    // Проверяем refresh_token в базе данных
    const user = await prisma.user.findFirst({
      where: { refresh_token },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid refresh token' }, { status: 401 });
    }

    // Получаем текущий токен авторизации
    const currentToken = user.jwt_token || '';
    
    // Обновляем токен через authService
    const refreshSuccess = await authService.refreshToken();
    if (!refreshSuccess) {
      return NextResponse.json({ success: false, error: 'Failed to refresh token' }, { status: 500 });
    }
    
    // Получаем новый токен из authService
    const newToken = authService.getToken();
    if (!newToken) {
      return NextResponse.json({ success: false, error: 'Failed to retrieve new token' }, { status: 500 });
    }

    // Обновляем токен в базе данных
    await prisma.user.update({
      where: { id: user.id },
      data: {
        jwt_token: newToken,
        token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    return NextResponse.json({
      success: true,
      token: newToken,
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  } finally {
    // Отключаемся от базы данных
    await prisma.$disconnect();
  }
} 