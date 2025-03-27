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
    if (!body || !body.delta) {
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
    
    // Проверяем, что сохраняется дельта для текущего пользователя
    if (body.userId !== userId) {
      return NextResponse.json({
        error: 'Запрещено сохранять дельту для другого пользователя'
      }, { status: 403 });
    }
    
    // Находим пользователя по ID
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }
    
    // Получаем текущую запись прогресса
    const existingProgress = await prisma.progress.findUnique({
      where: { user_id: user.id }
    });
    
    // Проверяем соответствие версий
    if (!existingProgress) {
      return NextResponse.json({
        error: 'Невозможно применить дельту, т.к. отсутствует базовое состояние'
      }, { status: 400 });
    }
    
    // Проверяем соответствие версий
    const currentVersion = existingProgress.version;
    const baseVersion = body.baseVersion;
    
    if (currentVersion !== baseVersion) {
      return NextResponse.json({
        error: 'Конфликт версий',
        details: `Текущая версия: ${currentVersion}, базовая версия дельты: ${baseVersion}`
      }, { status: 409 });
    }
    
    // Сохраняем дельту в отдельную таблицу (если она у вас есть)
    // Примечание: для этого потребуется создать соответствующую таблицу в схеме данных
    
    // В данном случае, мы просто обновляем версию состояния
    const newVersion = body.newVersion || (currentVersion + 1);
    
    // Обновляем прогресс (увеличиваем версию)
    const updatedProgress = await prisma.progress.update({
      where: { user_id: user.id },
      data: {
        game_state: body.delta,
        version: newVersion,
        updated_at: new Date(),
        is_compressed: body.compressedState !== null
      },
      select: {
        version: true,
        updated_at: true
      }
    });
    
    // Возвращаем успешный результат
    return NextResponse.json({
      success: true,
      message: "Дельта успешно сохранена",
      progress: {
        userId: user.id,
        version: updatedProgress.version,
        lastUpdated: updatedProgress.updated_at
      }
    });
  } catch (error) {
    console.error('Error saving delta:', error);
    
    return NextResponse.json({
      error: 'Ошибка при сохранении дельты',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 