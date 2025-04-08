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
    // Получаем сессию пользователя
    const session = await getServerSession(authOptions);
    
    // Пытаемся распарсить тело запроса
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
    
    const { user_id, game_state, version = 1, is_compressed = false } = body;

    // Проверяем наличие game_state
    if (!game_state) {
      return NextResponse.json({ 
        error: 'Game state is required',
        success: false
      }, { 
        status: 400,
        headers: responseHeaders
      });
    }

    // Проверка авторизации, если пользователь авторизован через NextAuth
    if (session?.user?.id) {
      // Используем ID из сессии вместо переданного
      const userId = session.user.id;

      // Проверяем существует ли пользователь
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return NextResponse.json({ 
          error: 'User not found',
          success: false
        }, { 
          status: 404,
          headers: responseHeaders
        });
      }

      // Обновляем или создаем запись прогресса для авторизованного пользователя
      const updatedProgress = await prisma.progress.upsert({
        where: { user_id: userId },
        update: {
          game_state,
          version,
          is_compressed,
          updated_at: new Date()
        },
        create: {
          user_id: userId,
          game_state,
          version,
          is_compressed
        }
      });

      // Сохраняем запись в историю
      await prisma.progressHistory.create({
        data: {
          user_id: userId,
          client_id: 'web',
          save_type: 'api',
          save_reason: 'manual_save'
        }
      });

      return NextResponse.json({ 
        success: true, 
        progress: updatedProgress 
      }, {
        headers: responseHeaders
      });
    } 
    // Если пользователь не авторизован, но передан user_id
    else if (user_id) {
      try {
        // Создаем или получаем пользователя
        const user = await prisma.user.upsert({
          where: { id: user_id },
          update: {},
          create: {
            id: user_id,
            farcaster_fid: `temp_${user_id.substring(0, 8)}`,
            farcaster_username: `temp_user_${user_id.substring(0, 8)}`
          }
        });

        // Обновляем или создаем запись прогресса
        const updatedProgress = await prisma.progress.upsert({
          where: { user_id: user_id },
          update: {
            game_state,
            version,
            is_compressed,
            updated_at: new Date()
          },
          create: {
            user_id: user_id,
            game_state,
            version,
            is_compressed
          }
        });

        // Сохраняем запись в историю
        await prisma.progressHistory.create({
          data: {
            user_id: user_id,
            client_id: 'web',
            save_type: 'api',
            save_reason: 'manual_save'
          }
        });

        return NextResponse.json({ 
          success: true, 
          progress: updatedProgress 
        }, {
          headers: responseHeaders
        });
      } catch (error) {
        console.error('Error handling unauthenticated user:', error);
        return NextResponse.json({ 
          error: 'Failed to handle unauthenticated user',
          details: error instanceof Error ? error.message : 'Unknown error',
          success: false
        }, { 
          status: 500,
          headers: responseHeaders
        });
      }
    } else {
      return NextResponse.json({ 
        error: 'User ID is required',
        success: false
      }, { 
        status: 400,
        headers: responseHeaders
      });
    }
  } catch (error) {
    console.error('Error saving progress:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { 
      status: 500,
      headers: responseHeaders
    });
  } finally {
    await prisma.$disconnect().catch(console.error);
  }
} 