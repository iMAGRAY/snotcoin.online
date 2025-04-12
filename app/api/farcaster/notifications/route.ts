import { NextRequest, NextResponse } from 'next/server';

/**
 * Обработчик уведомлений от Farcaster
 * Вызывается клиентом Farcaster при отправке уведомлений пользователю
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    console.log('[Farcaster Notifications API] Received notification request:', data);
    
    // Здесь можно добавить логику для проверки подписи и валидации запроса
    // Для продакшна необходимо добавить валидацию
    
    // Обработка различных типов событий
    const { eventType, userFid, payload } = data;
    
    if (!eventType || !userFid) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }
    
    // Логика обработки в зависимости от типа события
    switch (eventType) {
      case 'app.favorite':
        // Пользователь добавил приложение в избранное
        console.log(`User ${userFid} added app to favorites`);
        break;
        
      case 'app.unfavorite':
        // Пользователь удалил приложение из избранного
        console.log(`User ${userFid} removed app from favorites`);
        break;
        
      case 'app.notification':
        // Отправка уведомления пользователю
        console.log(`Sending notification to user ${userFid}:`, payload);
        break;
        
      default:
        return NextResponse.json(
          { success: false, error: `Unknown event type: ${eventType}` }, 
          { status: 400 }
        );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Farcaster Notifications API] Error processing request:', error);
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