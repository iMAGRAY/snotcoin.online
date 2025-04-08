import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sign, verifyJWT } from '@/app/utils/jwt';
import { validateFarcasterUser, verifyFarcasterSignature } from '@/app/utils/neynarApi';
import { ENV } from '@/app/lib/env';

// Константы для JWT и refresh токена
const JWT_SECRET = ENV.JWT_SECRET;
const REFRESH_SECRET = ENV.REFRESH_SECRET || JWT_SECRET;

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
    // Создаем токен с минимальной необходимой информацией о пользователе
    const payload = {
      fid: String(fid),
      username,
      displayName: displayName || username,
      userId,
      provider: 'farcaster'
    };
    
    return sign(payload, TOKEN_EXPIRY);
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
    const payload = {
      fid: String(fid),
      userId,
      provider: 'farcaster'
    };
    
    return sign(payload, REFRESH_EXPIRY);
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
    const { fid, username, displayName, pfp, message, signature } = body;

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

    // Определяем, находимся ли мы в режиме разработки
    // Если NODE_ENV не определен или пуст, считаем что это режим разработки
    const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    
    // Логируем текущий режим
    console.log('[API][Auth] Текущий режим:', isDevelopment ? 'development' : 'production');

    // Режим разработки - упрощенная проверка
    if (isDevelopment) {
      console.log('[API][Auth] Режим разработки: пропускаем проверку Neynar');
      
      // Создаем стабильный ID пользователя на основе FID
      const mockUserId = `user_${fid}`;
      const validUsername = username || `user${fid}`;
      const validDisplayName = displayName || `User ${fid}`;
      const validPfp = pfp || 'https://warpcast.com/~/default-avatar.png';
      
      try {
        // Генерируем JWT токен
        const accessToken = generateJWT(mockUserId, fid, validUsername, validDisplayName);
        
        // Генерируем refresh токен
        const refreshToken = generateRefreshToken(mockUserId, fid);
        
        console.log('[API][Auth] Режим разработки: Токены созданы для пользователя', {
          userId: mockUserId,
          username: validUsername,
          accessTokenLength: accessToken.length,
          refreshTokenLength: refreshToken.length
        });
        
        // Устанавливаем куки для refresh токена
        const cookieStore = cookies();
        cookieStore.set({
          name: 'refresh_token',
          value: refreshToken,
          httpOnly: true,
          secure: !isDevelopment, // secure только если не в режиме разработки
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
            username: validUsername,
            displayName: validDisplayName,
            pfp: validPfp,
            verified: true // В режиме разработки всегда считаем пользователя верифицированным
          }
        });
      } catch (tokenError) {
        console.error('[API][Auth] Ошибка при создании токенов:', tokenError);
        return NextResponse.json({
          success: false,
          message: 'Ошибка при создании токенов'
        }, { status: 500 });
      }
    }

    // Production режим - полная проверка через Neynar
    // Проверяем валидность пользователя через Neynar API
    const neynarValidation = await validateFarcasterUser(fid);
    
    // Если пользователь не прошел валидацию
    if (!neynarValidation) {
      console.error('[API][Auth] Пользователь не прошел валидацию Neynar');
      return NextResponse.json({
        success: false,
        message: 'Не удалось подтвердить аккаунт Farcaster'
      }, { status: 401 });
    }
    
    // Проверяем подпись, если она предоставлена
    if (message && signature) {
      const isSignatureValid = await verifyFarcasterSignature(fid, message, signature);
      
      if (!isSignatureValid) {
        console.error('[API][Auth] Невалидная подпись Farcaster');
        return NextResponse.json({
          success: false,
          message: 'Недействительная подпись Farcaster'
        }, { status: 401 });
      }
      
      console.log('[API][Auth] Подпись Farcaster успешно проверена');
    } else {
      console.warn('[API][Auth] Подпись не предоставлена, пропускаем проверку');
    }
    
    // Проверяем, что имя пользователя совпадает с валидированным
    const validUsername = neynarValidation.user.username;
    if (username && username !== validUsername) {
      console.warn('[API][Auth] Несоответствие имени пользователя:', { 
        provided: username, 
        validated: validUsername 
      });
      // Используем валидированные данные вместо предоставленных
    }

    // Создаем стабильный ID пользователя на основе FID
    const mockUserId = `user_${fid}`;
    console.log('[API][Auth] Используется стабильный ID пользователя:', mockUserId);

    try {
      // Используем валидированные данные для создания токенов
      const validDisplayName = neynarValidation.user.displayName || validUsername;
      const validPfp = neynarValidation.user.pfp?.url;
      
      // Генерируем JWT токен
      const accessToken = generateJWT(mockUserId, fid, validUsername, validDisplayName);
      
      // Генерируем refresh токен
      const refreshToken = generateRefreshToken(mockUserId, fid);
      
      console.log('[API][Auth] Токены созданы для пользователя', {
        userId: mockUserId,
        username: validUsername,
        accessTokenLength: accessToken.length,
        refreshTokenLength: refreshToken.length
      });
      
      // Устанавливаем куки для refresh токена
      const cookieStore = cookies();
      cookieStore.set({
        name: 'refresh_token',
        value: refreshToken,
        httpOnly: true,
        secure: !isDevelopment, // secure только если не в режиме разработки
        sameSite: 'strict',
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 дней в секундах
      });
      
      // Не сохраняем токены в базе данных, т.к. они уже в куки
      // Это упрощает систему и уменьшает зависимость от БД
      
      // Возвращаем успешный ответ с токенами и данными пользователя
      return NextResponse.json({
        success: true,
        token: accessToken,
        user: {
          id: mockUserId,
          fid: fid,
          username: validUsername,
          displayName: validDisplayName,
          pfp: validPfp || 'https://snotcoin.online/images/profile/avatar/default.webp',
          verified: true // Пользователь прошел валидацию
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