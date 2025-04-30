import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import ImageProtection from "./components/common/ImageProtection";
import localFont from 'next/font/local'
// import Script from "next/script";

// Загрузка локального шрифта Lyons Secondary Bold
const lyonsFont = localFont({ 
  src: '../public/fonts/Lyons Secondary Bold_7742.ttf',
  variable: '--font-lyons',
  display: 'swap',
})

// Данные для SEO
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://royaleway.top";
const title = "RoyaleWay";
const description = "Play and earn with Web3 game!";
const imageUrl = `${siteUrl}/images/auth/authentication.webp`;

export const metadata: Metadata = {
  title: "RoyaleWay",
  description,
  authors: [
    {
      name: "RoyaleWay",
      url: siteUrl,
    },
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title,
    description,
    siteName: "RoyaleWay",
    images: [{ url: imageUrl }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [imageUrl],
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={lyonsFont.className}>
      <head>
        {/* <meta name="darkreader-lock" /> */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no"
        />
        {/* Отключить автоматическое определение телефонных номеров */}
        <meta name="format-detection" content="telephone=no" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Farcaster Frame Meta Tags */}
        <meta 
          name="fc:frame" 
          content={JSON.stringify({
            version: "next",
            imageUrl: `${siteUrl}/game/cast.webp`,
            button: {
              title: "Play Game",
              action: {
                type: "launch_frame",
                name: "RoyaleWay",
                url: siteUrl,
                splashImageUrl: `${siteUrl}/game/Splashimage.webp`,
                splashBackgroundColor: "#0F172A"
              }
            }
          })}
        />
      </head>
      <body className={lyonsFont.variable}>
        <Providers>
          {/* Добавляем компонент для защиты изображений */}
          <ImageProtection />
          {/* Добавляем компонент для управления звуком */}
          {children}
        </Providers>
      </body>
    </html>
  );
}