import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/app/utils/supabase";
import { rateLimit } from "@/app/utils/rateLimit";
import * as crypto from "crypto";

// Лимиты на размер сохраняемых данных
const MAX_SAVE_SIZE = 100 * 1024; // 100KB
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 минута
const RATE_LIMIT_MAX = 20; // 20 запросов в минуту

// Кэш для метаданных сохранений, чтобы снизить нагрузку на БД
const metadataCache = new Map<string, {
  version: number;
  timestamp: number;
  cacheTime: number;
}>();

// Время жизни кэша метаданных (5 минут)
const METADATA_CACHE_TTL = 5 * 60 * 1000;

/**
 * Проверяет валидность токена
 * @param userId ID пользователя
 * @param token Токен авторизации
 */
async function validateToken(userId: string, token: string): Promise<boolean> {
  try {
    // Извлекаем токен без префикса "Bearer "
    const actualToken = token.startsWith("Bearer ") ? token.substring(7) : token;
    
    // Простая проверка формата токена (в реальном приложении здесь будет более сложная логика)
    if (!actualToken.includes(`tg_${userId}`)) {
      return false;
    }
    
    // Проверяем наличие пользователя в базе
    const { data, error } = await supabase
      .from('users')
      .select('id, telegram_id')
      .eq('telegram_id', userId)
      .maybeSingle();
    
    if (error || !data) {
      return false;
    }
    
    // В реальном приложении здесь будет более сложная проверка токена
    // Например, проверка подписи, срока действия и т.д.
    
    return true;
  } catch (error) {
    console.error('Ошибка при проверке токена:', error);
    return false;
  }
}

// GET - получить сохранённое состояние или метаданные
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  
  // Проверяем авторизацию (должен быть Bearer токен)
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Проверяем валидность токена
  const isValidToken = await validateToken(userId, authHeader);
  if (!isValidToken) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }
  
  // Проверяем, запрашиваются ли метаданные
  const isMetadataRequest = request.nextUrl.searchParams.has("metadata");
  
  try {
    if (isMetadataRequest) {
      // Получаем метаданные
      const metadata = await getStateMetadata(userId);
      return NextResponse.json(metadata);
    } else {
      // Получаем последнюю известную версию с клиента
      const lastKnownVersion = request.nextUrl.searchParams.get("lastKnownVersion") || "0";
      
      // Проверяем, нужно ли отправлять обновление
      const metadata = await getStateMetadata(userId);
      
      // Если клиент имеет актуальную версию, возвращаем 304
      if (metadata.version.toString() === lastKnownVersion) {
        return new NextResponse(null, { status: 304 });
      }
      
      // Получаем данные из Supabase
      const { data, error } = await supabase
        .from('user_progress')
        .select('game_state')
        .eq('telegram_id', userId)
        .maybeSingle();
      
      if (error) {
        throw error;
      }
      
      if (!data || !data.game_state) {
        return NextResponse.json({ error: "No saved state found" }, { status: 404 });
      }
      
      return NextResponse.json(data.game_state);
    }
  } catch (error) {
    console.error("Error fetching game state:", error);
    return NextResponse.json(
      { error: "Failed to fetch game state" },
      { status: 500 }
    );
  }
}

// POST - сохранить состояние игры
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  
  // Проверяем авторизацию (должен быть Bearer токен)
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Проверяем валидность токена
  const isValidToken = await validateToken(userId, authHeader);
  if (!isValidToken) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }
  
  // Проверяем лимит запросов
  const limiter = await rateLimit(userId, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
  if (!limiter.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded", reset: limiter.reset },
      { status: 429 }
    );
  }
  
  try {
    // Парсим тело запроса
    const body = await request.json();
    const gameState = body;
    
    // Проверяем размер данных
    const stateSize = JSON.stringify(gameState).length;
    if (stateSize > MAX_SAVE_SIZE) {
      return NextResponse.json(
        { error: "State size exceeds maximum allowed" },
        { status: 413 }
      );
    }
    
    // Генерируем временную метку и версию
    const timestamp = Date.now();
    const version = (gameState._saveVersion || 0) + 1;
    
    // Проверяем, существует ли запись
    const { data: existingData, error: queryError } = await supabase
      .from('user_progress')
      .select('id')
      .eq('telegram_id', userId)
      .maybeSingle();
    
    if (queryError) {
      throw queryError;
    }
    
    let saveError;
    
    // Подготавливаем данные для сохранения
    const stateToSave = {
      ...gameState,
      _saveVersion: version,
      _serverSavedAt: new Date().toISOString(),
    };
    
    if (existingData) {
      // Обновляем существующую запись
      const { error } = await supabase
        .from('user_progress')
        .update({
          game_state: stateToSave,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', userId);
      
      saveError = error;
    } else {
      // Создаем новую запись
      const { error } = await supabase
        .from('user_progress')
        .insert({
          telegram_id: userId,
          game_state: stateToSave
        });
      
      saveError = error;
    }
    
    if (saveError) {
      throw saveError;
    }
    
    // Обновляем кэш метаданных
    metadataCache.set(userId, {
      version,
      timestamp,
      cacheTime: Date.now()
    });
    
    return NextResponse.json({
      success: true,
      version,
      timestamp
    });
  } catch (error) {
    console.error("Error saving game state:", error);
    return NextResponse.json(
      { error: "Failed to save game state" },
      { status: 500 }
    );
  }
}

// Вспомогательная функция для получения метаданных о состоянии
async function getStateMetadata(userId: string): Promise<{version: number, timestamp: number}> {
  // Проверяем кэш
  const cachedData = metadataCache.get(userId);
  if (cachedData && (Date.now() - cachedData.cacheTime < METADATA_CACHE_TTL)) {
    return {
      version: cachedData.version,
      timestamp: cachedData.timestamp
    };
  }
  
  // Если в кэше нет, получаем данные из БД
  const { data, error } = await supabase
    .from('user_progress')
    .select('updated_at, game_state')
    .eq('telegram_id', userId)
    .maybeSingle();
  
  if (error) {
    throw error;
  }
  
  if (!data) {
    return { version: 0, timestamp: 0 };
  }
  
  // Извлекаем версию и временную метку
  const version = data.game_state?._saveVersion || 0;
  const timestamp = new Date(data.updated_at).getTime();
  
  // Обновляем кэш
  metadataCache.set(userId, {
    version,
    timestamp,
    cacheTime: Date.now()
  });
  
  return { version, timestamp };
} 