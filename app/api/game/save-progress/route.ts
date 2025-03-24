import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Создаем клиент Supabase с админским доступом
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_KEY ?? ''
)

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const requestStartTime = Date.now()

  try {
    // Проверка окружения
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Получаем данные из запроса
    const data = await request.json()
    
    // Валидация данных запроса
    if (!data || !data.telegramId || !data.gameState) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    const { telegramId, gameState } = data
    
    // Добавляем метаданные к состоянию
    const saveTimestamp = new Date().toISOString()
    gameState._lastSavedServer = saveTimestamp

    // Проверка и очистка состояния игры
    const cleanedGameState = cleanGameState(gameState)

    // Находим пользователя по telegram_id
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('telegram_id', telegramId)
      .single()

    if (userError) {
      if (userError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { error: 'Database error', details: userError.message },
        { status: 500 }
      )
    }

    if (!userData || !userData.id) {
      return NextResponse.json(
        { error: 'Invalid user data' },
        { status: 500 }
      )
    }

    // Сначала проверяем, существует ли запись
    const { data: existingProgress, error: findError } = await supabaseAdmin
      .from('user_progress')
      .select('id, game_state, version')
      .eq('user_id', userData.id)
      .single();
    
    if (findError && findError.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Database error', details: findError.message },
        { status: 500 }
      );
    }

    let upsertError;
    
    if (existingProgress) {
      // Проверяем потерю данных - восстанавливаем потерянные данные
      if (existingProgress.game_state && cleanedGameState) {
        // Проверяем, есть ли в существующем состоянии ресурсы для сравнения
        const existingGameState = existingProgress.game_state || {};
        
        // Сравниваем версии при наличии обоих версий
        if (existingGameState._saveVersion && gameState._saveVersion) {
          if (gameState._saveVersion < existingGameState._saveVersion) {
            return NextResponse.json({ 
              success: true, 
              skipped: true,
              savedAt: existingGameState._lastSaved,
              version: existingGameState._saveVersion,
              reason: 'Newer version already exists on server'
            });
          }
        }
        
        // Проверяем потерю данных - восстанавливаем потерянные данные
        if (existingGameState.inventory && gameState.inventory) {
          let restoredLostData = false;
          
          // Здесь можно добавить логику восстановления других важных данных при необходимости
        }
        
        // Обновляем состояние только если новая версия больше или равна существующей
        const { error: updateError } = await supabaseAdmin
          .from('user_progress')
          .update({
            game_state: cleanedGameState,  // Используем очищенное состояние
            updated_at: saveTimestamp
          })
          .eq('id', existingProgress.id);
        
        upsertError = updateError;
      }
    } else {
      // Если записи нет, создаем новую
      const { error: insertError } = await supabaseAdmin
        .from('user_progress')
        .insert({
          user_id: userData.id,
          game_state: cleanedGameState,  // Используем очищенное состояние
          created_at: saveTimestamp,
          updated_at: saveTimestamp
        });
      
      upsertError = insertError;
    }

    if (upsertError) {
      return NextResponse.json(
        { error: 'Database error', details: upsertError.message },
        { status: 500 }
      );
    }

    const requestDuration = Date.now() - requestStartTime;
    return NextResponse.json({ 
      success: true,
      savedAt: saveTimestamp,
      version: gameState._saveVersion
    });

  } catch (err) {
    const error = err as Error;
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
}

// Функция для очистки состояния игры от ненужных данных
function cleanGameState(state: any): any {
  // Создаем копию состояния
  const cleanedState = { ...state };
  
  // Удаляем ненужные поля
  const fieldsToRemove = [
    '_previousState',
    '_processingPairs',
    '_mergeInProgress',
    '_lastMergeTime',
    '_thrownBalls',
    '_worldRef',
    '_bodiesMap',
    '_tempData',
    '_runtimeData'
  ];
  
  fieldsToRemove.forEach(field => {
    if (field in cleanedState) {
      delete cleanedState[field];
    }
  });
  
  // Проверяем размер всего состояния
  const stateSize = JSON.stringify(cleanedState).length;
  if (stateSize > 5000000) { // 5MB
    // Глубокая очистка всех больших полей
    
    // Проверяем другие большие объекты
    Object.keys(cleanedState).forEach(key => {
      const value = cleanedState[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const valueSize = JSON.stringify(value).length;
        if (valueSize > 100000) { // 100KB
          cleanedState[key] = null;
        }
      }
    });
  }
  
  return cleanedState;
} 