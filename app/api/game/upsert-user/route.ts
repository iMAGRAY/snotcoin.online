import { NextResponse } from 'next/server'
import { UserModel, ProgressModel } from '../../../utils/models'
import { verifyToken } from '../../../utils/jwt'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    // Получаем токен из заголовка
    let token: string | null = null;
    const authHeader = request.headers.get('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // Валидация токена
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized access - no token' },
        { status: 401 }
      )
    }
    
    // Проверяем валидность токена
    const { valid, user, error: tokenError } = verifyToken(token);
    
    if (!valid || !user) {
      return NextResponse.json(
        { error: 'Unauthorized access - invalid token', details: tokenError },
        { status: 401 }
      )
    }

    // Получаем данные от клиента
    let requestData;
    try {
      requestData = await request.json()
    } catch (err) {
      const error = err as Error
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    // Проверяем наличие необходимых полей
    if (!requestData.telegramId || !requestData.username || !requestData.firstName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const { telegramId, username, firstName, lastName = '', initialGameState = {} } = requestData

    // Проверяем соответствие telegramId пользователя с токеном
    if (user.telegram_id.toString() !== telegramId.toString()) {
      return NextResponse.json(
        { error: 'Unauthorized access - telegramId mismatch' },
        { status: 403 }
      )
    }

    try {
      // Проверяем, существует ли пользователь
      const existingUser = await UserModel.findByTelegramId(parseInt(telegramId.toString()));
      let userId;

      if (existingUser) {
        // Если пользователь существует, обновляем его данные
        const updatedUser = await UserModel.update({
          id: existingUser.id,
          username,
          first_name: firstName,
          last_name: lastName
        });

        userId = existingUser.id;
      } else {
        // Если пользователь не существует, создаем нового
        const newUser = await UserModel.create({
          telegram_id: parseInt(telegramId.toString()),
          username,
          first_name: firstName,
          last_name: lastName
        });

        userId = newUser.id;
      }

      // Обновляем или создаем запись прогресса игры
      if (Object.keys(initialGameState).length > 0) {
        // Проверяем, существует ли прогресс пользователя
        const existingProgress = await ProgressModel.findByUserId(userId);
        
        if (existingProgress) {
          // Обновляем существующий прогресс, объединяя с новыми данными
          const currentGameState = existingProgress.game_state as Record<string, any> || {};
          const mergedGameState = { ...currentGameState, ...initialGameState };
          
          await ProgressModel.update(userId, mergedGameState);
        } else {
          // Создаем новый прогресс
          await ProgressModel.create(userId, initialGameState);
        }
      }

      return NextResponse.json({ id: userId });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Database error', details: (dbError as Error).message },
        { status: 500 }
      );
    }
  } catch (err) {
    const error = err as Error
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    )
  }
} 