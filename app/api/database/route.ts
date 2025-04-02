/**
 * API для работы с базой данных
 * Обрабатывает запросы к /database
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Обработчик GET запросов к /database
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      status: 'ok',
      message: 'Database service is available',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[API] Ошибка при обработке запроса к /database:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
}

/**
 * Обработчик POST запросов к /database
 */
export async function POST(request: NextRequest) {
  try {
    // Получение данных из запроса
    const body = await request.json();
    
    // Здесь можно добавить обработку данных

    return NextResponse.json({
      success: true,
      status: 'ok',
      message: 'Data received successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[API] Ошибка при обработке POST запроса к /database:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
} 