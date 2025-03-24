import { NextResponse } from 'next/server'
import { UserModel, ProgressModel } from '../../../utils/models'
import { verifyToken } from '../../../utils/jwt'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const requestStartTime = Date.now()

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
    if (!requestData.telegramId || !requestData.gameState) {
      return NextResponse.json(
        { error: 'Missing required fields: telegramId and gameState' },
        { status: 400 }
      )
    }

    const { telegramId, gameState } = requestData

    // Проверяем, соответствует ли telegramId пользователю из токена
    if (user.telegram_id.toString() !== telegramId.toString()) {
      return NextResponse.json(
        { error: 'Unauthorized access - telegramId mismatch' },
        { status: 403 }
      )
    }
    
    // Получаем пользователя из БД
    const dbUser = await UserModel.findByTelegramId(parseInt(telegramId.toString()));
    
    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Очищаем игровое состояние перед сохранением
    const cleanedGameState = cleanGameState(gameState);
    
    // Сохраняем прогресс в БД
    const updatedProgress = await ProgressModel.update(dbUser.id, cleanedGameState);
    
    return NextResponse.json({
      success: true,
      version: updatedProgress.version,
      updated_at: updatedProgress.updated_at
    });
  } catch (error) {
    console.error('Error saving progress:', error)
    
    return NextResponse.json(
      { error: 'Server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  } finally {
    // Логируем время выполнения запроса
    const requestEndTime = Date.now()
    console.log(`Save progress request processed in ${requestEndTime - requestStartTime}ms`)
  }
}

/**
 * Очищает состояние игры перед сохранением
 */
function cleanGameState(gameState: any): any {
  // Создаем копию объекта для безопасного изменения
  const cleanedState = JSON.parse(JSON.stringify(gameState));
  
  // Удаляем ненужные для сохранения временные поля
  delete cleanedState._loadedFromServer;
  delete cleanedState._serverLoadedAt;
  
  // Добавляем метаданные
  cleanedState._saveVersion = (cleanedState._saveVersion || 0) + 1;
  cleanedState._lastSaved = new Date().toISOString();
  
  return cleanedState;
} 