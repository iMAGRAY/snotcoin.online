/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Включаем Strict Mode обратно
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Эти опции не поддерживаются в Next.js 14.2.26
  // experimental: {
  //   fontLoaders: [
  //     { loader: 'next/font/local' } // Использовать только локальные шрифты
  //   ],
  // },
  // Увеличиваем таймаут для загрузки шрифтов и других ресурсов
  httpAgentOptions: {
    keepAlive: true,
    // timeout: 60000, // 60 секунд - не поддерживается
  },
  // Add other Next.js configurations here if needed
};

module.exports = nextConfig; 