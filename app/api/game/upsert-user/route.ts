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
    if (!body || !body.user) {
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
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }
    
    // Обновляем информацию о пользователе
    const userData = body.user;
    
    // Обновляем только разрешенные поля
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        username: userData.username || existingUser.username,
        displayName: userData.displayName || existingUser.displayName,
        pfpUrl: userData.pfp || existingUser.pfpUrl,
        fid: userData.fid || existingUser.fid
      }
    });
    
    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        fid: updatedUser.fid,
        username: updatedUser.username,
        displayName: updatedUser.displayName,
        pfp: updatedUser.pfpUrl
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    
    return NextResponse.json({
      error: 'Ошибка при обновлении пользователя',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 