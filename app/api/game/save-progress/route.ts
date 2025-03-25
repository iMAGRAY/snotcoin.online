import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { verifyJWT } from '../../../utils/jwt'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  // Извлекаем токен из заголовка Authorization
  const authHeader = request.headers.get('Authorization');
  
  // Проверяем наличие токена
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Отсутствует токен авторизации' }, { status: 401 });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Получаем данные из тела запроса
    const body = await request.json();
    
    // Проверяем валидность данных
    if (!body || !body.progress) {
      return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 });
    }
    
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
    
    // Обновляем или создаем запись прогресса
    const progressData = body.progress;
    
    const upsertedProgress = await prisma.progress.upsert({
      where: { user_id: user.id },
      create: {
        user_id: user.id,
        game_state: {
          level: progressData.level || 1,
          experience: progressData.experience || 0,
          inventory: progressData.inventory || { snot: 0, snotCoins: 0, items: [] }
        }
      },
      update: {
        game_state: {
          level: progressData.level,
          experience: progressData.experience,
          inventory: progressData.inventory
        }
      }
    });
    
    // Парсим game_state из JSON
    const gameState = upsertedProgress.game_state as Record<string, any>;
    
    return NextResponse.json({
      success: true,
      progress: {
        userId: upsertedProgress.user_id,
        level: gameState?.level || 1,
        experience: gameState?.experience || 0,
        inventory: gameState?.inventory || {
          snot: 0,
          snotCoins: 0,
          items: []
        },
        lastUpdated: upsertedProgress.updated_at
      }
    });
  } catch (error) {
    console.error('Error saving progress:', error);
    
    return NextResponse.json({
      error: 'Ошибка при сохранении прогресса',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 