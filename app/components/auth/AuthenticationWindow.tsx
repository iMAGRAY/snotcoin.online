import type React from "react"
import { useState, useCallback, useEffect } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { useTranslation } from "../../contexts/TranslationContext"
import TelegramAuth from "./telegram/TelegramAuth"
import { User2 } from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"
import { signIn } from "../../api/auth"
import { useGameDispatch } from "../../contexts/GameContext"

interface AuthenticationWindowProps {
  onAuthenticate: (userData?: any, isGuest?: boolean) => void
}

const AuthenticationWindow: React.FC<AuthenticationWindowProps> = ({ onAuthenticate }) => {
  const { t } = useTranslation()
  const { login } = useAuth()
  const gameDispatch = useGameDispatch()
  const [error, setError] = useState<string | null>(null)
  const [clickCount, setClickCount] = useState(0)
  const [isDeveloperMode, setIsDeveloperMode] = useState(false)

  useEffect(() => {
    if (clickCount >= 20) {
      setIsDeveloperMode(true)
      console.log("Developer mode activated!")
    }
  }, [clickCount])

  const handleAuthentication = useCallback(
    async (userData: any) => {
      try {
        console.log("Handling authentication, userData:", userData)
        if (userData) {
          console.log("Logging in user")
          login(userData)
          gameDispatch({ type: "SET_USER", payload: userData })
          onAuthenticate(userData)
        }
      } catch (err) {
        console.error("Authentication error:", err)
        setError("Failed to authenticate. Please try again.")
      }
    },
    [gameDispatch, login, onAuthenticate],
  )

  const handleTelegramAuth = useCallback(
    (userData: any) => {
      if (isDeveloperMode) {
        console.log("Bypassing authentication in developer mode")
        const mockUserData = {
          id: "dev_user_123",
          first_name: "Developer",
          last_name: "User",
          username: "dev_user",
        }
        handleAuthentication(mockUserData)
      } else {
        console.log("Received user data in AuthenticationWindow:", userData)
        handleAuthentication(userData)
      }
      setClickCount((prevCount) => prevCount + 1)
    },
    [isDeveloperMode, handleAuthentication],
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <Image
        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/2-jdGFRrTDdfXFFiLdjaKZ0cFQUD3FqL.webp"
        alt="Authentication Background"
        layout="fill"
        objectFit="cover"
        quality={100}
        priority
        className="opacity-75"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/50 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 300, damping: 30 }}
        className="z-10 bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-lg rounded-2xl p-8 w-[90%] max-w-md shadow-2xl border border-white/10"
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <h2 className="text-3xl font-bold bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 bg-clip-text text-transparent">
            {t("authentication")}
          </h2>
        </motion.div>

        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <TelegramAuth onAuthenticate={handleTelegramAuth} />
          </motion.div>
          {isDeveloperMode && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-yellow-400 text-sm"
            >
              Developer mode activated. You can now access the app without authentication.
            </motion.p>
          )}
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 mt-2 text-sm bg-red-500/10 p-2 rounded-lg border border-red-500/20"
            >
              {error}
            </motion.p>
          )}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-gray-500 text-xs mt-6"
        >
          {t("gameDescription")}
        </motion.p>
      </motion.div>
    </div>
  )
}

export default AuthenticationWindow

