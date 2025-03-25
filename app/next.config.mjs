/** @type {import('next').NextConfig} */
const nextConfig = {
  // Игнорируем ошибки типов при сборке
  typescript: {
    // ⚠️ Опасная опция! Не использовать на продакшен-проектах!
    // Это включено только для упрощения процесса разработки
    ignoreBuildErrors: true,
  },
  // Игнорируем ошибки из ESLint при сборке
  eslint: {
    // Опасная опция! Не использовать на продакшен-проектах!
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.farcaster.xyz; connect-src 'self' https://api.farcaster.xyz https://hub.farcaster.xyz wss://hub.farcaster.xyz; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; frame-src 'self' https://warpcast.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://warpcast.com;",
          },
          {
            key: 'X-Frame-Options',
            value: 'ALLOW-FROM https://warpcast.com',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
}

export default nextConfig 