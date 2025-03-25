import { NextResponse } from 'next/server';
import { verifyToken } from '../../../utils/jwt';
import { UserModel } from '../../../utils/models';
import { AuthStep, logAuthInfo, logAuthError } from '../../../utils/auth-logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Обработчик запроса проверки статуса сессии
 */
export async function POST(request: Request) {
  logAuthInfo(AuthStep.SERVER_REQUEST, 'Начало проверки сессии');
  
  try {
    // Получаем данные из запроса
    let requestData;
    try {
      requestData = await request.json();
      logAuthInfo(AuthStep.SERVER_REQUEST, 'Получены данные запроса', { hasFid: !!requestData?.fid });
    } catch (err) {
      logAuthError(
        AuthStep.SERVER_ERROR,
        'Ошибка при парсинге тела запроса',
        err instanceof Error ? err : new Error('Invalid request body')
      );
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Получаем токен из заголовка
    const authHeader = request.headers.get('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : requestData?.token;
    
    if (!token) {
      logAuthError(
        AuthStep.SERVER_ERROR,
        'Отсутствует токен авторизации',
        new Error('Token is required')
      );
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 401 }
      );
    }

    // Проверяем валидность токена
    const { valid, expired, user } = verifyToken(token);
    
    if (!valid || !user) {
      logAuthError(
        AuthStep.SERVER_ERROR,
        'Недействительный токен авторизации',
        new Error(expired ? 'Token expired' : 'Invalid token')
      );
      return NextResponse.json(
        { 
          valid: false,
          expired,
          error: expired ? 'Token expired' : 'Invalid token'
        },
        { status: 401 }
      );
    }

    // Проверяем наличие токена в базе данных
    try {
      logAuthInfo(AuthStep.DATABASE_QUERY, 'Проверка токена в базе данных', { fid: user.fid });
      const dbUser = await UserModel.findByFid(user.fid);
      
      if (!dbUser || dbUser.jwt_token !== token) {
        logAuthError(
          AuthStep.SERVER_ERROR,
          'Токен не найден в базе данных',
          new Error('Token not found in database')
        );
        return NextResponse.json(
          { 
            valid: false, 
            error: 'Token not found in database' 
          },
          { status: 401 }
        );
      }
      
      // Токен валиден
      logAuthInfo(AuthStep.SERVER_RESPONSE, 'Токен валиден, сессия активна', { 
        userId: dbUser.id,
        fid: user.fid
      });
      
      return NextResponse.json({
        valid: true,
        user: {
          id: dbUser.id,
          fid: user.fid,
          username: user.username,
          displayName: user.displayName,
          pfp: user.pfp,
          address: user.address
        }
      });
    } catch (dbError) {
      logAuthError(
        AuthStep.SERVER_ERROR,
        'Ошибка при проверке токена в базе данных',
        dbError instanceof Error ? dbError : new Error('Database error')
      );
      
      return NextResponse.json(
        { 
          valid: false, 
          error: 'Database error during token validation'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logAuthError(
      AuthStep.SERVER_ERROR,
      'Критическая ошибка при проверке сессии',
      error instanceof Error ? error : new Error('Server error')
    );
    
    return NextResponse.json(
      { 
        valid: false, 
        error: 'Server error'
      },
      { status: 500 }
    );
  }
} 