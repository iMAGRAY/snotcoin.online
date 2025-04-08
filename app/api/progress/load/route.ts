import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(request: NextRequest) {
  // Обработка CORS
  const origin = request.headers.get('origin') || '*';
  const responseHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };

  try {
    const userId = request.nextUrl.searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ 
        error: 'User ID is required',
        success: false
      }, { 
        status: 400,
        headers: responseHeaders
      });
    }

    try {
      const progress = await prisma.progress.findUnique({
        where: { user_id: userId },
        include: {
          user: true // Включаем данные пользователя
        }
      });

      if (!progress) {
        return NextResponse.json({ 
          error: 'Progress not found',
          user_id: userId,
          success: false
        }, { 
          status: 404,
          headers: responseHeaders
        });
      }

      return NextResponse.json({
        game_state: progress.game_state,
        version: progress.version,
        is_compressed: progress.is_compressed,
        updated_at: progress.updated_at,
        success: true
      }, {
        headers: responseHeaders
      });
    } catch (dbError: any) {
      console.error('Error in database operations:', dbError);
      return NextResponse.json({ 
        error: 'Database error', 
        details: dbError.message,
        success: false
      }, { 
        status: 500,
        headers: responseHeaders
      });
    }
  } catch (error: any) {
    console.error('Error loading progress:', error);
    return NextResponse.json({ 
      error: 'Failed to load progress',
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