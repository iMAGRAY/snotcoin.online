import type React from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { useTranslation } from "../../contexts/TranslationContext"
import TelegramAuth from "./telegram/TelegramAuth"
import WarpCastAuth from "./warpcast/WarpCastAuth"
import { User2 } from "lucide-react"
import { saveUserToLocalStorage } from "../../utils/localStorage"
import { useAuth } from "../../contexts/AuthContext" // Import useAuth
import { useState } from "react"

interface AuthenticationWindowProps {
  onAuthenticate: (userData?: any, token?: string) => void
}

const AuthenticationWindow: React.FC<AuthenticationWindowProps> = ({ onAuthenticate }) => {
  const { t } = useTranslation()
  const { login } = useAuth() // Destructure login from useAuth
  const [showGuestWarning, setShowGuestWarning] = useState(false) // Added state for guest warning

  const handleTelegramAuth = (userData: any) => {
    console.log("Received user data in AuthenticationWindow:", userData)
    const token = generateAuthToken(userData)
    localStorage.setItem("authToken", token)
    login(userData) // Use the login function from useAuth
    onAuthenticate(userData, token)
  }

  const handleGuestLogin = () => {
    setShowGuestWarning(true) // Show guest warning modal
  }

  const confirmGuestLogin = () => {
    const guestData = {
      id: `guest_${Date.now()}`,
      first_name: "Guest",
      last_name: "",
      username: `guest_${Date.now()}`,
    }
    const token = generateAuthToken(guestData)
    localStorage.setItem("authToken", token)
    login(guestData)
    onAuthenticate(guestData, token)
  }

  const generateAuthToken = (userData: any): string => {
    // В реальном приложении здесь должна быть более сложная логика генерации токена
    return btoa(JSON.stringify(userData))
  }

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

          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            onClick={() => onAuthenticate()}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-800 text-white py-3 px-4 rounded-xl hover:from-purple-700 hover:to-purple-900 transition-all duration-300 flex items-center justify-center space-x-3 group relative overflow-hidden shadow-lg border border-purple-500/20"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/WarpCast-gjJEPUnVzcjWczmvHd13DykUt7Gmvn.webp"
              alt="WarpCast"
              width={24}
              height={24}
              className="rounded"
            />
            <span className="font-semibold">{t("loginWithWarpCast")}</span>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            onClick={handleGuestLogin}
            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-800 text-white py-3 px-4 rounded-xl hover:from-emerald-700 hover:to-emerald-900 transition-all duration-300 flex items-center justify-center space-x-3 group relative overflow-hidden shadow-lg border border-emerald-500/20"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <User2 className="w-6 h-6" />
            <span className="font-semibold">{t("loginAsGuest")}</span>
          </motion.button>
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
      {showGuestWarning && ( // Added modal for guest login warning
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div className="bg-gradient-to-br from-gray-800/95 to-gray-900/95 p-6 rounded-xl max-w-sm w-full mx-4 border border-gray-700 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">{t("guestLoginWarning")}</h3>
            <p className="text-gray-300 mb-6">{t("guestLoginWarningMessage")}</p>
            <div className="flex justify-end space-x-4">
              <motion.button
                onClick={() => setShowGuestWarning(false)}
                className="px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-md border border-gray-400"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {t("cancel")}
              </motion.button>
              <motion.button
                onClick={confirmGuestLogin}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 shadow-md border border-emerald-400"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {t("continue")}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

export default AuthenticationWindow

