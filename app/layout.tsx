import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { GameProvider } from "./contexts/GameContext"
import { TranslationProvider } from "./contexts/TranslationContext"
import { TelegramWebAppProvider } from "./contexts/TelegramWebAppContext"
import { FarcasterProvider } from "./contexts/FarcasterContext"
import Header from './components/Header'

const inter = Inter({ subsets: ["latin", "cyrillic"] })

// Базовый URL приложения (из переменных окружения или хардкод для продакшена)
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://snotcoin.online';
const imageUrl = `${siteUrl}/images/auth/authentication.webp`;

export const metadata: Metadata = {
  title: "SnotCoin Mining Game",
  description: "A Telegram-based crypto mining game",
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
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta http-equiv="Content-Security-Policy" content="frame-ancestors 'self' https://warpcast.com https://*.warpcast.com" />
      </head>
      <body className={inter.className}>
        <FarcasterProvider>
          <Header />
          <GameProvider>
            <TranslationProvider>
              <TelegramWebAppProvider>
                <div className="pt-16">
                  {children}
                </div>
              </TelegramWebAppProvider>
            </TranslationProvider>
          </GameProvider>
        </FarcasterProvider>
      </body>
    </html>
  )
}