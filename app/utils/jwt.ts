import { SignJWT, jwtVerify, decodeJwt } from 'jose';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Секрет для подписи JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Функция для генерации случайного строкового токена
export function generateRandomToken(length: number = 32): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  
  return result;
}

// Функция для создания JWT токена
export async function generateJWT(userId: string): Promise<{ token: string, expiresAt: Date }> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  const expiresIn = 30 * 24 * 60 * 60; // 30 дней в секундах
  
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
  
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret);
  
  return { token, expiresAt };
}

// Функция для генерации refresh токена
export async function generateRefreshToken(userId: string): Promise<{ token: string, expiresAt: Date }> {
  const refreshToken = generateRandomToken(64);
  const expiresIn = 90 * 24 * 60 * 60; // 90 дней в секундах
  
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
  
  try {
    // Сохраняем refresh токен в базе данных
    await prisma.user.update({
      where: { id: userId },
      data: {
        jwt_token: refreshToken
        // Примечание: поле token_expires_at было удалено, так как оно отсутствует в схеме Prisma
      }
    });
  } catch (error) {
    console.error('Ошибка при сохранении refresh токена:', error);
  }
  
  return { token: refreshToken, expiresAt };
}

// Функция для проверки JWT токена
export async function verifyJWT(token: string): Promise<{ userId: string, valid: boolean, error?: string }> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    if (!payload || !payload.userId) {
      return { userId: '', valid: false, error: 'Invalid token payload' };
    }
    
    return { userId: payload.userId as string, valid: true };
  } catch (error) {
    return { 
      userId: '', 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown error during token verification' 
    };
  }
}

// Функция для обновления токенов с помощью refresh токена
export async function refreshTokens(refreshToken: string): Promise<{ 
  accessToken: string, 
  refreshToken: string, 
  expiresAt: Date,
  success: boolean,
  userId?: string,
  error?: string
}> {
  try {
    // Ищем пользователя с данным refresh токеном
    const user = await prisma.user.findFirst({
      where: {
        jwt_token: refreshToken
        // Примечание: условие token_expires_at было удалено, так как оно отсутствует в схеме Prisma
      }
    });
    
    if (!user) {
      return { 
        accessToken: '', 
        refreshToken: '', 
        expiresAt: new Date(), 
        success: false,
        error: 'Invalid refresh token or token expired' 
      };
    }
    
    // Генерируем новый access токен
    const { token: newAccessToken, expiresAt } = await generateJWT(user.id);
    
    // Генерируем новый refresh токен
    const { token: newRefreshToken } = await generateRefreshToken(user.id);
    
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt,
      success: true,
      userId: user.id
    };
  } catch (error) {
    return { 
      accessToken: '', 
      refreshToken: '', 
      expiresAt: new Date(), 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during token refresh' 
    };
  }
}

// Функция для декодирования JWT токена без проверки подписи
export function decodeToken(token: string): { userId?: string, [key: string]: any } | null {
  try {
    const decoded = decodeJwt(token);
    return decoded as { userId?: string, [key: string]: any };
  } catch (error) {
    console.error('Ошибка декодирования токена:', error);
    return null;
  }
} 