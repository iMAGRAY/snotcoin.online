import { NextRequest, NextResponse } from 'next/server';

// Константа для определения хоста
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://snotcoin.online';

/**
 * Обработчик POST запросов для Farcaster Frames
 * Возвращает HTML с встроенным iFrame для игры
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Логирование данных запроса для отладки
    console.log('Farcaster Frame request data:', JSON.stringify(body, null, 2));
    
    // Формирование данных пользователя из Farcaster
    const fid = body?.untrustedData?.fid;
    const username = body?.untrustedData?.username || 'user';
    
    // Получаем действие кнопки если есть
    const buttonIndex = body?.untrustedData?.buttonIndex;
    
    // Возвращаем HTML с игрой внутри фрейма
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="${BASE_URL}/game/frame-game.png" />
          <meta property="og:image" content="${BASE_URL}/game/frame-game.png" />
          <meta property="fc:frame:button:1" content="Play Game" />
          <meta property="fc:frame:button:1:action" content="post" />
          <meta property="fc:frame:post_url" content="${BASE_URL}/api/frame/game" />
          <meta property="fc:frame:button:2" content="View Leaderboard" />
          <meta property="fc:frame:button:2:action" content="post" />
          <meta property="fc:frame:post_url" content="${BASE_URL}/api/frame/leaderboard" />
          <title>Snotcoin Game</title>
        </head>
        <body>
          <div style="text-align: center;">
            <h1>Snotcoin Game</h1>
            <p>Welcome, ${username || 'Player'}!</p>
            <p>Click "Play Game" to start playing or "View Leaderboard" to see the top scores.</p>
          </div>
        </body>
      </html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  } catch (error) {
    console.error('Error in Farcaster Frame handler:', error);
    
    // Возвращаем страницу с ошибкой
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="${BASE_URL}/error.png" />
          <meta property="og:image" content="${BASE_URL}/error.png" />
          <meta property="fc:frame:button:1" content="Try Again" />
          <meta property="fc:frame:button:1:action" content="post" />
          <meta property="fc:frame:post_url" content="${BASE_URL}/api/frame" />
          <title>Error</title>
        </head>
        <body>
          <h1>Something went wrong. Please try again.</h1>
        </body>
      </html>`,
      {
        status: 500,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  }
}

/**
 * Обработчик GET запросов (может быть полезен для тестирования)
 */
export async function GET() {
  return new NextResponse(
    JSON.stringify({ message: 'This endpoint only accepts POST requests from Farcaster Frames' }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
} 