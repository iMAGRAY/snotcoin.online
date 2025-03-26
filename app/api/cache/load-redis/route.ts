/**
 * API для загрузки данных из Redis с клиентской стороны
 */
import { NextRequest, NextResponse } from 'next/server';
import { redisService } from '../../../services/redisService';
import { verifyJWT } from '../../../utils/auth';
import { ErrorCodes } from '../../../types/apiTypes';

/**
 * Обработчик для получения данных из Redis с клиентской стороны
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
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
    if (!authResult.success) {
      console.warn('[API] Недействительный токен:', authResult.error);
      return NextResponse.json(
        { error: 'Токен недействителен', errorCode: ErrorCodes.INVALID_TOKEN },
        { status: 401 }
      );
    }

    // Получаем userId из запроса
    const userId = req.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Отсутствует ID пользователя', errorCode: ErrorCodes.VALIDATION_ERROR },
        { status: 400 }
      );
    }

    // Проверяем, совпадает ли id пользователя в токене с переданным id
    if (authResult.userId !== userId) {
      console.warn(`[API] Несоответствие ID пользователя: ${authResult.userId} vs ${userId}`);
      return NextResponse.json(
        { error: 'Доступ запрещен', errorCode: ErrorCodes.FORBIDDEN },
        { status: 403 }
      );
    }

    console.log(`[API] Загрузка из Redis для пользователя ${userId}`);

    // Загружаем данные из Redis
    const redisResult = await redisService.loadGameState(userId);

    if (redisResult.success && redisResult.data) {
      return NextResponse.json({
        success: true,
        source: redisResult.source,
        data: redisResult.data,
        metrics: redisResult.metrics
      });
    } else {
      console.warn(`[API] Данные не найдены в Redis для пользователя ${userId}: ${redisResult.error}`);
      return NextResponse.json(
        { 
          success: false,
          error: 'Данные не найдены в Redis', 
          errorCode: ErrorCodes.NOT_FOUND,
          message: redisResult.error 
        },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('[API] Ошибка в обработчике load-redis:', error);
    return NextResponse.json(
      { 
        error: 'Внутренняя ошибка сервера', 
        errorCode: ErrorCodes.INTERNAL_SERVER_ERROR 
      },
      { status: 500 }
    );
  }
} 