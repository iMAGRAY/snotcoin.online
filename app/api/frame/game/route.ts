import { NextRequest, NextResponse } from 'next/server';

// Константа для определения хоста
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://snotcoin.online';

/**
 * Обработчик POST запросов для Farcaster Frames - игровой фрейм
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Логирование данных запроса для отладки
    console.log('Farcaster Frame game request data:', JSON.stringify(body, null, 2));
    
    // Формирование данных пользователя из Farcaster
    const fid = body?.untrustedData?.fid;
    const username = body?.untrustedData?.username || 'user';
    
    // Возвращаем HTML с игрой в iFrame
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="${BASE_URL}/game/gameplay.png" />
          <meta property="og:image" content="${BASE_URL}/game/gameplay.png" />
          <meta property="fc:frame:button:1" content="Back to Menu" />
          <meta property="fc:frame:button:1:action" content="post" />
          <meta property="fc:frame:post_url" content="${BASE_URL}/api/frame/back" />
          <meta property="fc:frame:button:2" content="Restart Game" />
          <meta property="fc:frame:button:2:action" content="post" />
          <meta property="fc:frame:post_url" content="${BASE_URL}/api/frame/game" />
          <title>Snotcoin Game</title>
          <style>
            body, html { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }
            iframe { border: none; width: 100%; height: 100%; }
          </style>
        </head>
        <body>
          <iframe src="${BASE_URL}/?fid=${fid}&username=${username}&embed=true" allow="fullscreen" allowfullscreen></iframe>
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
    console.error('Error in Farcaster Frame game handler:', error);
    
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