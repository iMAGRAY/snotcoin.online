/** @type {import('next').NextConfig} */
const nextConfig = {
  // Отключаем проверку ESLint при сборке
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Отключаем проверку TypeScript
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Указываем, что будем использовать файл .env.local для всех режимов
  env: {
    NEXT_CONFIG_ENV_LOADED: 'true',
  },
  
  // Отключаем строгий режим для маршрутов
  reactStrictMode: false,

  // Настройки сборки и оптимизации
  swcMinify: true,
  compress: true,
  productionBrowserSourceMaps: false,
  optimizeFonts: true,

  // Настройки изображений
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.farcaster.xyz',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'images.neynar.com',
      },
      {
        protocol: 'https',
        hostname: 'cloudflare-ipfs.com',
      },
      {
        protocol: 'https',
        hostname: 'royalecoin.online',
      },
      {
        protocol: 'https',
        hostname: 'imagedelivery.net',
      },
    ],
  },

  // Обработка .well-known папки для Farcaster
  // Используем API маршрут только как запасной вариант, если файл не существует
  async rewrites() {
    return [
      {
        source: '/.well-known/farcaster.json',
        has: [
          {
            type: 'header',
            key: 'x-use-api',
            value: '1',
          },
        ],
        destination: '/api/farcaster/manifest',
      },
    ];
  },

  // Настройки заголовков для безопасности и CORS
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
      {
        // Добавление заголовков CORS для всех API маршрутов
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
      {
        // Специальные заголовки CORS для маршрутов прогресса
        source: '/api/progress/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
      {
        // Заголовки для .well-known, чтобы убедиться, что файлы доступны
        source: '/.well-known/:path*',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
};

module.exports = nextConfig; 