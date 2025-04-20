import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

interface ProgressHistoryEntry {
  id: number;
  user_id: string;
  client_id: string;
  save_type: string;
  save_reason: string;
  created_at: Date;
}

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
    const limit = request.nextUrl.searchParams.get('limit') || '10';

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
      const history = await prisma.progressHistory.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: parseInt(limit, 10)
      });

      return NextResponse.json({
        history: history.map((entry: ProgressHistoryEntry) => ({
          id: entry.id,
          user_id: entry.user_id,
          client_id: entry.client_id,
          save_type: entry.save_type,
          save_reason: entry.save_reason,
          created_at: entry.created_at
        })),
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
    console.error('Error loading progress history:', error);
    return NextResponse.json({ 
      error: 'Failed to load progress history',
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