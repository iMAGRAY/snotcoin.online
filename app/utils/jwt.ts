import { SignJWT, jwtVerify, decodeJwt } from 'jose';
import { PrismaClient } from '@prisma/client';
import { UserModel } from './models';

// Создаем клиент, но больше не используем его активно
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

// Функция для генерации refresh токена без взаимодействия с БД
export async function generateRefreshToken(userId: string): Promise<{ token: string, expiresAt: Date }> {
  const refreshToken = generateRandomToken(64);
  const expiresIn = 90 * 24 * 60 * 60; // 90 дней в секундах
  
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
  
  console.log(`Создан refresh токен для пользователя ${userId}, истекает ${expiresAt.toISOString()}`);
  
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
    console.log('Попытка обновления токенов через refresh token:', refreshToken.substring(0, 10) + '...');
    
    // Декодируем старый токен для получения userId
    // В будущей версии нужно реализовать полную проверку refresh токена в БД
    const decoded = decodeJwt(refreshToken);
    const userId = decoded.userId as string;
    
    if (!userId) {
      throw new Error('Не удалось получить userId из refresh токена');
    }

    console.log(`Обновление токенов для пользователя ${userId}`);
    
    // Генерируем новый access токен
    const { token: newAccessToken, expiresAt } = await generateJWT(userId);
    
    // Генерируем новый refresh токен
    const { token: newRefreshToken } = await generateRefreshToken(userId);
    
    // Сохраняем токен в базе данных
    await UserModel.updateToken(userId, newAccessToken);
    
    console.log('Токены успешно обновлены и сохранены в БД');
    
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt,
      success: true,
      userId
    };
  } catch (error) {
    console.error('Ошибка при обновлении токенов:', error);
    
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