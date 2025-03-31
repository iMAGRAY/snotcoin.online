import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Указываем Next.js, что этот маршрут должен быть динамическим
 * и не должен пытаться рендериться статически
 */
export const dynamic = 'force-dynamic';

/**
 * Обработчик для выхода пользователя
 * Очищает refresh_token и другие связанные куки
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();

    // Список всех куки, связанных с аутентификацией
    const authCookies = [
      'refresh_token',
      'session',
      'auth_session',
      'auth_token'
    ];

    // Удаляем все куки, связанные с аутентификацией
    for (const cookieName of authCookies) {
      if (cookieStore.has(cookieName)) {
        cookieStore.delete(cookieName);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Выход успешно выполнен'
    });
  } catch (error) {
    console.error('[API][Logout] Ошибка при выходе пользователя:', error);
    return NextResponse.json({
      success: false,
      message: 'Произошла ошибка при выходе',
      error: error instanceof Error ? error.message : String(error)
    }, { 
      status: 500 
    });
  }
} 