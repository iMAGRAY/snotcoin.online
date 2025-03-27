/**
 * API для получения и управления статусом системы
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServicesStatus, enableRedis, disableRedis, ENV } from '../../../lib/env';
import { redisService } from '../../../services/redis';
import { prisma } from '../../../lib/prisma';

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
    
    // Проверяем состояние Redis
    let redisStatus = {
      enabled: ENV.REDIS_ENABLED,
      connected: false,
      status: null as any
    };
    
    try {
      redisStatus.status = redisService.getStatus();
      const isAvailable = await redisService.isAvailable();
      redisStatus.connected = isAvailable;
    } catch (error) {
      redisStatus.status = error instanceof Error ? error.message : String(error);
    }
    
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
      redis: redisStatus,
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
    
    // Выполняем команду в зависимости от сервиса
    switch (service) {
      case 'redis':
        if (command === 'enable') {
          enableRedis();
          return NextResponse.json({
            success: true,
            message: 'Redis enabled',
            status: { redis: ENV.REDIS_ENABLED }
          });
        } else if (command === 'disable') {
          disableRedis();
          return NextResponse.json({
            success: true,
            message: 'Redis disabled',
            status: { redis: ENV.REDIS_ENABLED }
          });
        } else if (command === 'reset') {
          redisService.resetConnectionState();
          return NextResponse.json({
            success: true,
            message: 'Redis connection state reset',
            status: redisService.getStatus()
          });
        }
        break;
        
      // Можно добавить другие сервисы по необходимости
        
      default:
        return NextResponse.json(
          { success: false, error: `Unknown service: ${service}` }, 
          { status: 400 }
        );
    }
    
    return NextResponse.json(
      { success: false, error: `Unknown command: ${command}` }, 
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