import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

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
        {/* CSP директивы устанавливаются через HTTP заголовки в middleware */}
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}