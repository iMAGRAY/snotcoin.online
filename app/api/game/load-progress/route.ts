import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { verifyJWT } from '../../../utils/jwt'
import type { StructuredGameSave } from '../../../types/saveTypes'
import { createInitialGameState } from '../../../constants/gameConstants'
import { redisService } from '../../../services/redisService'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  console.log('[API/load-progress] Получен запрос на загрузку прогресса');

  // Проверяем токен через URL-параметр (для Beacon API)
  const tokenFromUrl = request.nextUrl.searchParams.get('token');
  
  // Получаем ID пользователя из параметров
  const userIdFromUrl = request.nextUrl.searchParams.get('userId');
  
  // Извлекаем токен из заголовка Authorization
  const authHeader = request.headers.get('Authorization');
  let token;
  
  // Приоритет имеет токен из заголовка, затем из URL-параметра
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
    console.log('[API/load-progress] Токен получен из заголовка');
  } else if (tokenFromUrl) {
    token = tokenFromUrl;
    console.log('[API/load-progress] Токен получен из URL-параметра');
  } else {
    console.error('[API/load-progress] Отсутствует токен авторизации (ни в заголовке, ни в URL)');
    return NextResponse.json({ error: 'Отсутствует токен авторизации' }, { status: 401 });
  }
  
  try {
    // Проверяем валидность токена
    const { valid, userId, error: tokenError } = await verifyJWT(token);
    
    if (!valid || !userId) {
      console.error('[API/load-progress] Невалидный токен авторизации:', tokenError);
      return NextResponse.json({
        error: 'Невалидный токен авторизации',
        details: tokenError
      }, { status: 401 });
    }
    
    console.log(`[API/load-progress] Токен верифицирован, userId: ${userId}`);
    
    // Убеждаемся, что запрашиваемый пользователь совпадает с пользователем из токена
    if (userIdFromUrl && userIdFromUrl !== userId) {
      console.error(`[API/load-progress] Несоответствие ID пользователя: ${userIdFromUrl} (запрос) != ${userId} (токен)`);
      return NextResponse.json({ 
        error: 'Нельзя загружать прогресс другого пользователя' 
      }, { status: 403 });
    }
    
    // Пытаемся загрузить данные из Redis (кэш)
    console.log(`[API/load-progress] Пытаемся загрузить данные из Redis для ${userId}`);
    const redisResult = await redisService.loadGameState(userId);
    
    // Если данные найдены в Redis, возвращаем их
    if (redisResult.success && redisResult.data) {
      console.log(`[API/load-progress] Данные успешно загружены из Redis, источник: ${redisResult.source}`);
      
      const gameState = redisResult.data;
      const metadata = {
        version: gameState._saveVersion || 1,
        userId: userId,
        isCompressed: false,
        savedAt: new Date(gameState._lastModified || Date.now()).toISOString(),
        loadedAt: new Date().toISOString(),
        source: redisResult.source
      };
      
      return NextResponse.json({
        success: true,
        data: {
          gameState: {
            ...JSON.parse(JSON.stringify(gameState)),
            _metadata: metadata,
            _hasFullData: true
          },
          metadata,
          fromCache: true
        }
      });
    }
    
    // Если данных в Redis нет, продолжаем загрузку из базы данных
    console.log(`[API/load-progress] Данные не найдены в Redis, загружаем из базы данных`);
    
    // Находим пользователя по ID
    let user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    // Если пользователь не найден, создаем его автоматически
    if (!user) {
      console.log(`[API/load-progress] Пользователь не найден, создаем пользователя на лету: ${userId}`);
      
      try {
        // Выполняем дополнительную проверку перед созданием (защита от race condition)
        const checkUserAgain = await prisma.user.findUnique({
          where: { id: userId }
        });
        
        if (checkUserAgain) {
          console.log(`[API/load-progress] Найден пользователь при дополнительной проверке: ${checkUserAgain.id}`);
          user = checkUserAgain;
        } else {
          // Извлекаем числовую часть ID для использования в username
          const userIdParts = userId.split('_');
          const numericPart = userIdParts.length > 1 ? userIdParts[1] : '0';
          
          try {
            // Создаем пользователя на лету
            user = await prisma.user.create({
              data: {
                id: userId,
                farcaster_fid: userId,
                farcaster_username: `user_${numericPart}`,
                farcaster_displayname: '',
                jwt_token: token
              }
            });
            
            console.log(`[API/load-progress] Создан новый пользователь: ${user.id}`);
          } catch (createUserError) {
            console.error(`[API/load-progress] Ошибка при создании пользователя:`, createUserError);
            
            // Проверяем, не создан ли пользователь параллельно (race condition)
            if ((createUserError as any).code === 'P2002') {
              const finalCheckUser = await prisma.user.findUnique({
                where: { id: userId }
              });
              
              if (finalCheckUser) {
                console.log(`[API/load-progress] Пользователь найден после ошибки создания: ${finalCheckUser.id}`);
                user = finalCheckUser;
              } else {
                throw createUserError;
              }
            } else {
              throw createUserError;
            }
          }
        }
      } catch (error) {
        console.error(`[API/load-progress] Критическая ошибка при создании пользователя:`, error);
        return NextResponse.json({ 
          error: 'Не удалось создать пользователя', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
      }
    }
    
    // Запрос на получение прогресса по ID пользователя
    let progress;
    try {
      progress = await prisma.progress.findUnique({
        where: { user_id: userId }
      });
      
      console.log(`[API/load-progress] ${progress ? 'Найден' : 'Не найден'} прогресс для пользователя: ${userId}`);
    } catch (dbError) {
      console.error('[API/load-progress] Ошибка при запросе прогресса из БД:', dbError);
      
      return NextResponse.json({
        success: false,
        message: 'Ошибка доступа к базе данных',
        error: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 });
    }
    
    // Если прогресс найден, возвращаем его и кэшируем в Redis
    if (progress) {
      // Проверяем, является ли это сжатым состоянием
      const isCompressed = progress.is_compressed || 
        (progress.game_state && (progress.game_state as any)._isCompressed);
      
      // Добавляем метаданные, которые помогут клиенту правильно обработать данные
      const metadata = {
        version: progress.version,
        userId: userId,
        isCompressed: isCompressed,
        savedAt: progress.updated_at,
        loadedAt: new Date().toISOString()
      };
      
      // Сохраняем данные в Redis для ускорения последующих загрузок
      if (progress.game_state) {
        console.log(`[API/load-progress] Кэшируем данные в Redis для пользователя: ${userId}`);
        
        try {
          // Сохраняем в кэш с критическим маркером, если данные сжаты
          await redisService.saveGameState(userId, progress.game_state as any, isCompressed);
        } catch (cacheError) {
          console.warn(`[API/load-progress] Ошибка кэширования данных:`, cacheError);
          // Продолжаем выполнение даже при ошибке кэширования
        }
      }
      
      // Если данные сжаты, возвращаем только критические части для быстрой загрузки
      if (isCompressed && (progress.game_state as any).critical) {
        console.log(`[API/load-progress] Возвращаем сжатые данные для пользователя: ${userId}`);
        
        const compressedData = progress.game_state as any;
        
        // Быстрая загрузка критических данных
        return NextResponse.json({
          success: true,
          data: {
            gameState: {
              critical: compressedData.critical,
              integrity: compressedData.integrity,
              _isCompressed: true,
              _metadata: metadata,
              _hasFullData: false // Флаг для клиента, что нужно загрузить полные данные позже
            },
            metadata
          }
        });
      }
      
      console.log(`[API/load-progress] Возвращаем полные данные для пользователя: ${userId}`);
      const gameStateData = progress.game_state ? {
        ...JSON.parse(JSON.stringify(progress.game_state)),
        _metadata: metadata,
        _hasFullData: true
      } : {};
      
      return NextResponse.json({
        success: true,
        data: {
          gameState: gameStateData,
          metadata
        }
      });
    } else {
      console.log(`[API/load-progress] Прогресс не найден для пользователя: ${userId}, будет создано новое состояние игры`);
      
      // Создаем начальное состояние игры для нового пользователя
      const initialState = createInitialGameState(userId);
      
      // Кэшируем начальное состояние в Redis
      try {
        await redisService.saveGameState(userId, initialState, true);
      } catch (cacheError) {
        console.warn(`[API/load-progress] Ошибка кэширования начального состояния:`, cacheError);
        // Продолжаем выполнение даже при ошибке кэширования
      }
      
      return NextResponse.json({
        success: true,
        data: {
          gameState: initialState,
          metadata: {
            version: 1,
            userId: userId,
            isCompressed: false,
            savedAt: new Date().toISOString(),
            loadedAt: new Date().toISOString(),
            isNewUser: true
          }
        }
      });
    }
  } catch (error) {
    console.error('[API/load-progress] Ошибка при загрузке прогресса:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Ошибка при загрузке прогресса',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 