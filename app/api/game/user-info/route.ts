import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { verifyJWT } from '../../../utils/jwt'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient();

export async function GET(request: Request) {
  // Извлекаем токен из заголовка Authorization
  const authHeader = request.headers.get('Authorization');
  
  // Проверяем наличие токена
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Отсутствует токен авторизации' }, { status: 401 });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Проверяем валидность токена
    const { valid, userId, error: tokenError } = await verifyJWT(token);
    
    if (!valid || !userId) {
      return NextResponse.json({
        error: 'Невалидный токен авторизации',
        details: tokenError
      }, { status: 401 });
    }
    
    // Получаем URL параметры
    const url = new URL(request.url);
    
    // Получаем id пользователя из URL
    const requestedUserId = url.searchParams.get('userId');
    
    if (!requestedUserId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }
    
    // Проверяем, соответствует ли userId пользователю из токена
    if (userId !== requestedUserId) {
      return NextResponse.json(
        { error: 'Unauthorized access to user information' },
        { status: 403 }
      );
    }
    
    // Находим пользователя по ID
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        progress: true
      }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }
    
    // Создаем дефолтное состояние игры
    const defaultGameState = {
      level: 1,
      experience: 0,
      inventory: {
        snot: 0,
        snotCoins: 0,
        items: []
      }
    };
    
    // Получаем прогресс для пользователя
    let gameState = defaultGameState;
    
    if (user.progress && user.progress.game_state) {
      // Парсим JSON данные
      const stateData = user.progress.game_state as Record<string, any>;
      gameState = {
        level: stateData.level || defaultGameState.level,
        experience: stateData.experience || defaultGameState.experience,
        inventory: stateData.inventory || defaultGameState.inventory
      };
    }
    
    // Возвращаем информацию о пользователе и его прогрессе
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fid: user.farcaster_fid,
        username: user.farcaster_username,
        displayName: user.farcaster_displayname,
        pfp: user.farcaster_pfp,
        joinedAt: user.created_at
      },
      progress: {
        level: gameState.level,
        experience: gameState.experience,
        inventory: gameState.inventory,
        lastUpdated: user.progress?.updated_at || user.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    
    return NextResponse.json({
      error: 'Ошибка при получении информации о пользователе',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 