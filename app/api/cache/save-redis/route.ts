/**
 * API для сохранения в Redis с клиентской стороны
 */
import { NextRequest, NextResponse } from 'next/server';
import { redisService } from '../../../services/redis';
import { verifyJWT } from '../../../utils/auth';
import { ErrorCodes } from '../../../types/apiTypes';

/**
 * Обработчик для сохранения данных в Redis с клиентской стороны
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Проверяем JWT для аутентификации в куки или URL параметрах
    let token: string | undefined;
    
    // Проверяем наличие токена в cookie
    const cookieToken = req.cookies.get('token')?.value;
    if (cookieToken) {
      token = cookieToken;
    } else {
      // Проверяем наличие токена в URL параметрах
      const urlToken = req.nextUrl.searchParams.get('token');
      if (urlToken) {
        token = urlToken;
      }
    }
    
    // Если токен не найден нигде
    if (!token) {
      console.warn('[API] Токен не найден в куки или параметрах запроса');
      return NextResponse.json(
        { error: 'Не аутентифицирован', errorCode: ErrorCodes.UNAUTHORIZED },
        { status: 401 }
      );
    }
    
    // Проверяем валидность токена
    const authResult = await verifyJWT(token);
    if (!authResult.valid) {
      console.warn('[API] Недействительный токен:', authResult.error);
      return NextResponse.json(
        { error: 'Токен недействителен', errorCode: ErrorCodes.INVALID_TOKEN },
        { status: 401 }
      );
    }

    // Получаем данные из запроса
    const { userId, data, isCritical } = await req.json();

    // Проверяем, совпадает ли id пользователя в токене с переданным id
    if (authResult.userId !== userId) {
      console.warn(`[API] Несоответствие ID пользователя: ${authResult.userId} vs ${userId}`);
      return NextResponse.json(
        { error: 'Доступ запрещен', errorCode: ErrorCodes.FORBIDDEN },
        { status: 403 }
      );
    }

    console.log(`[API] Сохранение в Redis для пользователя ${userId}`);

    // Сохраняем данные в Redis
    const redisResult = await redisService.saveGameState(userId, data, isCritical);

    if (redisResult.success) {
      return NextResponse.json({
        success: true,
        source: redisResult.source,
        metrics: redisResult.metrics
      });
    } else {
      console.error(`[API] Ошибка сохранения в Redis: ${redisResult.error}`);
      return NextResponse.json(
        { 
          error: 'Ошибка сохранения в Redis', 
          errorCode: ErrorCodes.REDIS_ERROR,
          message: redisResult.error 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[API] Ошибка в обработчике save-redis:', error);
    return NextResponse.json(
      { 
        error: 'Внутренняя ошибка сервера', 
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR 
      },
      { status: 500 }
    );
  }
} 