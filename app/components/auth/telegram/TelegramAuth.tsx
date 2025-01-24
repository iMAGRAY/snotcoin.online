import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import WebApp from "@twa-dev/sdk"
import { useGameDispatch } from "../../../contexts/GameContext"
import Image from "next/image"

interface UserData {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

interface TelegramAuthProps {
  onAuthenticate: (userData: UserData) => void
}

const TelegramAuth: React.FC<TelegramAuthProps> = ({ onAuthenticate }) => {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const dispatch = useGameDispatch()

  const handleTelegramAuth = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (!WebApp.initDataUnsafe || !WebApp.initDataUnsafe.user) {
        throw new Error("Telegram WebApp data not available")
      }

      const userData: UserData = {
        id: WebApp.initDataUnsafe.user.id,
        first_name: WebApp.initDataUnsafe.user.first_name,
        last_name: WebApp.initDataUnsafe.user.last_name,
        username: WebApp.initDataUnsafe.user.username,
        photo_url: WebApp.initDataUnsafe.user.photo_url,
        auth_date: WebApp.initDataUnsafe.auth_date,
        hash: WebApp.initDataUnsafe.hash,
      }

      dispatch({ type: "SET_USER", payload: { ...userData, id: userData.id.toString() } })
      onAuthenticate(userData)
    } catch (error) {
      console.error("Telegram auth error:", error)
      setError("Authentication failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }, [dispatch, onAuthenticate])

  return (
    <div>
      <motion.button
        onClick={handleTelegramAuth}
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white py-3 px-4 rounded-xl hover:from-blue-600 hover:to-blue-800 transition-all duration-300 flex items-center justify-center space-x-3 group relative overflow-hidden shadow-lg border border-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Telegram-pdBpQiBQsYiOchnK3AhwVMiKqqtdyk.webp"
          alt="Telegram"
          width={24}
          height={24}
          className="rounded"
        />
        <span className="font-semibold">{isLoading ? "Loading..." : "Login with Telegram"}</span>
      </motion.button>
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
  )
}

export default TelegramAuth

