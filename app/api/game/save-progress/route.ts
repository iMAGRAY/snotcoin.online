import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { verifyJWT } from '../../../utils/jwt'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  console.log('[API] Получен запрос на сохранение прогресса');
  
  try {
    // Получаем данные из тела запроса
    let body;
    try {
      // Проверяем пустое тело запроса
      const text = await request.text();
      if (!text || text.trim() === '') {
        console.error('[API] Получено пустое тело запроса');
        return NextResponse.json({ error: 'Пустое тело запроса' }, { status: 400 });
      }
      
      // Парсим JSON с обработкой ошибок
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('[API] Ошибка при парсинге JSON:', parseError);
      return NextResponse.json({ 
        error: 'Невозможно распарсить JSON из запроса', 
        details: parseError instanceof Error ? parseError.message : 'Unknown error' 
      }, { status: 400 });
    }
    
    // Проверяем валидность данных
    if (!body || !body.gameState) {
      console.error('[API] Некорректные данные в запросе:', body ? 'отсутствует gameState' : 'отсутствует тело запроса');
      return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 });
    }
    
    // Важно: убедиться, что gameState не содержит некорректных значений для числовых полей
    // Проверка на целостность данных перед сохранением
    try {
      if (body.gameState._userId) {
        body.gameState._userId = String(body.gameState._userId);
      }

      // Вложенные объекты могут требовать проверки
      if (body.gameState.user && body.gameState.user.fid) {
        body.gameState.user.fid = String(body.gameState.user.fid);
      }
    } catch (validationError) {
      console.error('[API] Ошибка валидации данных:', validationError);
      // Продолжаем выполнение, так как это не критическая ошибка
    }
    
    // Проверяем токен через URL-параметр (для Beacon API)
    const tokenFromUrl = request.nextUrl.searchParams.get('token');
    
    // Извлекаем токен из заголовка Authorization
    const authHeader = request.headers.get('Authorization');
    let token;
    
    // Приоритет имеет токен из заголовка, затем из URL-параметра
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      console.log('[API] Токен получен из заголовка');
    } else if (tokenFromUrl) {
      token = tokenFromUrl;
      console.log('[API] Токен получен из URL-параметра (Beacon API)');
    } else {
      console.error('[API] Отсутствует токен авторизации (ни в заголовке, ни в URL)');
      return NextResponse.json({ error: 'Отсутствует токен авторизации' }, { status: 401 });
    }
    
    console.log('[API] Верифицируем JWT токен');
    // Проверяем валидность токена
    const { valid, userId, error: tokenError } = await verifyJWT(token);
    
    if (!valid || !userId) {
      console.error('[API] Невалидный токен авторизации:', tokenError);
      return NextResponse.json({
        error: 'Невалидный токен авторизации',
        details: tokenError
      }, { status: 401 });
    }
    
    console.log(`[API] Токен верифицирован, userId: ${userId}`);
    
    // Проверяем, что сохраняется состояние для текущего пользователя
    if (body.userId !== userId) {
      console.error(`[API] Конфликт ID пользователя: ${body.userId} (в запросе) !== ${userId} (в токене)`);
      return NextResponse.json({
        error: 'Запрещено сохранять состояние для другого пользователя'
      }, { status: 403 });
    }
    
    // Находим пользователя по ID
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      console.log(`[API] Пользователь не найден в базе данных: ${userId}`);
      
      try {
        // Проверяем, существует ли уже пользователь с таким ID
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { id: userId },
              { farcaster_fid: userId }
            ]
          }
        });
        
        if (existingUser) {
          console.log(`[API] Найден существующий пользователь с ID: ${existingUser.id} или farcaster_fid: ${existingUser.farcaster_fid}`);
          return await handleProgressSave(existingUser, body, token);
        }
        
        // Выполняем дополнительную проверку перед созданием
        const checkUserAgain = await prisma.user.findUnique({
          where: { id: userId }
        });
        
        if (checkUserAgain) {
          console.log(`[API] Найден пользователь при дополнительной проверке: ${checkUserAgain.id}`);
          return await handleProgressSave(checkUserAgain, body, token);
        }
        
        // Извлекаем числовую часть ID для использования в username
        const userIdParts = userId.split('_');
        const numericPart = userIdParts.length > 1 ? userIdParts[1] : '0';
        
        // Попытка создать пользователя на лету, если токен уже верифицирован
        try {
          const newUser = await prisma.user.create({
            data: {
              id: userId, // Используем существующий ID из токена
              farcaster_fid: userId, // В схеме farcaster_fid теперь String
              farcaster_username: `user_${numericPart}`, // Формируем имя пользователя
              farcaster_displayname: '', // Пустое отображаемое имя
              jwt_token: token // Сохраняем токен
            }
          });
          
          console.log(`[API] Создан временный пользователь на лету: ${newUser.id}`);
          
          // Продолжаем с новым пользователем
          return await handleProgressSave(newUser, body, token);
        } catch (createUserError) {
          console.error(`[API] Ошибка при создании пользователя:`, createUserError);
          
          // Ошибка P2002 указывает на нарушение уникального ограничения
          if ((createUserError as any).code === 'P2002') {
            // Пробуем еще раз найти пользователя
            const finalCheckUser = await prisma.user.findUnique({
              where: { id: userId }
            });
            
            if (finalCheckUser) {
              console.log(`[API] Пользователь найден при финальной проверке после ошибки: ${finalCheckUser.id}`);
              return await handleProgressSave(finalCheckUser, body, token);
            }
          }
          
          throw createUserError; // Пробрасываем ошибку дальше, если не можем обработать ситуацию
        }
      } catch (createError) {
        console.error(`[API] Ошибка при создании пользователя на лету:`, createError);
        
        // Если ошибка связана с уникальностью ID, попробуем найти пользователя
        if (createError && (createError as any).code === 'P2002') {
          try {
            // Пытаемся найти пользователя повторно
            const existingUser = await prisma.user.findFirst({
              where: {
                OR: [
                  { id: userId },
                  { farcaster_fid: userId }
                ]
              }
            });
            
            if (existingUser) {
              console.log(`[API] После ошибки найден пользователь с ID: ${existingUser.id}`);
              return await handleProgressSave(existingUser, body, token);
            }
          } catch (findError) {
            console.error('[API] Ошибка при повторном поиске пользователя:', findError);
          }
        }
        
        return NextResponse.json({ 
          error: 'Пользователь не найден. Необходима авторизация через Farcaster.',
          code: 'USER_NOT_FOUND'
        }, { status: 401 });
      }
    }
    
    console.log(`[API] Пользователь найден: ${user.id}, farcaster_fid: ${user.farcaster_fid}`);
    
    return await handleProgressSave(user, body, token);
  } catch (error) {
    console.error('[API] Ошибка при сохранении прогресса:', error);
    
    return NextResponse.json({
      error: 'Ошибка при сохранении прогресса',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Выделяем обработку сохранения прогресса в отдельную функцию
async function handleProgressSave(user: any, body: any, token: string) {
  try {
    // Получаем данные игрового состояния и информацию о сжатии
    const gameState = body.gameState;
    const isCompressed = body.isCompressed || false;
    
    console.log(`[API] Проверяем существование прогресса для пользователя ${user.id}`);
    // Определяем, нужно ли обновлять существующую запись или создавать новую
    const existingProgress = await prisma.progress.findUnique({
      where: { user_id: user.id }
    });
    
    const currentTime = new Date();
    const newVersion = body.version || (existingProgress ? existingProgress.version + 1 : 1);
    
    let updatedProgress;
    
    if (existingProgress) {
      console.log(`[API] Обновляем существующий прогресс для пользователя ${user.id}, текущая версия: ${existingProgress.version}, новая версия: ${newVersion}`);
      // Обновляем существующую запись без поля is_compressed, которое отсутствует в схеме
      updatedProgress = await prisma.progress.update({
        where: { user_id: user.id },
        data: {
          game_state: gameState,
          version: newVersion,
          updated_at: currentTime
        }
      });
    } else {
      try {
        console.log(`[API] Пытаемся создать новую запись прогресса для пользователя ${user.id}, версия: ${newVersion}`);
        // Создаем новую запись без поля is_compressed
        updatedProgress = await prisma.progress.create({
          data: {
            user_id: user.id,
            game_state: gameState,
            version: newVersion,
            created_at: currentTime,
            updated_at: currentTime
          }
        });
      } catch (createError) {
        // Обрабатываем ошибку уникального ограничения
        if ((createError as any).code === 'P2002' && (createError as any).meta?.target?.includes('user_id')) {
          console.log(`[API] Ошибка уникальности при создании прогресса. Повторная проверка существования прогресса...`);
          
          // Проверяем еще раз, возможно запись была создана между проверкой и созданием
          const retryProgress = await prisma.progress.findUnique({
            where: { user_id: user.id }
          });
          
          if (retryProgress) {
            console.log(`[API] Найден существующий прогресс при повторной проверке для пользователя ${user.id}, обновляем`);
            // Если запись найдена при повторной проверке, обновляем ее
            updatedProgress = await prisma.progress.update({
              where: { user_id: user.id },
              data: {
                game_state: gameState,
                version: newVersion,
                updated_at: currentTime
              }
            });
          } else {
            // Если запись все еще не найдена, это критическая ошибка
            throw new Error(`Не удалось создать или найти прогресс для пользователя ${user.id}`);
          }
        } else {
          // Если ошибка другого типа, пробрасываем ее дальше
          throw createError;
        }
      }
    }
    
    // Обновляем токен пользователя, если он не совпадает с текущим
    if (user.jwt_token !== token) {
      await prisma.user.update({
        where: { id: user.id },
        data: { jwt_token: token }
      });
      console.log(`[API] Обновлен токен пользователя ${user.id}`);
    }
    
    console.log(`[API] Сохранение прогресса успешно для пользователя ${user.id}, версия: ${updatedProgress.version}`);
    
    // Формируем ответ (сохраняем поле isCompressed в ответе для совместимости с клиентом)
    return NextResponse.json({
      success: true,
      message: "Прогресс успешно сохранен",
      progress: {
        userId: updatedProgress.user_id,
        version: updatedProgress.version,
        lastUpdated: updatedProgress.updated_at,
        isCompressed: isCompressed // Оставляем в ответе для API
      }
    });
  } catch (saveError) {
    console.error('[API] Ошибка при обработке сохранения прогресса:', saveError);
    
    return NextResponse.json({
      error: 'Ошибка при сохранении прогресса',
      details: saveError instanceof Error ? saveError.message : 'Unknown error'
    }, { status: 500 });
  }
} 