/** @type {import('next').NextConfig} */
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
        hostname: 'snotcoin.online',
      },
      {
        protocol: 'https',
        hostname: 'imagedelivery.net',
      },
    ],
  },

  // Настройка webpack для правильной обработки CSS
  webpack: (config) => {
    // Находим правило для CSS
    const cssRule = config.module.rules.find(
      (rule) => rule.test && rule.test.toString().includes('css')
    );

    if (cssRule) {
      // Добавляем loaders если они отсутствуют
      const hasPostCSSLoader = cssRule.use.some(
        (loader) => loader.loader && loader.loader.includes('postcss-loader')
      );

      if (!hasPostCSSLoader) {
        console.log('Adding PostCSS loader to CSS processing pipeline');
        cssRule.use.push({
          loader: 'postcss-loader',
          options: {
            postcssOptions: {
              plugins: ['tailwindcss', 'autoprefixer'],
            },
          },
        });
      }
    } else {
      console.log('CSS rule not found in webpack config');
    }

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
        ],
      },
    ];
  },
};

module.exports = nextConfig; 