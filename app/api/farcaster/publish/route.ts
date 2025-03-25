import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * API endpoint для публикации кастов в Farcaster
 * Этот метод может быть вызван только в клиентском рендеринге 
 * через Farcaster SDK, поэтому он возвращает информацию, что
 * нужно использовать клиентский метод.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = cookies().get('session');
    
    if (!sessionCookie) {
      return NextResponse.json({ 
        success: false,
        message: 'Требуется авторизация' 
      }, { status: 401 });
    }
    
    const body = await request.json();
    const { text } = body;
    
    if (!text) {
      return NextResponse.json({ 
        success: false,
        message: 'Текст сообщения обязателен' 
      }, { status: 400 });
    }
    
    // На самом деле этот endpoint не публикует сообщения напрямую
    // Только браузерный Farcaster SDK может это делать через Warpcast
    return NextResponse.json({ 
      success: false,
      message: 'Публикация через API не поддерживается. Используйте клиентский Farcaster SDK',
      clientMethod: true
    }, { status: 400 });
  } catch (error) {
    console.error('Error publishing cast:', error);
    
    return NextResponse.json({ 
      success: false,
      message: 'Ошибка при публикации сообщения',
      error: String(error)
    }, { status: 500 });
  }
} 