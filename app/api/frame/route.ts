import { NextRequest, NextResponse } from 'next/server';

// Базовый URL сайта
const BASE_URL = process.env.NEXT_PUBLIC_DOMAIN || 'https://snotcoin.online';
const IMAGE_URL = `${BASE_URL}/game/cast.webp`;

/**
 * Обработчик POST запросов от Farcaster Frame
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Frame POST request:', body);

    // Получаем данные пользователя
    const { fid, username } = body.untrustedData || {};
    
    // Если нажата кнопка Play Now
    if (body.buttonIndex === 1) {
      // Формируем URL для авторизации с параметрами пользователя
      const authUrl = new URL('/api/auth', BASE_URL);
      authUrl.searchParams.set('fid', fid);
      authUrl.searchParams.set('username', username);
      authUrl.searchParams.set('redirect', '/home');
      authUrl.searchParams.set('embed', 'true');

      // Редирект на страницу авторизации
      return NextResponse.redirect(authUrl);
    }

    // Если кнопка не нажата, возвращаем страницу с кнопкой
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="og:image" content="${IMAGE_URL}" />
          <meta property="fc:frame:button:1" content="Play now" />
          <meta property="fc:frame:button:1:action" content="post_redirect" />
          <meta property="fc:frame:button:1:target" content="${BASE_URL}/api/frame" />
        </head>
        <body>
          <h1>Welcome to Snotcoin!</h1>
          <p>Click the button to start playing.</p>
        </body>
      </html>`,
      {
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  } catch (error) {
    console.error('Frame error:', error);
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="og:image" content="${IMAGE_URL}" />
          <meta property="fc:frame:button:1" content="Try Again" />
          <meta property="fc:frame:button:1:action" content="post_redirect" />
          <meta property="fc:frame:button:1:target" content="${BASE_URL}/api/frame" />
        </head>
        <body>
          <h1>Error</h1>
          <p>Something went wrong. Please try again.</p>
        </body>
      </html>`,
      {
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
        <meta property="fc:frame" content="vNext" />
        <meta property="og:image" content="${IMAGE_URL}" />
        <meta property="fc:frame:button:1" content="Play now" />
        <meta property="fc:frame:button:1:action" content="post_redirect" />
        <meta property="fc:frame:button:1:target" content="${BASE_URL}/api/frame" />
      </head>
      <body>
        <h1>Welcome to Snotcoin!</h1>
        <p>Click the button to start playing.</p>
      </body>
    </html>`,
    {
      headers: {
        'Content-Type': 'text/html',
      },
    }
  );
} 