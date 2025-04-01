/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Включаем Strict Mode обратно
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Add other Next.js configurations here if needed
};

module.exports = nextConfig; 