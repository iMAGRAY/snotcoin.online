import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "./providers"
// import Script from "next/script";

// Используем системные шрифты вместо локальных или Google шрифтов
const fontClass = "font-sans"; // Tailwind CSS класс для sans-serif шрифтов

// Open Graph данные
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://snotcoin.online';
const imageUrl = `${siteUrl}/images/auth/authentication.webp`;

export const metadata: Metadata = {
  title: "Snotcoin",
  description: "PLAY 2 SNOT",
  icons: {
    icon: [
      { url: '/favicon/favicon.png', type: 'image/png' },
    ],
    shortcut: '/favicon/favicon.png',
    apple: '/favicon/favicon.png',
  },
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
        {/* CSP директивы устанавливаются через HTTP заголовки в middleware */}
      </head>
      <body className={fontClass}>
        <Providers>
          {children}
        </Providers>
        {/* Удалили подключение JS файла, который мог вызывать ошибку */}
      </body>
    </html>
  )
}