import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sign } from 'jsonwebtoken';
import { verifyJWT } from '@/app/utils/jwt';

// Константы для JWT и refresh токена
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-do-not-use-in-production';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-refresh-secret-do-not-use-in-production';

// Срок действия JWT токена: 1 час
const TOKEN_EXPIRY = '1h';
// Срок действия Refresh токена: 30 дней
const REFRESH_EXPIRY = '30d';

const BASE_URL = process.env.NEXT_PUBLIC_DOMAIN || 'https://snotcoin.online';

/**
 * Генерирует JWT токен для пользователя
 * @param userId ID пользователя
 * @param fid Farcaster ID
 * @param username Имя пользователя
 * @param displayName Отображаемое имя
 * @returns Токен JWT
 */
function generateJWT(userId: string, fid: number, username: string, displayName?: string) {
  try {
    // Создаем токен с информацией о пользователе
    const token = sign(
      {
        fid: String(fid),
        username,
        displayName: displayName || username,
        userId,
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
    
    return token;
  } catch (error) {
    console.error('[API][Auth] Ошибка при генерации JWT:', error);
    throw error;
  }
}

/**
 * Генерирует refresh токен для пользователя
 * @param userId ID пользователя
 * @param fid Farcaster ID
 * @returns Refresh токен
 */
function generateRefreshToken(userId: string, fid: number) {
  try {
    // Создаем refresh токен
    const token = sign(
      {
        fid: String(fid),
        userId,
      },
      REFRESH_SECRET,
      { expiresIn: REFRESH_EXPIRY }
    );
    
    return token;
  } catch (error) {
    console.error('[API][Auth] Ошибка при генерации refresh токена:', error);
    throw error;
  }
}

/**
 * Обработчик запросов на авторизацию через Farcaster
 */
export async function POST(request: NextRequest) {
  try {
    // Получаем данные из запроса
    const body = await request.json();
    const { fid, username, displayName, pfp } = body;

    // Проверяем наличие обязательного поля fid
    if (!fid) {
      console.error('[API][Auth] Отсутствует обязательное поле fid');
      return NextResponse.json({
        success: false,
        message: 'Отсутствует обязательное поле fid'
      }, { status: 400 });
    }

    // Проверяем типы данных
    if (typeof fid !== 'number') {
      console.error('[API][Auth] Неверный тип fid:', typeof fid);
      return NextResponse.json({
        success: false,
        message: 'Параметр fid должен быть числом'
      }, { status: 400 });
    }

    // Создаем стабильный ID пользователя на основе FID
    const mockUserId = `user_${fid}`;
    console.log('[API][Auth] Используется стабильный ID пользователя:', mockUserId);

    try {
      // Генерируем JWT токен
      const accessToken = generateJWT(mockUserId, fid, username || `user${fid}`, displayName);
      
      // Генерируем refresh токен
      const refreshToken = generateRefreshToken(mockUserId, fid);
      
      console.log('[API][Auth] Токены созданы для пользователя', {
        userId: mockUserId,
        accessTokenLength: accessToken.length,
        refreshTokenLength: refreshToken.length
      });
      
      // Устанавливаем куки для refresh токена
      const cookieStore = cookies();
      cookieStore.set({
        name: 'refresh_token',
        value: refreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 дней в секундах
      });
      
      // Возвращаем успешный ответ с токенами и данными пользователя
      return NextResponse.json({
        success: true,
        token: accessToken,
        user: {
          id: mockUserId,
          fid: fid,
          username: username || `user${fid}`,
          displayName: displayName || `User ${fid}`,
          pfp: pfp || 'https://snotcoin.online/images/profile/avatar/default.webp'
        }
      });
    } catch (tokenError) {
      console.error('[API][Auth] Ошибка при создании токенов:', tokenError);
      return NextResponse.json({
        success: false,
        message: 'Ошибка при создании токенов'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[API][Auth] Общая ошибка:', error);
    return NextResponse.json({
      success: false,
      message: 'Ошибка сервера при обработке запроса'
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
    
    // Распарсим userId (формат user_fid)
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