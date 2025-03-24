import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Создаем клиент Supabase
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_KEY ?? ''
)

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const requestStartTime = Date.now()

  try {
    // Проверяем наличие необходимых переменных окружения
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error: Supabase credentials missing' },
        { status: 500 }
      )
    }

    // Получаем telegram_id из URL
    const url = new URL(request.url)
    const telegramId = url.searchParams.get('telegramId')

    if (!telegramId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: telegramId' },
        { status: 400 }
      )
    }

    // Находим пользователя по telegram_id
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('telegram_id', telegramId)
      .single()

    if (userError) {
      if (userError.code === 'PGRST116') {
        // В случае отсутствия пользователя, возвращаем пустой прогресс вместо ошибки
        return NextResponse.json(null, { status: 200 })
      }
      
      return NextResponse.json(
        { error: 'Database error', details: userError.message },
        { status: 500 }
      )
    }

    if (!userData || !userData.id) {
      // Возвращаем пустой прогресс вместо ошибки
      return NextResponse.json(null, { status: 200 })
    }

    // Получаем прогресс игры
    const { data: progressData, error: progressError } = await supabaseAdmin
      .from('user_progress')
      .select('id, game_state, updated_at')
      .eq('user_id', userData.id)
      .single()

    if (progressError) {
      if (progressError.code === 'PGRST116') {
        // Инициализируем начальное состояние игры
        const initialGameState = {
          user: {
            id: userData.id,
            telegram_id: telegramId
          },
          inventory: {
            snot: 0,
            snotCoins: 0,
            containerSnot: 0,
            containerCapacity: 1,
            Cap: 1,
            fillingSpeed: 1 / (24 * 60 * 60), // 1 единица в день
            containerCapacityLevel: 1,
            fillingSpeedLevel: 1,
            collectionEfficiency: 1.0,
          },
          activeTab: 'laboratory',
          gameStarted: true,
          isPlaying: false,
          settings: {
            language: 'en',
            theme: 'light',
            notifications: true,
            tutorialCompleted: false
          },
          soundSettings: {
            backgroundMusicVolume: 0.3,
            clickVolume: 0.5,
            effectsVolume: 0.5,
            isBackgroundMusicMuted: false,
            isEffectsMuted: false,
            isMuted: false
          },
          // Добавляем метаданные
          _saveVersion: 1,
          _lastSaved: new Date().toISOString(),
          _isInitialState: true
        };
        
        const requestDuration = Date.now() - requestStartTime;
        
        // Создаём запись в базе данных для нового пользователя
        const { error: createError } = await supabaseAdmin
          .from('user_progress')
          .insert({
            user_id: userData.id,
            game_state: initialGameState,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        return NextResponse.json(initialGameState, { status: 200 });
      }
      
      // Даже в случае ошибки возвращаем пустое состояние, чтобы игра могла запуститься
      return NextResponse.json(null, { status: 200 })
    }

    // Проверяем наличие и корректность данных
    if (!progressData || !progressData.game_state) {
      const requestDuration = Date.now() - requestStartTime;
      return NextResponse.json(null, { status: 200 });
    }
    
    const gameState = progressData.game_state;
    
    // Убедимся, что метаданные присутствуют
    if (!gameState._saveVersion) {
      gameState._saveVersion = 1;
    }
    
    if (!gameState._lastSaved) {
      gameState._lastSaved = progressData.updated_at || new Date().toISOString();
    }
    
    // Добавляем отметку времени загрузки
    gameState._loadedFromServer = new Date().toISOString();
    gameState._serverLoadedAt = Date.now();
    
    const requestDuration = Date.now() - requestStartTime;
    return NextResponse.json(gameState, { status: 200 });

  } catch (err) {
    const error = err as Error;
    return NextResponse.json(
      { error: 'Server error', details: error.message },
      { status: 500 }
    );
  }
} 