import { NextRequest, NextResponse } from 'next/server';

/**
 * Генерирует HTML фрейм Farcaster для различных типов контента
 * 
 * @param request Запрос Next.js
 * @param params Параметры пути, включая type - тип фрейма
 * @returns HTML страницу с фреймом
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  // Получаем домен сайта
  const host = request.headers.get('host') || 'royaleway.top';
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const baseUrl = `${protocol}://${host}`;
  
  // Параметры фрейма по умолчанию
  let frameParams = {
    title: 'RoyaleWay',
    description: 'PLAY 2 SNOT - Merge Game',
    image: `${baseUrl}/game/cast.webp`,
    buttonText: 'Play Game',
    buttonUrl: baseUrl,
    splashImage: `${baseUrl}/game/Splashimage.webp`,
    splashBgColor: '#0F172A'
  };
  
  // Настраиваем параметры в зависимости от типа фрейма
  switch (params.type) {
    case 'laboratory':
      frameParams = {
        ...frameParams,
        title: 'RoyaleWay Laboratory',
        description: 'Create more snot in the laboratory',
        image: `${baseUrl}/game/laboratory.webp`,
        buttonText: 'Enter Laboratory',
        buttonUrl: `${baseUrl}?tab=laboratory`,
      };
      break;
      
    case 'merge':
      frameParams = {
        ...frameParams,
        title: 'RoyaleWay Merge',
        description: 'Merge your snots to level up',
        image: `${baseUrl}/game/merge.webp`,
        buttonText: 'Merge Snots',
        buttonUrl: `${baseUrl}?tab=merge`,
      };
      break;
      
    case 'storage':
      frameParams = {
        ...frameParams,
        title: 'RoyaleWay Storage',
        description: 'Check your storage of snot',
        image: `${baseUrl}/game/storage.webp`,
        buttonText: 'Open Storage',
        buttonUrl: `${baseUrl}?tab=storage`,
      };
      break;
    
    // Можно добавить другие типы фреймов при необходимости
  }
  
  // Создаем JSON для метатега fc:frame
  const frameMetaContent = JSON.stringify({
    version: 'next',
    imageUrl: frameParams.image,
    button: {
      title: frameParams.buttonText,
      action: {
        type: 'launch_frame',
        name: frameParams.title,
        url: frameParams.buttonUrl,
        splashImageUrl: frameParams.splashImage,
        splashBackgroundColor: frameParams.splashBgColor
      }
    }
  });
  
  // Генерируем HTML страницу с фреймом
  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${frameParams.title}</title>

  <!-- Farcaster Frame Meta Tags -->
  <meta name="fc:frame" content='${frameMetaContent}' />

  <!-- OpenGraph Meta Tags -->
  <meta property="og:title" content="${frameParams.title}" />
  <meta property="og:description" content="${frameParams.description}" />
  <meta property="og:image" content="${frameParams.image}" />
  <meta property="og:url" content="${request.url}" />
  <meta property="og:type" content="website" />

  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, sans-serif;
      background-color: #0F172A;
      color: #fff;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      text-align: center;
    }
    .background {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
    }
    .background img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.8;
    }
    .container {
      position: relative;
      z-index: 10;
      max-width: 500px;
      padding: 20px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    p {
      font-size: 1.2rem;
      margin-bottom: 2rem;
    }
    .play-button {
      display: inline-block;
      background-color: #4CAF50;
      color: white;
      padding: 12px 30px;
      font-size: 1.2rem;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      transition: background-color 0.3s;
    }
    .play-button:hover {
      background-color: #45a049;
    }
  </style>
</head>
<body>
  <div class="background">
    <img src="${frameParams.image}" alt="${frameParams.title} background">
  </div>
  <div class="container">
    <h1>${frameParams.title}</h1>
    <p>${frameParams.description}</p>
    <a href="${frameParams.buttonUrl}" class="play-button">${frameParams.buttonText}</a>
  </div>
</body>
</html>
  `;
  
  // Возвращаем HTML с правильными заголовками
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=3600',
    },
  });
} 