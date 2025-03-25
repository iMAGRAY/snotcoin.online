import { NextRequest, NextResponse } from 'next/server';

// Константа для определения хоста
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://snotcoin.online';

/**
 * Обработчик POST запросов для Farcaster Frames - возврат к начальному экрану
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Логирование данных запроса для отладки
    console.log('Farcaster Frame back request data:', JSON.stringify(body, null, 2));
    
    // Возвращаем HTML с начальным экраном
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="${BASE_URL}/og-image.png" />
          <meta property="og:image" content="${BASE_URL}/og-image.png" />
          <meta property="fc:frame:button:1" content="Play Game" />
          <meta property="fc:frame:button:1:action" content="post" />
          <meta property="fc:frame:post_url" content="${BASE_URL}/api/frame" />
          <meta property="fc:frame:button:2" content="View Leaderboard" />
          <meta property="fc:frame:button:2:action" content="post" />
          <meta property="fc:frame:post_url" content="${BASE_URL}/api/frame/leaderboard" />
          <title>Snotcoin Game</title>
        </head>
        <body>
          <div style="display: flex; justify-content: center; align-items: center; height: 100vh; text-align: center;">
            <h1>Snotcoin - Play to Earn Game</h1>
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
    console.error('Error in Farcaster Frame back handler:', error);
    
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
          <meta property="fc:frame:post_url" content="${BASE_URL}/api/frame/back" />
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