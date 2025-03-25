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
    domains: ['snotcoin.online', 'warpcast.com'],
  },
  // Update security headers configuration
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://warpcast.com;
              style-src 'self' 'unsafe-inline';
              img-src 'self' data: https: blob:;
              connect-src 'self' https://telegram.org https://warpcast.com wss://warpcast.com;
              frame-src 'self' https://warpcast.com;
              frame-ancestors 'self' https://warpcast.com;
            `.replace(/\s+/g, ' ').trim()
          },
          {
            key: 'X-Frame-Options',
            value: 'ALLOW-FROM https://warpcast.com'
          }
        ],
      },
    ];
  },
  compiler: {
    removeConsole: false,
  },
  // Добавляем настройки публичных переменных среды
  env: {
    NEXT_PUBLIC_DOMAIN: DOMAIN,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@components': path.join(__dirname, 'app/components'),
      '@contexts': path.join(__dirname, 'app/contexts'),
      '@utils': path.join(__dirname, 'app/utils'),
      '@types': path.join(__dirname, 'app/types'),
      '@hooks': path.join(__dirname, 'app/hooks'),
    };
    return config;
  },
}

export default nextConfig;

