import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logAuth, AuthStep, AuthLogType } from '@/app/utils/auth-logger';
import prisma from '@/app/lib/prisma';

/**
 * Указываем Next.js, что этот маршрут должен быть динамическим
 * и не должен пытаться рендериться статически
 */
export const dynamic = 'force-dynamic';

/**
 * Обработчик для выхода пользователя
 * Очищает куки авторизации и инвалидирует токены в базе данных
 */
export async function POST(request: NextRequest) {
  try {
    logAuth(AuthStep.LOGOUT_START, AuthLogType.INFO, 'Начало процедуры выхода пользователя');
    
    const cookieStore = cookies();
    
    // Пытаемся получить ID пользователя из сессии
    let userId = null;
    const sessionCookie = cookieStore.get('session');
    
    if (sessionCookie?.value) {
      try {
        // Декодируем JWT токен для получения ID пользователя
        const tokenParts = sessionCookie.value.split('.');
        if (tokenParts.length === 3 && tokenParts[1]) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          userId = payload.userId;
          
          logAuth(
            AuthStep.LOGOUT_START,
            AuthLogType.INFO,
            'Получен ID пользователя из токена',
            { userId }
          );
          
          // Если есть ID пользователя, сбрасываем его токены в базе данных
          if (userId) {
            await prisma.user.update({
              where: { id: userId },
              data: {
                jwt_token: null,
                refresh_token: null,
                token_expires_at: null
              }
            });
            
            logAuth(
              AuthStep.LOGOUT_COMPLETE,
              AuthLogType.INFO,
              'Токены пользователя сброшены в базе данных',
              { userId }
            );
          }
        }
      } catch (tokenError) {
        logAuth(
          AuthStep.LOGOUT_ERROR,
          AuthLogType.ERROR,
          'Ошибка при расшифровке токена',
          { token: sessionCookie.value.substring(0, 10) + '...' },
          tokenError
        );
      }
    }

    // Список всех куки, связанных с аутентификацией
    const authCookies = [
      'refresh_token',
      'session',
      'auth_session',
      'auth_token',
      'farcaster_session'
    ];

    // Удаляем все куки, связанные с аутентификацией
    for (const cookieName of authCookies) {
      if (cookieStore.has(cookieName)) {
        cookieStore.delete(cookieName);
      }
    }
    
    logAuth(
      AuthStep.LOGOUT_COMPLETE,
      AuthLogType.INFO,
      'Выход пользователя успешно выполнен',
      { userId }
    );

    return NextResponse.json({
      success: true,
      message: 'Выход успешно выполнен'
    });
  } catch (error) {
    logAuth(
      AuthStep.LOGOUT_ERROR,
      AuthLogType.ERROR,
      'Ошибка при выходе пользователя',
      {},
      error
    );
    
    return NextResponse.json({
      success: false,
      message: 'Произошла ошибка при выходе',
      error: error instanceof Error ? error.message : String(error)
    }, { 
      status: 500 
    });
  }
} 