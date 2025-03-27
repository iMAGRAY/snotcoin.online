import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sign } from 'jsonwebtoken';
import { neynarService } from '@/app/services/auth/neynarService';
import { logAuth, AuthStep, AuthLogType } from '@/app/utils/auth-logger';
import { UserData } from '@/app/types/auth';
import { FarcasterContext } from '@/app/types/farcaster';
import { prisma } from '@/app/lib/prisma';

// Константы для JWT и refresh токена
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-do-not-use-in-production';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-refresh-secret-do-not-use-in-production';

// Срок действия JWT токена: 1 час
const TOKEN_EXPIRY = '1h';
// Срок действия Refresh токена: 30 дней
const REFRESH_EXPIRY = '30d';

/**
 * API для авторизации через Warpcast
 * Принимает данные пользователя, валидирует через Neynar,
 * затем сохраняет пользователя и возвращает токены
 */
export async function POST(request: NextRequest) {
  try {
    logAuth(AuthStep.AUTH_START, AuthLogType.INFO, 'Начало авторизации через Warpcast');
    
    // Получаем данные пользователя из запроса
    const userData = await request.json() as FarcasterContext;
    
    // Проверяем наличие обязательных полей
    if (!userData || !userData.fid) {
      logAuth(
        AuthStep.VALIDATE_ERROR, 
        AuthLogType.ERROR, 
        'Отсутствуют обязательные поля в запросе',
        { userData }
      );
      
      return NextResponse.json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Отсутствуют обязательные поля в запросе'
      }, { status: 400 });
    }
    
    // Валидируем данные пользователя через Neynar API
    const validationResult = await neynarService.validateFarcasterUser(userData);
    
    if (!validationResult.isValid || !validationResult.user) {
      logAuth(
        AuthStep.VALIDATE_ERROR, 
        AuthLogType.ERROR, 
        'Ошибка валидации данных пользователя', 
        { error: validationResult.error }
      );
      
      return NextResponse.json({
        success: false,
        error: 'VALIDATION_FAILED',
        message: validationResult.error || 'Не удалось подтвердить данные пользователя'
      }, { status: 401 });
    }
    
    // Сохраняем пользователя в базе данных
    const saveResult = await neynarService.saveUserToDatabase(validationResult.user);
    
    if (!saveResult.success || !saveResult.user) {
      logAuth(
        AuthStep.USER_SAVE, 
        AuthLogType.ERROR, 
        'Ошибка сохранения пользователя в БД', 
        { error: saveResult.error }
      );
      
      return NextResponse.json({
        success: false,
        error: 'USER_SAVE_FAILED',
        message: saveResult.error || 'Не удалось сохранить пользователя'
      }, { status: 500 });
    }
    
    // Убедимся, что у нас есть ID пользователя
    const userId = saveResult.user.id;
    const fid = saveResult.user.fid;
    
    // Генерируем JWT токен
    const token = sign(
      {
        userId,
        fid,
        username: saveResult.user.username,
        displayName: saveResult.user.displayName,
        provider: 'farcaster'
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
    
    // Генерируем refresh токен
    const refreshToken = sign(
      {
        userId,
        fid,
        provider: 'farcaster'
      },
      REFRESH_SECRET,
      { expiresIn: REFRESH_EXPIRY }
    );
    
    // Сохраняем refresh токен в куки
    cookies().set({
      name: 'refresh_token',
      value: refreshToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 // 30 дней в секундах
    });
    
    // Загружаем прогресс игры
    let gameState = null;
    try {
      // Загружаем прогресс из БД напрямую
      const progress = await prisma.progress.findUnique({
        where: { user_id: userId }
      });
      
      if (progress && progress.game_state) {
        // Если game_state - строка, преобразуем в объект
        if (typeof progress.game_state === 'string') {
          gameState = JSON.parse(progress.game_state);
        } else {
          gameState = progress.game_state;
        }
      }
    } catch (error) {
      logAuth(
        AuthStep.AUTH_COMPLETE, 
        AuthLogType.WARNING, 
        'Ошибка загрузки прогресса игры', 
        { userId },
        error
      );
    }
    
    logAuth(
      AuthStep.AUTH_COMPLETE, 
      AuthLogType.INFO, 
      'Авторизация через Warpcast успешно завершена', 
      { userId }
    );
    
    // Возвращаем успешный ответ
    return NextResponse.json({
      success: true,
      token,
      user: {
        id: userId,
        fid: Number(fid),
        username: saveResult.user.username,
        displayName: saveResult.user.displayName || saveResult.user.username,
        avatar: saveResult.user.pfpUrl,
        verified: saveResult.user.verified
      },
      gameState: gameState ? {
        exists: true,
        lastSaved: gameState._savedAt || null,
        version: gameState._saveVersion || 1
      } : {
        exists: false
      }
    });
  } catch (error) {
    logAuth(
      AuthStep.AUTH_ERROR, 
      AuthLogType.ERROR, 
      'Непредвиденная ошибка при авторизации через Warpcast', 
      {},
      error
    );
    
    return NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера'
    }, { status: 500 });
  }
}

/**
 * Проверяет текущую сессию пользователя
 */
export async function GET(request: NextRequest) {
  try {
    // Получаем токен из cookies или заголовка
    const authCookie = cookies().get('refresh_token');
    const bearerToken = request.headers.get('authorization')?.split(' ')[1];
    const token = bearerToken || authCookie?.value;
    
    if (!token) {
      return NextResponse.json({ 
        authenticated: false,
        message: 'No token provided' 
      });
    }
    
    try {
      // Примитивная проверка токена - в реальном приложении здесь должна быть полная верификация
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3 || !tokenParts[1]) {
        throw new Error('Invalid token format');
      }
      
      const decoded = JSON.parse(
        Buffer.from(tokenParts[1], 'base64').toString()
      );
      
      // Проверяем срок действия токена
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        return NextResponse.json({ 
          authenticated: false, 
          expired: true,
          message: 'Token expired' 
        });
      }
      
      // Проверяем существование пользователя
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });
      
      if (!user) {
        return NextResponse.json({ 
          authenticated: false,
          message: 'User not found' 
        });
      }
      
      return NextResponse.json({
        authenticated: true,
        user: {
          id: user.id,
          fid: Number(user.farcaster_fid),
          username: user.farcaster_username,
          displayName: user.farcaster_displayname,
          avatar: user.farcaster_pfp,
        }
      });
    } catch (error) {
      return NextResponse.json({ 
        authenticated: false,
        message: 'Invalid token' 
      });
    }
  } catch (error) {
    logAuth(
      AuthStep.AUTH_ERROR, 
      AuthLogType.ERROR, 
      'Ошибка при проверке сессии', 
      {},
      error
    );
    
    return NextResponse.json({
      authenticated: false,
      error: 'INTERNAL_ERROR',
      message: 'Внутренняя ошибка сервера'
    }, { status: 500 });
  }
} 