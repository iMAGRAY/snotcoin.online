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
  try {
    // Проверяем наличие необходимых переменных окружения
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error: Supabase credentials missing' },
        { status: 500 }
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

    // Проверяем, существует ли пользователь
    const { data: existingUser, error: findError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('telegram_id', telegramId)
      .single()

    let userId;

    // Если пользователь существует, обновляем его данные
    if (existingUser && !findError) {
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          username,
          first_name: firstName,
          last_name: lastName,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUser.id)

      if (updateError) {
        return NextResponse.json(
          { error: 'Database error', details: updateError.message },
          { status: 500 }
        )
      }

      userId = existingUser.id
    } else {
      // Если пользователь не существует, создаем нового
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert([{
          telegram_id: telegramId,
          username,
          first_name: firstName,
          last_name: lastName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (createError) {
        return NextResponse.json(
          { error: 'Database error', details: createError.message },
          { status: 500 }
        )
      }

      userId = newUser.id
    }

    // Обновляем или создаем запись прогресса игры
    if (Object.keys(initialGameState).length > 0) {
      // Проверяем, существует ли запись прогресса
      const { data: existingProgress, error: findProgressError } = await supabaseAdmin
        .from('user_progress')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (findProgressError && findProgressError.code !== 'PGRST116') {
        // Продолжаем выполнение, даже если возникла ошибка при поиске прогресса
      }

      if (existingProgress) {
        // Обновляем существующий прогресс
        const { data: currentProgressData } = await supabaseAdmin
          .from('user_progress')
          .select('game_state')
          .eq('id', existingProgress.id)
          .single()
        
        // Объединяем новое состояние игры с текущим
        const currentGameState = currentProgressData?.game_state || {}
        const mergedGameState = { ...currentGameState, ...initialGameState }
        
        const { error: updateProgressError } = await supabaseAdmin
          .from('user_progress')
          .update({
            game_state: mergedGameState,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProgress.id)

        if (updateProgressError) {
          // Продолжаем выполнение, даже если возникла ошибка при обновлении прогресса
        }
      } else {
        // Создаем новый прогресс
        const { error: createProgressError } = await supabaseAdmin
          .from('user_progress')
          .insert({
            user_id: userId,
            game_state: initialGameState,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (createProgressError) {
          // Продолжаем выполнение, даже если возникла ошибка при создании прогресса
        }
      }
    }

    return NextResponse.json({ id: userId })

  } catch (err) {
    const error = err as Error
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    )
  }
} 