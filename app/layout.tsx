import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { GameProvider } from "./contexts/GameContext"
import { TranslationProvider } from "./contexts/TranslationContext"
import "./styles/auth.css"

const inter = Inter({ subsets: ["latin"] })

// Базовый URL приложения (из переменных окружения или хардкод для продакшена)
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://snotcoin.online';
const imageUrl = `${siteUrl}/game/cast.webp`;

export const metadata: Metadata = {
  title: "Snotcoin - Play to Earn Game",
  description: "Play to earn game on Farcaster",
  metadataBase: new URL('https://snotcoin.online'),
  openGraph: {
    title: 'Snotcoin - Play to Earn Game',
    description: 'Play to earn game on Farcaster',
    url: 'https://snotcoin.online',
    siteName: 'Snotcoin',
    images: [
      {
        url: '/game/cast.webp',
        width: 1200,
        height: 630,
        alt: 'Snotcoin Game',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Snotcoin - Play to Earn Game',
    description: 'Play to earn game on Farcaster',
    images: ['/game/cast.webp'],
  },
  // Farcaster Frame метаданные по спецификации v2
  other: {
    // Обязательное поле, указывающее что это Farcaster Frame
    'fc:frame': 'vNext',
    // Изображение для отображения во фрейме (обязательное)
    'fc:frame:image': imageUrl,
    // Дублирование для OpenGraph совместимости
    'og:image': imageUrl,
    // Соотношение сторон изображения (опционально)
    'fc:frame:image:aspect_ratio': '1.91:1',
    // Кнопка 1
    'fc:frame:button:1': 'Play Game',
    'fc:frame:button:1:action': 'link',
    'fc:frame:button:1:target': 'https://snotcoin.online/?embed=true',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Preload Farcaster SDK */}
        <script 
          src="https://cdn.farcaster.xyz/sdk/v0.0.31/farcaster.js" 
          async 
          defer
        />
      </head>
      <body className={inter.className}>
        <GameProvider>
          <TranslationProvider>
            <main className="min-h-screen flex flex-col">
              {children}
            </main>
          </TranslationProvider>
        </GameProvider>
      </body>
    </html>
  )
}