import jwt from 'jsonwebtoken';
import { TelegramUser } from '../types/telegramAuth';

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'default-secret-key-not-for-production';
const JWT_EXPIRATION = '7d'; // Токен действителен 7 дней

/**
 * Создает JWT токен для пользователя
 */
export const generateToken = (user: {
  id: string;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}): string => {
  const payload = {
    sub: user.id,
    telegram_id: user.telegram_id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
};

/**
 * Проверяет валидность JWT токена
 */
export const verifyToken = (token: string): { 
  valid: boolean; 
  user?: TelegramUser; 
  error?: string 
} => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    return { 
      valid: true,
      user: {
        id: decoded.sub,
        telegram_id: decoded.telegram_id,
        username: decoded.username || '',
        first_name: decoded.first_name || '',
        last_name: decoded.last_name || ''
      }
    };
  } catch (error) {
    return { 
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid token'
    };
  }
};

/**
 * Декодирует JWT токен без проверки подписи
 */
export const decodeToken = (token: string): TelegramUser | null => {
  try {
    const decoded = jwt.decode(token) as any;
    
    if (!decoded || !decoded.sub) {
      return null;
    }
    
    return {
      id: decoded.sub,
      telegram_id: decoded.telegram_id,
      username: decoded.username || '',
      first_name: decoded.first_name || '',
      last_name: decoded.last_name || ''
    };
  } catch (error) {
    console.error('Ошибка декодирования токена:', error);
    return null;
  }
}; 