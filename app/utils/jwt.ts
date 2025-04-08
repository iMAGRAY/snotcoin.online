import * as jwt from 'jsonwebtoken';
import { jwtVerify } from 'jose';

// Секрет для подписи JWT, должен быть в переменных окружения
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Интерфейс для результата проверки JWT через jose
export interface JoseAuthResult {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * Интерфейс для результата верификации токена
 */
export interface TokenVerificationResult {
  valid: boolean;
  userId?: string;
  error?: string;
  provider?: string;  // Провайдер аутентификации (e.g., 'farcaster', 'local', 'google', etc.)
}

/**
 * Интерфейс содержимого токена
 */
export interface TokenPayload {
  userId: string;
  fid?: string;      // Farcaster ID
  username?: string; // Имя пользователя
  displayName?: string; // Отображаемое имя
  exp?: number;      // Время истечения токена
  iat?: number;      // Время выдачи токена
  provider?: string; // Провайдер аутентификации
}

/**
 * Синхронно проверяет JWT токен и возвращает декодированный payload или null при ошибке
 * Используется в middleware для быстрой проверки
 * @param token JWT токен для проверки
 * @returns Декодированный payload или null при ошибке
 */
export function verify(token: string): TokenPayload | null {
  try {
    if (!token) {
      return null;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[JWT] Отсутствует JWT_SECRET в переменных окружения');
      return null;
    }

    // Верифицируем токен синхронно
    const payload = jwt.verify(token, jwtSecret) as TokenPayload;
    
    // Проверяем наличие userId в payload
    if (!payload || !payload.userId) {
      return null;
    }

    return payload;
  } catch (error) {
    // При любой ошибке возвращаем null
    return null;
  }
}

/**
 * Проверяет JWT токен и возвращает информацию о его валидности
 * @param token JWT токен для проверки
 * @returns Объект с результатами проверки
 */
export async function verifyJWT(token: string): Promise<TokenVerificationResult> {
  try {
    if (!token) {
      return { valid: false, error: 'TOKEN_MISSING' };
    }

    // Получаем секрет из переменных окружения
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[JWT] Отсутствует JWT_SECRET в переменных окружения');
      return { valid: false, error: 'SERVER_CONFIGURATION_ERROR' };
    }

    // Верифицируем токен
    const payload = jwt.verify(token, jwtSecret) as TokenPayload;
    
    // Проверяем наличие userId в payload
    if (!payload || !payload.userId) {
      return { valid: false, error: 'INVALID_TOKEN_FORMAT' };
    }

    // Проверяем срок действия токена
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'TOKEN_EXPIRED' };
    }

    // Определяем провайдер на основе информации в токене
    let provider = payload.provider || 'unknown';
    
    // Если провайдер не указан явно, пытаемся определить его из userId
    if (provider === 'unknown' && payload.userId) {
      if (payload.userId.startsWith('farcaster_') || payload.userId.startsWith('user_')) {
        provider = 'farcaster';
      } else if (payload.userId.startsWith('google_')) {
        provider = 'google';
      } else if (payload.userId.startsWith('local_')) {
        provider = 'local';
      }
      // Можно добавить другие провайдеры по мере необходимости
    }

    return { valid: true, userId: payload.userId, provider };
  } catch (error) {
    // Обрабатываем различные ошибки JWT
    if (error instanceof jwt.JsonWebTokenError) {
      return { valid: false, error: 'INVALID_SIGNATURE' };
    } else if (error instanceof jwt.NotBeforeError) {
      return { valid: false, error: 'TOKEN_NOT_ACTIVE' };
    } else if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, error: 'TOKEN_EXPIRED' };
    } else {
      console.error('[JWT] Unexpected error during token verification:', error);
      return { valid: false, error: 'VERIFICATION_ERROR' };
    }
  }
}

/**
 * Извлекает токен из HTTP заголовка Authorization или URL параметров
 * @param authHeader Заголовок Authorization
 * @param tokenFromUrl Токен из URL параметров
 * @returns Извлеченный токен или null
 */
export function extractToken(authHeader?: string | null, tokenFromUrl?: string | null): string | null {
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  } else if (tokenFromUrl) {
    return tokenFromUrl;
  }
  return null;
}

/**
 * Проверяет JWT токен с использованием библиотеки jose
 * @param token JWT токен для проверки
 * @returns Результат проверки с данными пользователя
 */
export async function verifyJWTJose(token: string): Promise<JoseAuthResult> {
  try {
    // Декодируем секрет
    const secret = new TextEncoder().encode(JWT_SECRET);
    
    // Проверяем токен
    const { payload } = await jwtVerify(token, secret);
    
    // Проверяем наличие userId в payload
    if (!payload || !payload.userId) {
      return { 
        success: false, 
        error: 'Invalid token payload' 
      };
    }
    
    // Возвращаем успешный результат с данными пользователя
    return { 
      success: true, 
      userId: payload.userId as string 
    };
  } catch (error) {
    // Обрабатываем ошибки проверки токена
    console.error('[JWT] JWT verification error:', error);
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during token verification' 
    };
  }
}

/**
 * Подписывает данные для создания токена JWT
 * @param payload Данные для подписи
 * @param expiresIn Время истечения токена (например, '1h', '30d')
 * @returns Подписанный токен JWT
 */
export function sign(payload: Record<string, any>, expiresIn?: string | number): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('[JWT] JWT_SECRET не найден в переменных окружения');
    throw new Error('JWT_SECRET is required');
  }
  
  // Создаем объект настроек вручную, вместо inline-объекта
  const options: Record<string, any> = {};
  if (expiresIn !== undefined) {
    options.expiresIn = expiresIn;
  }
  
  return jwt.sign(payload, jwtSecret, options);
} 