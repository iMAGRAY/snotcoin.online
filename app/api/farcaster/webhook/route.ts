import { NextRequest, NextResponse } from 'next/server';

/**
 * Обработчик вебхуков от Farcaster
 * Данный эндпоинт может обрабатывать различные события от Farcaster,
 * такие как добавление пользователей, активность и т.д.
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    console.log('[Farcaster Webhook API] Received webhook:', data);
    
    // Здесь можно добавить логику для проверки подписи и валидации запроса
    // Для продакшна необходимо добавить валидацию
    
    // Обработка различных типов событий
    const { event, data: eventData } = data;
    
    if (!event) {
      return NextResponse.json({ success: false, error: 'Missing event type' }, { status: 400 });
    }
    
    // Логика обработки в зависимости от типа события
    switch (event) {
      case 'user.add':
        // Новый пользователь добавил приложение
        console.log('New user added the app:', eventData);
        break;
        
      case 'user.remove':
        // Пользователь удалил приложение
        console.log('User removed the app:', eventData);
        break;
        
      case 'user.interact':
        // Пользователь взаимодействовал с приложением
        console.log('User interaction:', eventData);
        break;
        
      default:
        console.log(`Received unknown event type: ${event}`, eventData);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Farcaster Webhook API] Error processing webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

/**
 * Обработчик OPTIONS запросов для CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
} 