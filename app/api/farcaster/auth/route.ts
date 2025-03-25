import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Секрет для подписи JWT, должен быть в переменных окружения
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const BASE_URL = process.env.NEXT_PUBLIC_DOMAIN || 'https://snotcoin.online';

/**
 * Обработчик запросов на авторизацию через Farcaster
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, username, displayName, pfp } = body;
    
    if (!fid) {
      return NextResponse.json({
        success: false,
        message: 'Отсутствует обязательный параметр fid'
      }, { status: 400 });
    }
    
    // Ищем пользователя по Farcaster ID или создаем нового
    let user = await prisma.user.findUnique({
      where: {
        farcaster_fid: Number(fid)
      }
    });
    
    if (!user) {
      // Создаем нового пользователя
      user = await prisma.user.create({
        data: {
          farcaster_fid: Number(fid),
          farcaster_username: username,
          farcaster_displayname: displayName,
          farcaster_pfp: pfp,
          auth_type: 'farcaster'
        }
      });
    } else {
      // Обновляем существующего пользователя
      user = await prisma.user.update({
        where: {
          id: user.id
        },
        data: {
          farcaster_username: username,
          farcaster_displayname: displayName,
          farcaster_pfp: pfp,
          auth_type: 'farcaster'
        }
      });
    }
    
    // Создаем JWT токен
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Устанавливаем куки
    cookies().set({
      name: 'session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60, // 30 дней
      path: '/'
    });
    
    // Возвращаем успешный ответ
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fid: user.farcaster_fid,
        username: user.farcaster_username,
        displayName: user.farcaster_displayname,
        pfp: user.farcaster_pfp
      }
    });
  } catch (error) {
    console.error('Authentication error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Ошибка аутентификации',
      error: String(error)
    }, { status: 500 });
  }
}

/**
 * Обработчик для проверки текущей сессии
 */
export async function GET(request: NextRequest) {
  try {
    // Получаем куки сессии
    const sessionCookie = cookies().get('session');
    
    if (!sessionCookie) {
      return NextResponse.json({
        authenticated: false,
        message: 'Не найден токен сессии'
      });
    }
    
    // Верифицируем JWT токен
    const decodedToken = jwt.verify(sessionCookie.value, JWT_SECRET) as {
      userId: string;
    };
    
    if (!decodedToken || !decodedToken.userId) {
      return NextResponse.json({
        authenticated: false,
        message: 'Неверный токен сессии'
      });
    }
    
    // Находим пользователя по ID
    const user = await prisma.user.findUnique({
      where: {
        id: decodedToken.userId
      },
      select: {
        id: true,
        farcaster_fid: true,
        farcaster_username: true,
        farcaster_displayname: true,
        farcaster_pfp: true,
        auth_type: true
      }
    });
    
    if (!user) {
      return NextResponse.json({
        authenticated: false,
        message: 'Пользователь не найден'
      });
    }
    
    // Проверяем, что пользователь авторизован через Farcaster
    if (user.auth_type !== 'farcaster') {
      return NextResponse.json({
        authenticated: false,
        message: 'Пользователь авторизован не через Farcaster'
      });
    }
    
    // Возвращаем информацию о пользователе
    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        fid: user.farcaster_fid,
        username: user.farcaster_username,
        displayName: user.farcaster_displayname,
        pfp: user.farcaster_pfp
      }
    });
  } catch (error) {
    console.error('Authentication error:', error);
    
    return NextResponse.json({
      authenticated: false,
      message: 'Ошибка аутентификации',
      error: String(error)
    }, { status: 500 });
  }
} 