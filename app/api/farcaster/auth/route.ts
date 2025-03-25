import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateJWT, generateRefreshToken, verifyJWT } from '@/app/utils/jwt';

// Секрет для подписи JWT, должен быть в переменных окружения
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const BASE_URL = process.env.NEXT_PUBLIC_DOMAIN || 'https://snotcoin.online';

/**
 * Обработчик запросов на авторизацию через Farcaster
 */
export async function POST(request: NextRequest) {
  try {
    // Логируем начало процесса авторизации
    console.log('Starting Farcaster authentication process');
    
    // Проверяем, что запрос содержит тело
    let body;
    try {
      body = await request.json();
      console.log('Received request body:', JSON.stringify(body));
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json({
        success: false,
        message: 'Неверный формат запроса'
      }, { status: 400 });
    }
    
    // Извлекаем данные пользователя
    const { fid, username, displayName, pfp } = body;
    
    console.log('Extracted auth data:', { 
      fid: fid || 'missing', 
      username: username || 'missing', 
      displayName: displayName || 'missing',
      hasPfp: pfp ? 'yes' : 'no'
    });
    
    // Проверяем обязательные параметры
    if (!fid) {
      console.error('Missing required parameter: fid');
      return NextResponse.json({
        success: false,
        message: 'Отсутствует обязательный параметр fid'
      }, { status: 400 });
    }
    
    // Проверяем типы данных
    if (typeof fid !== 'number') {
      console.error('Invalid fid type:', typeof fid);
      return NextResponse.json({
        success: false,
        message: 'Параметр fid должен быть числом'
      }, { status: 400 });
    }
    
    // Создаем временный ID пользователя без сохранения в БД
    const mockUserId = `user_${fid}_${Date.now()}`;
    console.log('Created mock user ID:', mockUserId);
    
    // Создаем JWT токен
    const { token: accessToken, expiresAt } = await generateJWT(mockUserId);
    
    // Создаем refresh токен
    const { token: refreshToken } = await generateRefreshToken(mockUserId);
    
    console.log('Generated tokens for user', {
      userId: mockUserId,
      accessTokenLength: accessToken.length,
      refreshTokenLength: refreshToken.length,
      expiresAt
    });
    
    try {
      // Устанавливаем основной токен в куки
      cookies().set({
        name: 'session',
        value: accessToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60, // 30 дней
        path: '/'
      });
      
      // Устанавливаем refresh токен в куки
      cookies().set({
        name: 'refresh_token',
        value: refreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 90 * 24 * 60 * 60, // 90 дней
        path: '/'
      });
      
      console.log('Cookies set successfully');
    } catch (cookieError) {
      console.error('Error setting cookies:', cookieError);
      // Продолжаем выполнение, так как токены все равно будут возвращены в ответе
    }
    
    // Формируем ответ с данными пользователя
    const responseData = {
      success: true,
      user: {
        id: mockUserId,
        fid: fid,
        username: username || `user${fid}`,
        displayName: displayName || username || `User ${fid}`,
        pfp: pfp || 'https://snotcoin.online/images/default-avatar.png'
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresAt
      }
    };
    
    console.log('Authentication successful for fid:', fid);
    
    // Возвращаем успешный ответ
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Authentication error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Ошибка аутентификации',
      error: String(error)
    }, { status: 500 });
  }
}

/**
 * Обработчик для проверки текущей сессии
 */
export async function GET(request: NextRequest) {
  try {
    // Получаем куки сессии
    const sessionCookie = cookies().get('session');
    
    if (!sessionCookie) {
      return NextResponse.json({
        authenticated: false,
        message: 'Не найден токен сессии'
      });
    }
    
    // Верифицируем JWT токен
    const { valid, userId, error } = await verifyJWT(sessionCookie.value);
    
    if (!valid || !userId) {
      // Пробуем обновить токен через refresh_token
      const refreshTokenCookie = cookies().get('refresh_token');
      
      if (refreshTokenCookie) {
        // Попытка обновить токены через refresh token
        return NextResponse.json({
          authenticated: false,
          refreshable: true,
          message: 'Токен истек, но может быть обновлен'
        });
      }
      
      return NextResponse.json({
        authenticated: false,
        message: 'Неверный токен сессии',
        error
      });
    }
    
    // Распарсим userId (формат user_fid_timestamp)
    const userParts = userId.split('_');
    const fid = userParts.length > 1 ? userParts[1] : '0';
    
    // Возвращаем информацию о пользователе без обращения к базе данных
    return NextResponse.json({
      authenticated: true,
      user: {
        id: userId,
        fid: Number(fid),
        username: `user${fid}`,
        displayName: `User ${fid}`,
        pfp: 'https://snotcoin.online/images/default-avatar.png'
      }
    });
  } catch (error) {
    console.error('Authentication check error:', error);
    
    return NextResponse.json({
      authenticated: false,
      message: 'Ошибка проверки аутентификации',
      error: String(error)
    }, { status: 500 });
  }
} 