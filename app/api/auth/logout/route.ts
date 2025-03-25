import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Обработчик для выхода из системы
 */
export async function POST() {
  try {
    // Удаляем оба куки: session и refresh_token
    cookies().delete('session');
    cookies().delete('refresh_token');
    
    return NextResponse.json({
      success: true,
      message: 'Выход выполнен успешно'
    });
  } catch (error) {
    console.error('Logout error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Ошибка при выходе из системы',
      error: String(error)
    }, { status: 500 });
  }
} 