import { NextRequest, NextResponse } from 'next/server';

// Константа для определения хоста
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://snotcoin.online';
const IMAGE_URL = `${BASE_URL}/game/cast.webp`;

/**
 * Обработчик POST запросов для Farcaster Frames
 * Возвращает HTML с экраном для запуска игры
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Логирование данных запроса для отладки
    console.log('Farcaster Frame request data:', JSON.stringify(body, null, 2));
    
    // Получаем данные пользователя Farcaster из запроса
    const fid = body?.untrustedData?.fid;
    const username = body?.untrustedData?.username || 'Player';
    
    // Возвращаем HTML с экраном, направляющим прямо на игру
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <!-- Основные метатеги Farcaster Frame -->
          <meta name="fc:frame" content="vNext" />
          <meta name="fc:frame:image" content="${IMAGE_URL}" />
          <meta property="og:image" content="${IMAGE_URL}" />
          <meta name="fc:frame:image:aspect_ratio" content="1.91:1" />
          
          <!-- Кнопка для запуска игры -->
          <meta name="fc:frame:button:1" content="Play Game" />
          <meta name="fc:frame:button:1:action" content="link" />
          <meta name="fc:frame:button:1:target" content="${BASE_URL}/?fid=${fid}&username=${encodeURIComponent(username)}&embed=true" />
          
          <!-- Open Graph метатеги -->
          <meta property="og:title" content="Snotcoin Game" />
          <meta property="og:description" content="Play to earn game on Farcaster" />
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
          <!-- Основные метатеги Farcaster Frame -->
          <meta name="fc:frame" content="vNext" />
          <meta name="fc:frame:image" content="${BASE_URL}/error.png" />
          <meta property="og:image" content="${BASE_URL}/error.png" />
          
          <!-- Кнопка для повторной попытки -->
          <meta name="fc:frame:button:1" content="Try Again" />
          <meta name="fc:frame:button:1:action" content="link" />
          <meta name="fc:frame:button:1:target" content="${BASE_URL}/frame.html" />
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
        <!-- Основные метатеги Farcaster Frame -->
        <meta name="fc:frame" content="vNext" />
        <meta name="fc:frame:image" content="${IMAGE_URL}" />
        <meta property="og:image" content="${IMAGE_URL}" />
        <meta name="fc:frame:image:aspect_ratio" content="1.91:1" />
        
        <!-- Кнопка для запуска игры -->
        <meta name="fc:frame:button:1" content="Play Game" />
        <meta name="fc:frame:button:1:action" content="link" />
        <meta name="fc:frame:button:1:target" content="${BASE_URL}/?embed=true" />
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