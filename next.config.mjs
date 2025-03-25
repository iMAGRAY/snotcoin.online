import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.farcaster.xyz https://gc.kis.v2.scr.kaspersky-labs.com;
              style-src 'self' 'unsafe-inline';
              img-src 'self' data: https: blob:;
              connect-src 'self' https://hub.farcaster.xyz wss://hub.farcaster.xyz;
              frame-src 'self' https://warpcast.com https://*.warpcast.com;
              frame-ancestors 'self' https://warpcast.com https://*.warpcast.com;
            `.replace(/\s+/g, ' ').trim()
=======
            value: "frame-ancestors 'self' https://*.telegram.org https://telegram.org https://*.telegram.me https://telegram.me"
>>>>>>> parent of cdf6f88 (Farcaster здравствуй)
=======
            value: "frame-ancestors 'self' https://*.telegram.org https://telegram.org https://*.telegram.me https://telegram.me"
>>>>>>> parent of cdf6f88 (Farcaster здравствуй)
=======
            value: "frame-ancestors 'self' https://*.telegram.org https://telegram.org https://*.telegram.me https://telegram.me"
>>>>>>> parent of cdf6f88 (Farcaster здравствуй)
          },
          {
            // Remove X-Frame-Options header
            key: 'X-Frame-Options',
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
            value: 'ALLOW-FROM https://warpcast.com'
=======
            value: 'ALLOW-FROM https://*.telegram.org https://telegram.org https://*.telegram.me https://telegram.me'
>>>>>>> parent of cdf6f88 (Farcaster здравствуй)
=======
            value: 'ALLOW-FROM https://*.telegram.org https://telegram.org https://*.telegram.me https://telegram.me'
>>>>>>> parent of cdf6f88 (Farcaster здравствуй)
=======
            value: 'ALLOW-FROM https://*.telegram.org https://telegram.org https://*.telegram.me https://telegram.me'
>>>>>>> parent of cdf6f88 (Farcaster здравствуй)
          }
        ],
      },
    ]
  },
  compiler: {
    removeConsole: false,
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

