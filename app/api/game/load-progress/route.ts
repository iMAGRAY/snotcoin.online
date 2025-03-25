import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { verifyJWT } from '../../../utils/jwt'
import type { StructuredGameSave } from '../../../types/saveTypes'
import { initialState } from '../../../constants/gameConstants'

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
    
    // Получаем прогресс для пользователя
    let progress = await prisma.progress.findUnique({
      where: {
        user_id: userId,
      },
    });

    // Если прогресс не найден, создаем начальный прогресс для нового пользователя
    if (!progress) {
      console.log(`[API/load-progress] Прогресс не найден для пользователя: ${userId}, создаем начальный прогресс`);
      
      try {
        // Подготавливаем начальное состояние игры
        const currentTime = new Date();
        const initialGameState = {
          ...initialState,
          user: {
            id: userId,
          },
          _saveVersion: 1,
          _lastSaved: currentTime.toISOString()
        };
        
        // Используем транзакцию и более безопасный подход для создания записи прогресса
        progress = await prisma.$transaction(
          async (tx) => {
            // Проверяем существование записи внутри транзакции
            const existingProgress = await tx.progress.findUnique({
              where: { user_id: userId }
            });
            
            if (existingProgress) {
              // Запись уже существует, просто возвращаем её
              console.log(`[API/load-progress] Прогресс уже существует для пользователя ${userId}, найден внутри транзакции`);
              return existingProgress;
            }
            
            // Пытаемся создать новую запись
            try {
              const newProgress = await tx.progress.create({
                data: {
                  user_id: userId,
                  game_state: initialGameState as any,
                  version: 1,
                  created_at: currentTime,
                  updated_at: currentTime
                }
              });
              console.log(`[API/load-progress] Создан прогресс для пользователя: ${userId}`);
              return newProgress;
            } catch (createError) {
              // Если возникла ошибка создания, ещё раз проверяем наличие записи
              // Это может произойти если транзакция не предотвратила состояние гонки
              console.error(`[API/load-progress] Ошибка при создании прогресса, проверяем существование записи:`, createError);
              const finalCheck = await tx.progress.findUnique({
                where: { user_id: userId }
              });
              
              if (finalCheck) {
                console.log(`[API/load-progress] Прогресс найден после ошибки создания для ${userId}`);
                return finalCheck;
              }
              
              // Если запись так и не найдена, пробрасываем ошибку
              throw createError;
            }
          }, 
          {
            maxWait: 5000, // Максимальное время ожидания начала транзакции (5 секунд)
            timeout: 10000  // Максимальное время выполнения транзакции (10 секунд)
          }
        );
        
        // Пытаемся определить, создали ли мы новую запись или получили существующую
        const isNewlyCreated = (progress.version === 1 && new Date(progress.updated_at).getTime() >= currentTime.getTime() - 5000);
        
        // Если это новая запись, используем начальное состояние
        // Иначе получаем фактические данные из БД
        const responseGameState = isNewlyCreated ? initialGameState : progress.game_state;
        
        console.log(`[API/load-progress] ${isNewlyCreated ? 'Создан' : 'Получен существующий'} прогресс для пользователя: ${userId}`);
        
        // Обновляем токен пользователя
        await prisma.user.update({
          where: { id: userId },
          data: { jwt_token: token }
        });
        
        return NextResponse.json({
          success: true,
          data: {
            gameState: responseGameState,
            isCompressed: false,
            lastModified: new Date(progress.updated_at).getTime(),
            version: progress.version,
            isNewUser: isNewlyCreated
          }
        });
      } catch (error) {
        console.error(`[API/load-progress] Ошибка при создании/получении прогресса:`, error);
        
        // Повторная проверка, был ли создан прогресс, несмотря на ошибку
        try {
          const existingProgress = await prisma.progress.findUnique({
            where: { user_id: userId }
          });
          
          if (existingProgress) {
            console.log(`[API/load-progress] Найден существующий прогресс после ошибки`);
            
            // Получаем данные игрового состояния
            const gameState = existingProgress.game_state as any;
            
            return NextResponse.json({
              success: true,
              data: {
                gameState: gameState,
                isCompressed: false,
                lastModified: new Date(existingProgress.updated_at).getTime(),
                version: existingProgress.version
              }
            });
          }
        } catch (findError) {
          console.error(`[API/load-progress] Ошибка при повторной проверке прогресса:`, findError);
        }
        
        // Если все попытки не удались, возвращаем ошибку
        return NextResponse.json({ 
          error: 'Ошибка создания/получения прогресса', 
          details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
      }
    }

    // Обновляем токен пользователя, если он не совпадает с текущим
    if (user.jwt_token !== token) {
      await prisma.user.update({
        where: { id: user.id },
        data: { jwt_token: token }
      });
      console.log(`[API/load-progress] Обновлен токен пользователя ${user.id}`);
    }

    // Проверяем, сжаты ли данные
    if (progress.is_compressed) {
      console.log(`[API/load-progress] Данные сжаты для пользователя: ${userId}`);
      return NextResponse.json({
        success: true,
        data: {
          gameState: progress.game_state,
          isCompressed: true,
          lastSaved: progress.updated_at,
        },
      });
    }

    // Получаем данные игрового состояния
    const gameState = progress.game_state as any;
    
    // Проверка формата данных - поддерживаем как новый структурированный формат, так и старый
    if (!gameState) {
      console.error(`[API/load-progress] Пустое состояние игры для пользователя: ${userId}`);
      return NextResponse.json({ 
        error: "Пустое состояние игры" 
      }, { status: 400 });
    }
    
    // Проверяем структуру без строгой типизации
    let isValidGameState = false;
    
    // Проверка для структурированного формата
    if (typeof gameState === 'object' && gameState.critical && gameState.critical.inventory) {
      isValidGameState = true;
    } 
    // Проверка для обычного формата
    else if (typeof gameState === 'object' && gameState.inventory) {
      isValidGameState = true;
    }
    
    if (!isValidGameState) {
      console.error(`[API/load-progress] Некорректный формат данных сохранения для пользователя: ${userId}`);
      return NextResponse.json({ 
        error: "Некорректный формат данных сохранения" 
      }, { status: 400 });
    }
    
    console.log(`[API/load-progress] Успешно загружен прогресс для пользователя: ${userId}`);
    
    return NextResponse.json({
      success: true,
      data: {
        gameState: gameState,
        isCompressed: false,
        lastModified: new Date(progress.updated_at).getTime(),
        version: progress.version
      }
    });
  } catch (error) {
    console.error('[API/load-progress] Ошибка при загрузке прогресса:', error);
    
    return NextResponse.json({
      error: 'Ошибка при загрузке прогресса',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 