import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { ExtendedGameState } from '../../../types/gameTypes'
import { verifyJWT } from '../../../utils/jwt'
import { redisService } from '../../../services/redisService'
import { createDelta, isDeltaEfficient } from '../../../utils/deltaCompression'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  console.log('[API/save-progress] Получен запрос на сохранение прогресса');
  
  try {
    // Извлекаем токен из заголовка Authorization или URL параметров
    const authHeader = request.headers.get('Authorization');
    const tokenFromUrl = request.nextUrl.searchParams.get('token');
    
    // Приоритет имеет токен из заголовка, затем из URL параметров
    let token;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      console.log('[API/save-progress] Токен получен из заголовка');
    } else if (tokenFromUrl) {
      token = tokenFromUrl;
      console.log('[API/save-progress] Токен получен из URL параметров');
    } else {
      console.error('[API/save-progress] Отсутствует токен авторизации (ни в заголовке, ни в URL)');
      return NextResponse.json({ error: 'Отсутствует токен авторизации' }, { status: 401 });
    }
    
    // Проверяем валидность токена
    const { valid, userId, error: tokenError } = await verifyJWT(token);
    
    if (!valid || !userId) {
      console.error('[API/save-progress] Невалидный токен авторизации:', tokenError);
      return NextResponse.json({
        error: 'Невалидный токен авторизации',
        details: tokenError
      }, { status: 401 });
    }
    
    console.log(`[API/save-progress] Токен верифицирован, userId: ${userId}`);
    
    // Получаем данные из запроса
    const body = await request.json();
    
    // Проверяем наличие игровых данных
    if (!body.gameState) {
      console.error('[API/save-progress] В запросе отсутствуют игровые данные');
      return NextResponse.json({ 
        error: 'Отсутствуют игровые данные'
      }, { status: 400 });
    }
    
    // Проверяем, что игровые данные содержат правильный userId или устанавливаем его
    const gameState = body.gameState as ExtendedGameState;
    
    if (!gameState._userId) {
      gameState._userId = userId;
    } else if (gameState._userId !== userId) {
      console.error(`[API/save-progress] Несоответствие ID пользователя: ${gameState._userId} (в данных) != ${userId} (в токене)`);
      return NextResponse.json({ 
        error: 'Несоответствие ID пользователя'
      }, { status: 403 });
    }
    
    // Проверяем наличие критических изменений для определения приоритета
    const isCriticalSave = Boolean(gameState._isCriticalSave || body.isCriticalSave);
    const saveReason = gameState._saveReason || body.saveReason || 'manual';
    const hasMeaningfulChanges = gameState._hasMeaningfulChanges !== undefined 
      ? gameState._hasMeaningfulChanges 
      : body.hasMeaningfulChanges !== undefined
        ? body.hasMeaningfulChanges
        : true;
    
    console.log(`[API/save-progress] Тип сохранения: ${isCriticalSave ? 'критическое' : 'обычное'}, причина: ${saveReason}`);
    
    // Проверяем валидность данных игры
    if (!validateGameData(gameState)) {
      console.error('[API/save-progress] Невалидные игровые данные');
      return NextResponse.json({
        error: 'Невалидные игровые данные'
      }, { status: 400 });
    }
    
    // Находим пользователя
    let user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      console.error(`[API/save-progress] Пользователь не найден: ${userId}`);
      return NextResponse.json({ 
        error: 'Пользователь не найден'
      }, { status: 404 });
    }
    
    // Обновляем токен пользователя, если он изменился
    if (user.jwt_token !== token) {
      console.log(`[API/save-progress] Обновляем токен пользователя: ${userId}`);
      
      await prisma.user.update({
        where: { id: userId },
        data: { jwt_token: token }
      });
    }
    
    // Ищем существующий прогресс
    let existingProgress = await prisma.progress.findUnique({
      where: { user_id: userId }
    });

    try {
      // Сначала сохраняем данные в Redis для быстрого доступа
      const redisResult = await redisService.saveGameState(userId, gameState, isCriticalSave);
      
      if (!redisResult.success) {
        console.warn(`[API/save-progress] Не удалось сохранить в Redis: ${redisResult.error}`);
      } else {
        console.log(`[API/save-progress] Данные успешно сохранены в Redis, источник: ${redisResult.source}`);
      }
      
      // Если нет значимых изменений и это не критическое сохранение, пропускаем сохранение в БД
      if (!hasMeaningfulChanges && !isCriticalSave) {
        console.log(`[API/save-progress] Пропуск сохранения в БД (нет значимых изменений)`);
        
        return NextResponse.json({
          success: true,
          message: 'Данные сохранены только в кэше',
          progress: existingProgress,
          cachedOnly: true
        });
      }
      
      // Если прогресс существует, обновляем его
      if (existingProgress) {
        // Получаем текущую версию
        const currentVersion = existingProgress.version || 1;
        
        // Проверяем конфликт версий
        if (gameState._saveVersion && gameState._saveVersion < currentVersion) {
          console.warn(`[API/save-progress] Конфликт версий: ${gameState._saveVersion} (клиент) < ${currentVersion} (сервер)`);
          
          // Если это не критическое сохранение, отклоняем с ошибкой
          if (!isCriticalSave) {
            return NextResponse.json({
              success: false,
              message: 'Конфликт версий',
              versionConflict: true,
              serverVersion: currentVersion
            }, { status: 409 });
          }
          
          // Для критических сохранений продолжаем, несмотря на конфликт
          console.log(`[API/save-progress] Игнорируем конфликт версий для критического сохранения`);
        }
        
        // Определяем, нужно ли сжимать данные
        const shouldCompress = JSON.stringify(gameState).length > 50 * 1024; // > 50KB
        
        // Преобразовать gameState в JSON для Prisma
        const gameStateJson = JSON.stringify(gameState);
        
        // Обновляем прогресс
        existingProgress = await prisma.progress.update({
          where: { user_id: userId },
          data: {
            game_state: gameStateJson,
            version: currentVersion + 1,
            is_compressed: shouldCompress,
            updated_at: new Date()
          }
        });
        
        console.log(`[API/save-progress] Обновлен прогресс для пользователя: ${userId}, версия: ${existingProgress.version}`);
      } else {
        // Если прогресса нет, создаем новый
        const gameStateJson = JSON.stringify(gameState);
        
        // Определяем, нужно ли сжимать данные для нового прогресса
        const shouldCompress = gameStateJson.length > 50 * 1024; // > 50KB
        
        existingProgress = await prisma.progress.create({
          data: {
            user_id: userId,
            game_state: gameStateJson,
            version: 1,
            is_compressed: shouldCompress,
            created_at: new Date(),
            updated_at: new Date()
          }
        });
        
        console.log(`[API/save-progress] Создан новый прогресс для пользователя: ${userId}`);
      }
      
      return NextResponse.json({
        success: true,
        message: 'Прогресс сохранен успешно',
        progress: {
          id: existingProgress.id,
          version: existingProgress.version,
          user_id: existingProgress.user_id,
          updated_at: existingProgress.updated_at
        }
      });
    } catch (error) {
      console.error('[API/save-progress] Ошибка сохранения прогресса:', error);
      
      return NextResponse.json({
        success: false,
        message: 'Ошибка сохранения прогресса',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[API/save-progress] Необработанная ошибка:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Внутренняя ошибка сервера',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Проверяет целостность игровых данных перед сохранением
 */
function validateGameData(gameState: any): boolean {
  try {
    // Обработка сжатых данных
    if (gameState._isCompressed) {
      // Проверяем наличие обязательных полей для сжатых данных
      return (
        gameState.critical &&
        gameState.critical.inventory &&
        gameState.critical.container &&
        gameState.critical.upgrades &&
        gameState.integrity
      );
    }
    
    // Проверка структурированных данных
    if (gameState.critical) {
      return (
        gameState.critical.inventory &&
        gameState.critical.container &&
        gameState.critical.upgrades
      );
    }
    
    // Для обычных данных проверяем обязательные поля
    return (
      gameState.inventory &&
      typeof gameState.inventory.snot === 'number' &&
      typeof gameState.inventory.snotCoins === 'number' &&
      gameState.container &&
      gameState.upgrades
    );
  } catch (error) {
    console.error(`[API] Ошибка валидации данных:`, error);
    return false;
  }
} 