/**
 * @type {import('next').NextConfig}
 */

const nextConfig = {
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
    domains: ['images.neynar.com', 'cloudflare-ipfs.com', 'snotcoin.online', 'imagedelivery.net'],
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
    ],
  },

  // Настройки вебпака
  webpack: (config, { dev, isServer }) => {
    // Кастомные настройки вебпака можно добавить здесь
    return config;
  },

  // Настройки заголовков для безопасности
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
          // Убираем ограничение X-Frame-Options, чтобы разрешить отображение в фрейме
          // {
          //   key: 'X-Frame-Options',
          //   value: 'SAMEORIGIN',
          // },
        ],
      },
    ];
  },

  // Переопределяем фазы сборки для всегда использования .env.local
  experimental: {
    // Включаем экспериментальные функции, если нужно
  },
};

module.exports = nextConfig; 