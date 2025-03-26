import React from 'react';
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { GameProvider } from "./contexts"
import { TranslationProvider } from "./i18n"
import { FarcasterProvider } from "./contexts/FarcasterContext"

const inter = Inter({ subsets: ["latin"] })

// Базовый URL приложения (из переменных окружения или хардкод для продакшена)
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://snotcoin.online';
const imageUrl = `${siteUrl}/images/auth/authentication.webp`;

export const metadata: Metadata = {
  title: "Snot Coin | Ultimate Snot Farming Game",
  description: "Collect snot, upgrade your equipment, and become the ultimate snot farmer!",
  generator: 'v0.dev',
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'SnotCoin Mining Game',
    description: 'A Telegram-based crypto mining game',
    images: [
      {
        url: imageUrl,
        width: 1200,
        height: 628,
      }
    ],
  },
  // Farcaster Frames metadata
  other: {
    // Основные метатеги для Frames v2
    'fc:frame': 'vNext',
    'fc:frame:image': imageUrl,
    'fc:frame:image:aspect_ratio': '1.91:1',
    'fc:frame:post_url': siteUrl,
    
    // Кнопки действий
    'fc:frame:button:1': 'Play SnotCoin Game',
    'fc:frame:button:1:target': siteUrl,
    'fc:frame:button:2': 'Learn More',
    'fc:frame:button:2:target': `${siteUrl}/about`,
    
    // Дополнительные метатеги
    'fc:frame:state': '',
    'fc:frame:support:content': 'rich',
    'fc:frame:support:refresh': 'auto',
    'fc:frame:support:resend': 'conditional'
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* CSP frame-ancestors директива перенесена в HTTP заголовки */}
      </head>
      <body className={inter.className}>
        <FarcasterProvider>
          <TranslationProvider>
            <GameProvider>
              {children}
            </GameProvider>
          </TranslationProvider>
        </FarcasterProvider>
      </body>
    </html>
  )
}