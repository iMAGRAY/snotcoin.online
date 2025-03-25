import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BASE_URL = process.env.NEXT_PUBLIC_DOMAIN || 'https://snotcoin.online';

/**
 * Обработчик запросов на авторизацию через Farcaster
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, username, displayName, pfp } = body;
    
    if (!fid || !username) {
      return NextResponse.json({ 
        success: false, 
        message: 'Не указаны обязательные поля' 
      }, { status: 400 });
    }
    
    // Создаем объект с данными пользователя
    const userData = {
      fid,
      username,
      displayName: displayName || username,
      pfp: pfp || null
    };
    
    // Сохраняем данные пользователя в cookie
    // В реальном приложении лучше использовать JWT или другой механизм
    cookies().set({
      name: 'session',
      value: JSON.stringify(userData),
      httpOnly: true,
      path: '/',
      // secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 дней
    });
    
    return NextResponse.json({ 
      success: true,
      user: userData
    });
  } catch (error) {
    console.error('Auth error:', error);
    
    return NextResponse.json({ 
      success: false,
      message: 'Произошла ошибка при авторизации',
      error: String(error)
    }, { status: 500 });
  }
}

/**
 * Обработчик для проверки текущей сессии
 */
export async function GET(request: NextRequest) {
  try {
    // Проверяем наличие сессионного cookie
    const sessionCookie = cookies().get('session');
    
    if (!sessionCookie) {
      return NextResponse.json({ 
        authenticated: false,
        message: 'Пользователь не авторизован' 
      });
    }

    // Здесь в реальном приложении нужно было бы проверить валидность сессии
    // Например, проверить JWT токен или обратиться к базе данных
    
    // Для упрощения примера, мы считаем, что если есть cookie, то пользователь авторизован
    // и извлекаем данные пользователя из cookie (предполагая, что оно содержит JSON)
    try {
      const userData = JSON.parse(sessionCookie.value);
      
      return NextResponse.json({
        authenticated: true,
        user: userData
      });
    } catch (parseError) {
      console.error('Error parsing session cookie:', parseError);
      
      // Если не удалось распарсить cookie, считаем сессию невалидной
      cookies().delete('session');
      
      return NextResponse.json({ 
        authenticated: false,
        message: 'Невалидная сессия' 
      });
    }
  } catch (error) {
    console.error('Auth check error:', error);
    
    return NextResponse.json({ 
      authenticated: false,
      message: 'Произошла ошибка при проверке авторизации',
      error: String(error)
    }, { status: 500 });
  }
} 