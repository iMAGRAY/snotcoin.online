import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { GameProvider } from "./contexts/GameContext"
import { TranslationProvider } from "./contexts/TranslationContext"
import { TelegramWebAppProvider } from "./contexts/TelegramWebAppContext"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SnotCoin Mining Game",
  description: "A Telegram-based crypto mining game",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <GameProvider>
          <TranslationProvider>
            <TelegramWebAppProvider>
              {children}
            </TelegramWebAppProvider>
          </TranslationProvider>
        </GameProvider>
      </body>
    </html>
  )
}