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
  },
  // Update security headers configuration
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.telegram.org https://telegram.org https://*.telegram.me https://telegram.me"
          },
          {
            // Remove X-Frame-Options header
            key: 'X-Frame-Options',
            value: 'ALLOW-FROM https://*.telegram.org https://telegram.org https://*.telegram.me https://telegram.me'
          }
        ]
      }
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

