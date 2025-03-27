import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { TranslationProvider } from "./i18n"
import { FarcasterProvider } from "./contexts/FarcasterContext"
import { GameProvider } from "./contexts/game/providers/GameProvider"

const inter = Inter({ subsets: ["latin"] })

// Open Graph данные
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://snotcoin.online';
const imageUrl = `${siteUrl}/images/auth/authentication.webp`;

export const metadata: Metadata = {
  title: "Snotcoin",
  description: "PLAY 2 SNOT",
  openGraph: {
    type: 'website',
    url: siteUrl,
    title: 'Snotcoin - Фарми, зарабатывай, выводи!',
    description: 'Присоединяйся к экосистеме Snotcoin в Farcaster прямо сейчас!',
    images: [
      {
        url: imageUrl,
        width: 1200,
        height: 630,
        alt: 'Snotcoin Logo',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Snotcoin - Фарми, зарабатывай, выводи!',
    description: 'Присоединяйся к экосистеме Snotcoin в Farcaster прямо сейчас!',
    images: [imageUrl],
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* CSP frame-ancestors директива перенесена в HTTP заголовки */}
        <meta httpEquiv="Content-Security-Policy" content="frame-ancestors 'self' https://*.warpcast.com https://*.farcaster.xyz https://fc-polls.com https://www.yup.io;" />
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