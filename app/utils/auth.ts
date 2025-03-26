/**
 * Утилиты для аутентификации
 */
import { jwtVerify } from 'jose';
import { AuthResult } from '../types/apiTypes';

// Секрет для подписи JWT, должен быть в переменных окружения
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Проверяет JWT токен на валидность
 * @param token JWT токен для проверки
 * @returns Результат проверки с данными пользователя
 */
export async function verifyJWT(token: string): Promise<AuthResult> {
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