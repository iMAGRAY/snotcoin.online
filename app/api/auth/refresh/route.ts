import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshTokens } from '@/app/utils/jwt';

/**
 * Обработчик для обновления JWT токена с помощью refresh token
 */
export async function POST(request: NextRequest) {
  try {
    // Получаем refresh token из куки
    const refreshTokenCookie = cookies().get('refresh_token');
    
    if (!refreshTokenCookie) {
      return NextResponse.json({
        success: false,
        message: 'Refresh token не найден'
      }, { status: 400 });
    }
    
    // Обновляем токены с помощью refresh token
    const result = await refreshTokens(refreshTokenCookie.value);
    
    if (!result.success) {
      // Удаляем устаревшие токены
      cookies().delete('session');
      cookies().delete('refresh_token');
      
      return NextResponse.json({
        success: false,
        message: 'Невозможно обновить токены',
        error: result.error
      }, { status: 401 });
    }
    
    // Устанавливаем новый access token в куки
    cookies().set({
      name: 'session',
      value: result.accessToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60, // 30 дней
      path: '/'
    });
    
    // Устанавливаем новый refresh token в куки
    cookies().set({
      name: 'refresh_token',
      value: result.refreshToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 90 * 24 * 60 * 60, // 90 дней
      path: '/'
    });
    
    // Возвращаем новые токены
    return NextResponse.json({
      success: true,
      message: 'Токены успешно обновлены',
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Ошибка обновления токенов',
      error: String(error)
    }, { status: 500 });
  }
} 