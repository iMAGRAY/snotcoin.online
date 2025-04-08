/**
 * API для получения и управления статусом системы
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServicesStatus, ENV } from '../../../lib/env';
import prisma from '../../../lib/prisma';

// Запрос на получение статуса системы
export async function GET(request: NextRequest) {
  try {
    // Проверка админ-ключа
    const authHeader = request.headers.get('authorization');
    const adminKey = authHeader?.split('Bearer ')[1];
    
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' }, 
        { status: 401 }
      );
    }
    
    // Статус сервисов из конфигурации
    const servicesStatus = getServicesStatus();
    
    // Проверяем состояние базы данных
    let dbStatus = {
      connected: false,
      error: null as string | null
    };
    
    try {
      // Проверяем соединение с базой данных
      const result = await prisma.$queryRaw`SELECT 1 as is_alive`;
      dbStatus.connected = Array.isArray(result) && result.length > 0;
    } catch (error) {
      dbStatus.error = error instanceof Error ? error.message : String(error);
    }
    
    return NextResponse.json({
      success: true,
      status: 'ok',
      services: servicesStatus,
      database: dbStatus,
      environment: ENV.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[API] Ошибка при получении статуса системы:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
}

// Запрос на управление сервисами
export async function POST(request: NextRequest) {
  try {
    // Проверка админ-ключа
    const authHeader = request.headers.get('authorization');
    const adminKey = authHeader?.split('Bearer ')[1];
    
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' }, 
        { status: 401 }
      );
    }
    
    // Получаем команду из тела запроса
    const body = await request.json();
    const { command, service } = body;
    
    if (!command || !service) {
      return NextResponse.json(
        { success: false, error: 'Missing command or service' }, 
        { status: 400 }
      );
    }
    
    // Поддержка других сервисов можно добавить по необходимости
    return NextResponse.json(
      { success: false, error: `Unknown service: ${service}` }, 
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Ошибка при управлении сервисами:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
} 