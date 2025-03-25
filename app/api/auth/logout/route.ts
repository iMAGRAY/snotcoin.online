import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Обработчик запросов на выход из системы
 */
export async function POST() {
  try {
    // Удаляем куки сессии
    cookies().delete('session');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    
    return NextResponse.json(
      { error: 'Logout failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 