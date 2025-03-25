import jwt, { TokenExpiredError } from 'jsonwebtoken';
import { WarpcastUser } from '../types/warpcastAuth';

// Секретный ключ для подписи JWT
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';

// Срок жизни токена - 7 дней
const TOKEN_EXPIRES_IN = '7d';

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
    { expiresIn: TOKEN_EXPIRES_IN }
  );
};

/**
 * Верификация JWT токена
 */
export const verifyToken = (token: string): {
  valid: boolean;
  expired: boolean;
  user: {
    id: string;
    fid: number;
    username: string;
    displayName?: string;
    pfp?: string;
    address?: string;
  } | null;
} => {
  try {
    // Верификация токена
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      fid: number;
      username: string;
      displayName?: string;
      pfp?: string;
      address?: string;
    };
    
    return {
      valid: true,
      expired: false,
      user: decoded
    };
  } catch (error) {
    // Проверяем, истек ли токен
    const isExpired = error instanceof TokenExpiredError;
    
    return {
      valid: false,
      expired: isExpired,
      user: null
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

/**
 * Создание нового JWT токена для пользователя
 */
export function createToken(user: Pick<WarpcastUser, 'fid' | 'username' | 'displayName' | 'pfp' | 'address'> & { id: string }) {
  // Добавляем к payload ID пользователя и время создания токена
  return jwt.sign(
    {
      id: user.id,
      fid: user.fid,
      username: user.username,
      displayName: user.displayName,
      pfp: user.pfp,
      address: user.address,
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
} 