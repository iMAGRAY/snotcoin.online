import jwt from 'jsonwebtoken';
import { WarpcastUser } from '../types/warpcastAuth';

// Секретный ключ для подписи JWT
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';

// Срок действия токена (30 дней)
const TOKEN_EXPIRATION = '30d';

/**
 * Генерация JWT токена для пользователя
 */
export const generateToken = (user: {
  id: string;
  fid: number;
  username: string;
  displayName?: string | null;
  pfp?: string | null;
  address?: string | null;
}): string => {
  return jwt.sign(
    {
      id: user.id,
      fid: user.fid,
      username: user.username,
      displayName: user.displayName || null,
      pfp: user.pfp || null,
      address: user.address || null
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRATION }
  );
};

/**
 * Верификация JWT токена
 */
export const verifyToken = (token: string): {
  valid: boolean;
  expired: boolean;
  user?: WarpcastUser;
} => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    return {
      valid: true,
      expired: false,
      user: {
        fid: decoded.fid,
        username: decoded.username,
        displayName: decoded.displayName,
        pfp: decoded.pfp,
        address: decoded.address
      }
    };
  } catch (error) {
    // Проверяем, истек ли токен
    const isExpired = (error as any).name === 'TokenExpiredError';
    
    return {
      valid: false,
      expired: isExpired,
      user: undefined
    };
  }
};

/**
 * Декодирование JWT токена без верификации
 */
export const decodeToken = (token: string): WarpcastUser | null => {
  try {
    // Декодируем без проверки подписи
    const decoded = jwt.decode(token) as any;
    
    if (!decoded) return null;
    
    return {
      fid: decoded.fid,
      username: decoded.username,
      displayName: decoded.displayName,
      pfp: decoded.pfp,
      address: decoded.address
    };
  } catch (error) {
    console.error('Ошибка декодирования токена:', error);
    return null;
  }
}; 