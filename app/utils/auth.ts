/**
 * Утилиты для аутентификации
 */
import * as jwt from 'jsonwebtoken';
import { AuthResult } from '../types/apiTypes';
import { jwtVerify } from 'jose';
import { logger } from '../lib/logger';
import { redisService } from '../services/redis';

// Секрет для подписи JWT, должен быть в переменных окружения
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Время жизни токена в секундах (по умолчанию 24 часа)
const TOKEN_LIFETIME = 24 * 60 * 60;

// Список отозванных токенов
interface RevokedToken {
  jti: string;
  exp: number;
  reason: string;
}

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
 * Результат проверки JWT-токена
 */
interface JWTVerifyResult {
  valid: boolean;
  userId?: string;
  error?: string;
  tokenInfo?: {
    jti: string;
    iat: number;
    exp: number;
    roles?: string[];
  };
}

/**
 * Проверяет JWT-токен и извлекает userId
 * @param token JWT-токен для проверки
 * @returns Результат проверки с userId, если токен действителен
 */
export async function verifyJWT(token: string): Promise<JWTVerifyResult> {
  try {
    // Проверяем, что токен не пустой
    if (!token || token.trim() === '') {
      return {
        valid: false,
        error: 'TOKEN_EMPTY'
      };
    }

    // Получаем секретный ключ из переменных окружения
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET не настроен в переменных окружения');
      return {
        valid: false,
        error: 'SERVER_CONFIG_ERROR'
      };
    }

    // Проверяем токен без проверки подписи, чтобы получить jti
    const decodedWithoutVerify = jwt.decode(token);
    if (!decodedWithoutVerify || typeof decodedWithoutVerify !== 'object' || !decodedWithoutVerify.jti) {
      return {
        valid: false,
        error: 'INVALID_TOKEN_FORMAT'
      };
    }

    // Проверяем, не отозван ли токен
    const tokenRevoked = await isTokenRevoked(decodedWithoutVerify.jti as string);
    if (tokenRevoked) {
      logger.warn('Попытка использования отозванного токена', {
        jti: decodedWithoutVerify.jti
      });
      
      // Логируем событие безопасности
      await redisService.logSecurityEvent({
        type: 'revoked_token_used',
        userId: decodedWithoutVerify.sub as string || 'unknown',
        clientId: 'unknown',
        clientIp: 'unknown',
        timestamp: Date.now(),
        details: {
          jti: decodedWithoutVerify.jti,
          tokExp: decodedWithoutVerify.exp
        }
      });
      
      return {
        valid: false,
        error: 'TOKEN_REVOKED'
      };
    }

    // Проверяем токен полностью с подписью
    const decoded = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    if (!decoded || typeof decoded !== 'object') {
      return {
        valid: false,
        error: 'INVALID_TOKEN'
      };
    }

    // Проверяем наличие идентификатора пользователя
    if (!decoded.sub) {
      return {
        valid: false,
        error: 'MISSING_USER_ID'
      };
    }

    // Проверяем, не истек ли срок действия
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      return {
        valid: false,
        error: 'TOKEN_EXPIRED',
        userId: decoded.sub as string
      };
    }

    // Получаем информацию о последних событиях безопасности для пользователя
    const redis = await redisService.getClient();
    if (redis) {
      const securityKey = `security:user:${decoded.sub}`;
      const securityEvents = await redis.hgetall(securityKey);
      
      // Если есть подозрительные события, логируем использование токена
      if (securityEvents && Object.keys(securityEvents).length > 0) {
        const suspiciousEvents = Object.entries(securityEvents)
          .filter(([key, _]) => ['invalid_token', 'flood_attack', 'brute_force'].includes(key))
          .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
          
        if (Object.keys(suspiciousEvents).length > 0) {
          logger.info('Токен использован пользователем с подозрительной активностью', {
            userId: decoded.sub,
            events: suspiciousEvents
          });
        }
      }
    }

    return {
      valid: true,
      userId: decoded.sub as string,
      tokenInfo: {
        jti: decoded.jti as string,
        iat: decoded.iat as number,
        exp: decoded.exp as number,
        roles: decoded.roles as string[] || []
      }
    };
  } catch (error) {
    logger.error('Ошибка при проверке JWT', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    };
  }
}

/**
 * Создает новый JWT-токен для пользователя
 * @param userId ID пользователя
 * @param roles Роли пользователя
 * @param expiresIn Время жизни токена в секундах
 * @returns JWT-токен
 */
export function createJWT(userId: string, roles: string[] = [], expiresIn: number = TOKEN_LIFETIME): string {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET не настроен в переменных окружения');
    }
    
    // Создаем уникальный идентификатор токена
    const jti = generateTokenId();
    
    const token = jwt.sign(
      {
        sub: userId,
        roles,
        jti
      },
      jwtSecret,
      { expiresIn }
    );
    
    return token;
  } catch (error) {
    logger.error('Ошибка при создании JWT', {
      error: error instanceof Error ? error.message : String(error),
      userId
    });
    throw error;
  }
}

/**
 * Проверяет, был ли токен отозван
 * @param jti Идентификатор токена
 * @returns true если токен отозван
 */
async function isTokenRevoked(jti: string): Promise<boolean> {
  try {
    const redis = await redisService.getClient();
    if (!redis) return false;
    
    const key = `revoked_token:${jti}`;
    const result = await redis.exists(key);
    
    return result > 0;
  } catch (error) {
    logger.error('Ошибка при проверке отозванного токена', {
      error: error instanceof Error ? error.message : String(error),
      jti
    });
    return false;
  }
}

/**
 * Отзывает токен
 * @param token JWT-токен для отзыва
 * @param reason Причина отзыва
 * @returns true если токен успешно отозван
 */
export async function revokeToken(token: string, reason: string = 'user_logout'): Promise<boolean> {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET не настроен в переменных окружения');
      return false;
    }
    
    // Расшифровываем токен
    const decoded = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    if (!decoded || typeof decoded !== 'object' || !decoded.jti) {
      return false;
    }
    
    const jti = decoded.jti as string;
    const exp = decoded.exp as number;
    const userId = decoded.sub as string;
    
    // Вычисляем, сколько секунд осталось до истечения срока действия
    const now = Math.floor(Date.now() / 1000);
    const ttl = exp > now ? exp - now : 60; // Если срок уже истек, сохраняем на 1 минуту
    
    // Сохраняем отозванный токен в Redis до истечения срока его действия
    const redis = await redisService.getClient();
    if (!redis) return false;
    
    const key = `revoked_token:${jti}`;
    await redis.set(key, JSON.stringify({ jti, exp, reason, userId }));
    await redis.expire(key, ttl);
    
    logger.info('Токен отозван', { userId, reason, jti });
    return true;
  } catch (error) {
    logger.error('Ошибка при отзыве токена', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Генерирует уникальный идентификатор для токена
 * @returns Уникальный идентификатор
 */
function generateTokenId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
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
 * Проверяет JWT токен на валидность
 * @param token JWT токен для проверки
 * @returns Результат проверки с данными пользователя
 */
export async function verifyJWTJose(token: string): Promise<AuthResult> {
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
    console.error('[Auth] JWT verification error:', error);
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during token verification' 
    };
  }
} 