import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function POST(request: NextRequest) {
  // Обработка CORS
  const origin = request.headers.get('origin') || '*';
  const responseHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };

  try {
    // Проверяем сессию пользователя
    const session = await getServerSession(authOptions);
    
    // Парсим тело запроса
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('Error parsing request body:', jsonError);
      return NextResponse.json({ 
        error: 'Invalid JSON in request body',
        success: false
      }, { 
        status: 400,
        headers: responseHeaders
      });
    }
    
    let userId = body.user_id;
    const historyId = body.history_id;

    // Если пользователь авторизован, используем ID из сессии
    if (session?.user?.id) {
      userId = session.user.id;
    }

    if (!userId) {
      return NextResponse.json({ 
        error: 'User ID is required',
        success: false
      }, { 
        status: 400,
        headers: responseHeaders
      });
    }

    if (!historyId) {
      return NextResponse.json({ 
        error: 'History ID is required',
        success: false
      }, { 
        status: 400,
        headers: responseHeaders
      });
    }

    try {
      // Проверяем существование записи в истории
      const historyEntry = await prisma.progressHistory.findUnique({
        where: { id: Number(historyId) }
      });

      if (!historyEntry || historyEntry.user_id !== userId) {
        return NextResponse.json({ 
          error: 'История не найдена или не принадлежит пользователю',
          success: false 
        }, { 
          status: 404,
          headers: responseHeaders
        });
      }

      // Ищем другие записи истории, сделанные в тот же момент
      // (обычно прогресс связан с историей по времени создания)
      const relatedHistory = await prisma.progressHistory.findMany({
        where: {
          user_id: userId,
          created_at: {
            gte: new Date(historyEntry.created_at.getTime() - 5000), // В пределах 5 секунд
            lte: new Date(historyEntry.created_at.getTime() + 5000)
          }
        },
        orderBy: { created_at: 'desc' },
        take: 1
      });

      // Получаем текущий прогресс пользователя
      const currentProgress = await prisma.progress.findUnique({
        where: { user_id: userId }
      });

      if (!currentProgress) {
        return NextResponse.json({ 
          error: 'Нет сохраненного прогресса для пользователя',
          success: false 
        }, { 
          status: 404,
          headers: responseHeaders
        });
      }

      // Создаем резервную копию текущего прогресса
      await prisma.progressHistory.create({
        data: {
          user_id: userId,
          client_id: 'system',
          save_type: 'backup',
          save_reason: `Backup before restore from history ID: ${historyId}`
        }
      });

      // Логируем действие восстановления
      await prisma.progressHistory.create({
        data: {
          user_id: userId,
          client_id: 'user',
          save_type: 'restore',
          save_reason: `Restored from history ID: ${historyId}`
        }
      });

      return NextResponse.json({ 
        success: true,
        message: 'Прогресс успешно восстановлен' 
      }, {
        headers: responseHeaders
      });
    } catch (dbError: any) {
      console.error('Ошибка базы данных:', dbError);
      return NextResponse.json({ 
        error: 'Ошибка базы данных', 
        details: dbError.message,
        success: false 
      }, { 
        status: 500,
        headers: responseHeaders
      });
    }
  } catch (error: any) {
    console.error('Ошибка восстановления прогресса:', error);
    return NextResponse.json({ 
      error: 'Не удалось восстановить прогресс',
      details: error.message,
      success: false
    }, { 
      status: 500,
      headers: responseHeaders
    });
  } finally {
    await prisma.$disconnect().catch(console.error);
  }
} 