import { NextRequest, NextResponse } from 'next/server';

// Базовый URL сайта
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://snotcoin.online';
const IMAGE_URL = `${BASE_URL}/game/cast.webp`;

/**
 * Обработчик POST запросов от Farcaster Frame
 */
export async function POST(req: NextRequest) {
  try {
    // Логируем данные запроса для отладки
    console.log('POST request to /api/frame', await req.json());
    
    // Получаем данные пользователя из запроса
    const body = await req.json();
    const { fid, username } = body.untrustedData?.messageData || {};
    
    // Проверяем, какая кнопка была нажата
    const buttonIndex = body.untrustedData?.buttonIndex;
    
    // Если нажата первая кнопка (Play Game), перенаправляем на игру
    if (buttonIndex === 1) {
      // Формируем URL для редиректа с параметрами пользователя
      const redirectUrl = `${BASE_URL}/?embed=true&fid=${fid || ''}&username=${username || ''}`;
      
      return NextResponse.redirect(redirectUrl, {
        status: 302,
        headers: {
          'Location': redirectUrl
        }
      });
    }
    
    // Если кнопка не была нажата или это другая кнопка, 
    // возвращаем HTML с приветствием и кнопкой
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="og:image" content="${IMAGE_URL}" />
          <meta property="fc:frame:button:1" content="Play now" />
          <meta property="fc:frame:button:1:action" content="link" />
          <meta property="fc:frame:button:1:target" content="${BASE_URL}/?embed=true" />
        </head>
        <body>
          <h1>Welcome to Snotcoin Game!</h1>
          <p>Click the button to start playing.</p>
        </body>
      </html>
    `, {
      status: 200,
      headers: {
        'Content-Type': 'text/html'
      }
    });
    
  } catch (error) {
    console.error('Error in /api/frame POST handler:', error);
    
    // В случае ошибки возвращаем страницу ошибки с кнопкой "Попробовать снова"
    return new NextResponse(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="fc:frame" content="vNext" />
          <meta property="og:image" content="${BASE_URL}/error.png" />
          <meta property="fc:frame:button:1" content="Try Again" />
          <meta property="fc:frame:button:1:action" content="post" />
        </head>
        <body>
          <h1>Error</h1>
          <p>Something went wrong. Please try again.</p>
        </body>
      </html>
    `, {
      status: 200, // Важно! Даже для ошибок возвращаем 200, чтобы фрейм обработался
      headers: {
        'Content-Type': 'text/html'
      }
    });
  }
}

/**
 * Обработчик GET запросов для предпросмотра фрейма
 */
export async function GET(req: NextRequest) {
  return new NextResponse(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="og:image" content="${IMAGE_URL}" />
        <meta property="fc:frame:button:1" content="Play now" />
        <meta property="fc:frame:button:1:action" content="link" />
        <meta property="fc:frame:button:1:target" content="${BASE_URL}/?embed=true" />
      </head>
      <body>
        <h1>Snotcoin Game Preview</h1>
        <p>This is a preview of the Snotcoin Game frame.</p>
      </body>
    </html>
  `, {
    status: 200,
    headers: {
      'Content-Type': 'text/html'
    }
  });
} 