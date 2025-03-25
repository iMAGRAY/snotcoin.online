import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import { generateJWT, generateRefreshToken } from '@/app/utils/jwt';
import {
  validateFarcasterUser,
  createSignInWithFarcasterRequest,
  checkFarcasterAuthStatus
} from '@/app/utils/neynarApi';

const prisma = new PrismaClient();

/**
 * Обработчик для запроса на аутентификацию через Neynar
 * Создает новый запрос на вход, возвращая URL для QR-кода и токен
 */
export async function POST(request: NextRequest) {
  try {
    // Создаем запрос на вход через Farcaster
    const authRequest = await createSignInWithFarcasterRequest();
    
    if (!authRequest) {
      return NextResponse.json({
        success: false,
        message: 'Не удалось создать запрос на аутентификацию'
      }, { status: 500 });
    }
    
    // Устанавливаем временный токен в куки для последующей проверки
    cookies().set({
      name: 'farcaster_auth_token',
      value: authRequest.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60, // 10 минут
      path: '/'
    });
    
    // Возвращаем данные для отображения QR-кода и ссылки
    return NextResponse.json({
      success: true,
      authRequest: {
        token: authRequest.token,
        url: authRequest.url,
        qrCode: authRequest.qrCode,
        expiresAt: authRequest.expiresAt
      }
    });
  } catch (error) {
    console.error('Neynar auth request error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Ошибка при создании запроса на аутентификацию',
      error: String(error)
    }, { status: 500 });
  }
}

/**
 * Обработчик для проверки статуса аутентификации через Neynar
 * Проверяет статус аутентификации и создает JWT токены если пользователь подтвержден
 */
export async function GET(request: NextRequest) {
  try {
    // Получаем временный токен из куки или из параметра запроса
    const token = cookies().get('farcaster_auth_token')?.value 
      || request.nextUrl.searchParams.get('token');
    
    if (!token) {
      return NextResponse.json({
        success: false,
        message: 'Токен аутентификации не найден'
      }, { status: 400 });
    }
    
    // Проверяем статус аутентификации
    const authStatus = await checkFarcasterAuthStatus(token);
    
    if (!authStatus) {
      return NextResponse.json({
        success: false,
        message: 'Не удалось проверить статус аутентификации'
      }, { status: 500 });
    }
    
    // Если статус не "approved", возвращаем текущий статус
    if (authStatus.status !== 'approved') {
      return NextResponse.json({
        success: false,
        status: authStatus.status,
        message: authStatus.status === 'pending' 
          ? 'Ожидание подтверждения' 
          : 'Срок действия запроса истек'
      });
    }
    
    // Получаем данные пользователя из Neynar
    const { fid, username, displayName, pfp } = authStatus;
    
    if (!fid) {
      return NextResponse.json({
        success: false,
        message: 'Данные пользователя недоступны'
      }, { status: 500 });
    }
    
    // Проверяем валидность пользователя через Neynar API
    const userValidation = await validateFarcasterUser(fid);
    
    if (!userValidation) {
      return NextResponse.json({
        success: false,
        message: 'Не удалось подтвердить пользователя через Neynar API'
      }, { status: 401 });
    }
    
    // Ищем пользователя в базе данных или создаем нового
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
          farcaster_username: username || `user${fid}`,
          farcaster_displayname: displayName || '',
          farcaster_pfp: pfp || ''
        }
      });
    } else {
      // Обновляем существующего пользователя
      user = await prisma.user.update({
        where: {
          id: user.id
        },
        data: {
          farcaster_username: username || user.farcaster_username,
          farcaster_displayname: displayName || user.farcaster_displayname,
          farcaster_pfp: pfp || user.farcaster_pfp
        }
      });
    }
    
    // Создаем JWT токен
    const { token: accessToken, expiresAt } = await generateJWT(user.id);
    
    // Создаем refresh токен
    const { token: refreshToken } = await generateRefreshToken(user.id);
    
    // Устанавливаем основной токен в куки
    cookies().set({
      name: 'session',
      value: accessToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60, // 30 дней
      path: '/'
    });
    
    // Устанавливаем refresh токен в куки
    cookies().set({
      name: 'refresh_token',
      value: refreshToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 90 * 24 * 60 * 60, // 90 дней
      path: '/'
    });
    
    // Удаляем временный токен аутентификации
    cookies().delete('farcaster_auth_token');
    
    // Возвращаем успешный ответ с данными пользователя
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fid: user.farcaster_fid,
        username: user.farcaster_username,
        displayName: user.farcaster_displayname,
        pfp: user.farcaster_pfp
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresAt
      }
    });
  } catch (error) {
    console.error('Neynar auth check error:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Ошибка при проверке аутентификации',
      error: String(error)
    }, { status: 500 });
  }
} 