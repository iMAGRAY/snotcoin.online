import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // Проверяем заголовок авторизации
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    // Получаем токен из заголовка
    const token = authHeader.substring(7); // Убираем 'Bearer '
    
    // Получаем данные из запроса
    const body = await request.json();
    const { telegram_id } = body;
    
    if (!telegram_id) {
      return NextResponse.json(
        { error: 'Telegram ID is required' },
        { status: 400 }
      );
    }

    // Инициализируем клиент Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Проверяем валидность токена
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }
    
    // Проверяем соответствие токена и telegram_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegram_id)
      .eq('auth_id', authData.user.id)
      .single();
    
    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Session invalid or expired' },
        { status: 401 }
      );
    }
    
    // Проверяем, не устарели ли сессионные данные
    const lastAuthTime = new Date(userData.last_login || userData.created_at);
    const currentTime = new Date();
    const sessionMaxAge = 30 * 24 * 60 * 60 * 1000; // 30 дней в миллисекундах
    
    if (currentTime.getTime() - lastAuthTime.getTime() > sessionMaxAge) {
      return NextResponse.json(
        { error: 'Session expired, please re-authenticate' },
        { status: 401 }
      );
    }
    
    // Сессия действительна
    return NextResponse.json(
      { 
        status: 'valid',
        message: 'Session is valid',
        user: {
          id: userData.id,
          telegram_id: userData.telegram_id,
          username: userData.username,
          first_name: userData.first_name,
          last_name: userData.last_name,
        }
      },
      { status: 200 }
    );
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 