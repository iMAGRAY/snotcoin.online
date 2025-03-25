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
    
    // Находим пользователя по ID
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }
    
    // Получаем прогресс для пользователя
    const progress = await prisma.progress.findUnique({
      where: { user_id: user.id }
    });
    
    if (!progress) {
      // Если прогресса нет, возвращаем пустой прогресс
      return NextResponse.json({
        success: true,
        progress: {
          userId: user.id,
          level: 1,
          experience: 0,
          inventory: {
            snot: 0,
            snotCoins: 0,
            items: []
          },
          lastUpdated: new Date()
        }
      });
    }
    
    // Парсим game_state из JSON
    const gameState = progress.game_state as Record<string, any>;
    
    // Если прогресс найден, возвращаем его
    return NextResponse.json({
      success: true,
      progress: {
        userId: progress.user_id,
        level: gameState?.level || 1,
        experience: gameState?.experience || 0,
        inventory: gameState?.inventory || {
          snot: 0,
          snotCoins: 0,
          items: []
        },
        lastUpdated: progress.updated_at
      }
    });
  } catch (error) {
    console.error('Error loading progress:', error);
    
    return NextResponse.json({
      error: 'Ошибка при загрузке прогресса',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 