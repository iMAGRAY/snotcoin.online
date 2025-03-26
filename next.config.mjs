import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Базовый домен приложения
const isProd = process.env.NODE_ENV === 'production';
const DOMAIN = isProd ? 'https://snotcoin.online' : 'http://localhost:3000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Добавляем настройки для домена
  assetPrefix: isProd ? 'https://snotcoin.online' : undefined,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hebbkx1anhila5yf.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'snotcoin.online',
        port: '',
        pathname: '/**',
      },
    ],
    formats: ['image/webp'],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    unoptimized: true,
  },
  // Update security headers configuration
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; frame-ancestors *; connect-src 'self' https: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.kaspersky-labs.com https://gc.kis.v2.scr.kaspersky-labs.com https://*.farcaster.xyz https://warpcast.com https://*.warpcast.com https://telegram.org https://*.telegram.org https://*.neynar.com https://neynarxyz.github.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
          },
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL'
          }
        ]
      }
    ]
  },
  compiler: {
    removeConsole: false,
  },
  // Добавляем настройки публичных переменных среды
  env: {
    NEXT_PUBLIC_DOMAIN: DOMAIN,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_FARCASTER_FRAME_URL: process.env.NEXT_PUBLIC_FARCASTER_FRAME_URL,
    NEXT_PUBLIC_NEYNAR_CLIENT_ID: process.env.NEYNAR_CLIENT_ID,
    NEXT_PUBLIC_IMAGE_HOST: process.env.NEXT_PUBLIC_IMAGE_HOST,
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@components': path.join(__dirname, 'app/components'),
      '@contexts': path.join(__dirname, 'app/contexts'),
      '@utils': path.join(__dirname, 'app/utils'),
      '@types': path.join(__dirname, 'app/types'),
      '@hooks': path.join(__dirname, 'app/hooks'),
    };
    
    // Решение проблемы с серверными модулями
    config.resolve.fallback = {
      ...config.resolve.fallback,
      net: false,
      tls: false,
      fs: false,
      dns: false,
      dgram: false,
      http: false,
      https: false,
      stream: false,
      crypto: false,
      zlib: false,
      path: false,
      os: false,
      'dns/promises': false,
    };
    
    // Исключаем модуль 'ioredis' из клиентской сборки
    if (!isServer) {
      config.externals = [
        ...(config.externals || []),
        'ioredis',
        'native-dns',
        'native-dns-cache',
      ];
    }
    
    return config;
  },
}

export default nextConfig;

