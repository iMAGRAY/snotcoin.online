import { NextResponse } from 'next/server';
import { verifyToken } from '../../../utils/jwt';
import { UserModel } from '../../../utils/models';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Обработчик запроса проверки статуса сессии
 */
export async function POST(request: Request) {
  try {
    // Получаем данные от клиента
    let requestData;
    try {
      requestData = await request.json();
    } catch (err) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Проверяем наличие токена
    const { token } = requestData;
    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Проверяем валидность токена
    const { valid, user, error } = verifyToken(token);
    
    if (!valid || !user) {
      return NextResponse.json(
        { 
          valid: false, 
          error: error || 'Invalid token'
        },
        { status: 401 }
      );
    }

    // Проверяем наличие токена в базе данных
    try {
      const dbUser = await UserModel.findByTelegramId(user.telegram_id);
      
      if (!dbUser || dbUser.jwt_token !== token) {
        return NextResponse.json(
          { 
            valid: false, 
            error: 'Token not found in database' 
          },
          { status: 401 }
        );
      }
      
      // Токен валиден
      return NextResponse.json({
        valid: true,
        user: {
          id: user.id,
          telegram_id: user.telegram_id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name
        }
      });
    } catch (dbError) {
      console.error('Ошибка при проверке токена в базе данных:', dbError);
      
      return NextResponse.json(
        { 
          valid: false, 
          error: 'Database error during token validation'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Критическая ошибка при проверке сессии:', error);
    
    return NextResponse.json(
      { 
        valid: false, 
        error: 'Server error'
      },
      { status: 500 }
    );
  }
} 