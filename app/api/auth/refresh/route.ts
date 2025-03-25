import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshTokens } from '@/app/utils/jwt';

/**
 * Обработчик для обновления JWT токена с помощью refresh token
 */
export async function POST(request: NextRequest) {
  try {
    // Получаем refresh токен из куки
    const refreshToken = cookies().get('refresh_token')?.value;
    
    if (!refreshToken) {
      return NextResponse.json({
        success: false,
        message: 'Refresh токен отсутствует'
      }, { status: 401 });
    }
    
    // Обновляем токены
    const result = await refreshTokens(refreshToken);
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        message: 'Не удалось обновить токены',
        error: result.error
      }, { status: 401 });
    }
    
    // Устанавливаем новый токен в куки
    cookies().set({
      name: 'session',
      value: result.accessToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60, // 30 дней
      path: '/'
    });
    
    // Устанавливаем новый refresh токен в куки
    cookies().set({
      name: 'refresh_token',
      value: result.refreshToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 90 * 24 * 60 * 60, // 90 дней
      path: '/'
    });
    
    // Возвращаем успешный ответ
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
    console.error('Ошибка при обновлении токенов:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Произошла ошибка при обновлении токенов',
      error: String(error)
    }, { status: 500 });
  }
} 