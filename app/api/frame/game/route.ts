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
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="${BASE_URL}/game/gameplay.png" />
          <meta property="fc:frame:button:1" content="Back to Menu" />
          <meta property="fc:frame:button:1:action" content="post" />
          <meta property="fc:frame:button:1:post_url" content="${BASE_URL}/api/frame/back" />
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
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta property="fc:frame" content="vNext" />
          <meta property="fc:frame:image" content="${BASE_URL}/error.png" />
          <meta property="fc:frame:button:1" content="Try Again" />
          <meta property="fc:frame:button:1:action" content="post" />
          <meta property="fc:frame:button:1:post_url" content="${BASE_URL}/api/frame/game" />
          <title>Error</title>
        </head>
        <body>
          <h1>Something went wrong. Please try again.</h1>
        </body>
      </html>`,
      {
        status: 200, // Важно! Для фреймов даже при ошибке возвращаем 200
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  }
}

/**
 * Обработчик GET запросов для предпросмотра фрейма
 */
export async function GET() {
  return new NextResponse(
    `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${BASE_URL}/game/gameplay.png" />
        <meta property="fc:frame:button:1" content="Back to Menu" />
        <meta property="fc:frame:button:1:action" content="post" />
        <meta property="fc:frame:button:1:post_url" content="${BASE_URL}/api/frame/back" />
        <title>Snotcoin Game</title>
      </head>
      <body>
        <p>This is a Farcaster Frame for Snotcoin Game - Play Mode</p>
      </body>
    </html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    }
  );
} 