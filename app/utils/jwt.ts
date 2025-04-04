import * as jwt from 'jsonwebtoken';

// Секрет для подписи JWT, должен быть в переменных окружения
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Интерфейс для результата верификации токена
 */
export interface TokenVerificationResult {
  valid: boolean;
  userId?: string;
  error?: string;
}

/**
 * Интерфейс содержимого токена
 */
export interface TokenPayload {
  userId: string;
  exp?: number;
  iat?: number;
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

    return { valid: true, userId: payload.userId };
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