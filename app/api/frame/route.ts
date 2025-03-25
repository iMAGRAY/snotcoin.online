import { NextRequest, NextResponse } from 'next/server';

// Константа для определения хоста
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://snotcoin.online';

/**
 * Обработчик POST запросов для Farcaster Frames
 * Возвращает HTML или перенаправляет пользователя на игру
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Логирование данных запроса для отладки
    console.log('Farcaster Frame request data:', JSON.stringify(body, null, 2));
    
    // Получаем данные пользователя Farcaster из запроса
    const fid = body?.untrustedData?.fid;
    const username = body?.untrustedData?.username || 'Player';
    
    // Проверяем, был ли нажата кнопка Play Game
    if (body?.untrustedData?.buttonIndex === 1) {
      // Для Farcaster Frames v2 не используем прямой редирект через статус код,
      // а возвращаем HTML со специальным тегом для редиректа
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta property="fc:frame" content="vNext" />
            <meta property="fc:frame:image" content="${BASE_URL}/game/cast.webp" />
            <meta property="fc:frame:redirect" content="${BASE_URL}/?fid=${fid}&username=${encodeURIComponent(username)}&embed=true" />
            <title>Redirecting to Snotcoin Game...</title>
          </head>
          <body>
            <p>Redirecting to Snotcoin Game...</p>
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
    
    // Возвращаем HTML с начальным экраном, если кнопка не была нажата
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta property="fc:frame" content="vNext" />
          <meta property="og:image" content="${BASE_URL}/game/cast.webp" />
          <meta property="fc:frame:image" content="${BASE_URL}/game/cast.webp" />
          <meta property="fc:frame:button:1" content="Play Game" />
          <meta property="fc:frame:button:1:action" content="post" />
          <meta property="fc:frame:post_url" content="${BASE_URL}/api/frame" />
          <title>Snotcoin Game</title>
        </head>
        <body>
          <div style="text-align: center; padding: 20px;">
            <h1>Snotcoin Game</h1>
            <p>Welcome, ${username}!</p>
            <p>Click "Play Game" to start playing.</p>
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
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta property="fc:frame" content="vNext" />
          <meta property="og:image" content="${BASE_URL}/error.png" />
          <meta property="fc:frame:image" content="${BASE_URL}/error.png" />
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
        <meta property="og:image" content="${BASE_URL}/game/cast.webp" />
        <meta property="fc:frame:image" content="${BASE_URL}/game/cast.webp" />
        <meta property="fc:frame:button:1" content="Play Game" />
        <meta property="fc:frame:button:1:action" content="post" />
        <meta property="fc:frame:post_url" content="${BASE_URL}/api/frame" />
        <title>Snotcoin Game</title>
      </head>
      <body>
        <p>This is a Farcaster Frame for Snotcoin Game</p>
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