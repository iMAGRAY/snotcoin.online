import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import ImageProtection from "./components/common/ImageProtection";
// import Script from "next/script";

// Данные для SEO
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://snotcoin.online";
const title = "SnotCoin";
const description = "PLAY 2 SNOT";
const imageUrl = `${siteUrl}/images/auth/authentication.webp`;

export const metadata: Metadata = {
  title: "Snotcoin",
  description: "PLAY 2 SNOT",
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
    siteName: title,
    images: [{ url: imageUrl }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [imageUrl],
  },
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
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
                name: "Snotcoin",
                url: siteUrl,
                splashImageUrl: `${siteUrl}/game/Splashimage.webp`,
                splashBackgroundColor: "#0F172A"
              }
            }
          })}
        />
      </head>
      <body>
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