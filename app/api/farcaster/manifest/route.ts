import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Обработчик GET запросов для возврата манифеста Farcaster
 * Можно динамически генерировать манифест или читать из файла
 */
export async function GET() {
  try {
    // Путь к файлу манифеста
    const manifestPath = path.join(process.cwd(), 'public', '.well-known', 'farcaster.json');
    
    // Проверка существования файла
    if (fs.existsSync(manifestPath)) {
      // Чтение файла манифеста
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      
      // Возвращаем манифест с правильными заголовками
      return NextResponse.json(manifest, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } else {
      // Если файл не существует, генерируем манифест динамически
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://snotcoin.online';
      
      const manifest = {
        accountAssociation: {
          protocol: 'farcaster',
          message: `We verify that ${new URL(siteUrl).hostname} is a Farcaster Mini App`,
          schemaVersion: '1.0.0',
          domain: new URL(siteUrl).hostname,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        frame: {
          version: 'next',
          name: 'Snotcoin',
          description: 'PLAY 2 SNOT - Merge, earn and progress in this addictive Farcaster game',
          homeUrl: siteUrl,
          iconUrl: `${siteUrl}/icon.png`,
          imageUrl: `${siteUrl}/game/cast.webp`,
          buttonTitle: 'Play Game',
          splashImageUrl: `${siteUrl}/game/Splashimage.webp`,
          splashBackgroundColor: '#0F172A',
          tags: ['game', 'play-to-earn', 'merge', 'nft'],
          permissions: [],
          notificationUrl: `${siteUrl}/api/farcaster/notifications`,
          webhookUrl: `${siteUrl}/api/farcaster/webhook`,
        },
      };
      
      // Возвращаем динамически сгенерированный манифест
      return NextResponse.json(manifest, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  } catch (error) {
    console.error('[Farcaster Manifest API] Error serving manifest:', error);
    return NextResponse.json(
      { error: 'Failed to generate manifest' },
      { status: 500 }
    );
  }
} 