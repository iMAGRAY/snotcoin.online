import { useState, useEffect, useCallback, useRef } from "react"
import { motion } from "framer-motion"
import WebApp from "@twa-dev/sdk"
import { useGameDispatch } from "../../../contexts/GameContext"
import { validateTelegramAuth } from "../../../utils/validation"
import Image from "next/image"

interface UserData {
  id: number
  first_name: string
  last_name?: string
  username?: string
}

interface TelegramAuthProps {
  onAuthenticate: (userData: UserData) => void
}

const VALIDATION_INTERVAL = 5 * 60 * 1000 // 5 minutes
const MAX_RETRIES = 3
const RETRY_DELAY = 5000 // 5 seconds

const TelegramAuth: React.FC<TelegramAuthProps> = ({ onAuthenticate }) => {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isWebAppReady, setIsWebAppReady] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const validationIntervalRef = useRef<NodeJS.Timeout>()
  const dispatch = useGameDispatch()

  const handleValidationError = useCallback(
    (error: string) => {
      console.error("Validation error:", error)
      setError(error)

      if (retryCount < MAX_RETRIES) {
        setTimeout(() => {
          setRetryCount((prev) => prev + 1)
          validateAuth()
        }, RETRY_DELAY)
      } else {
        // Reset authentication state
        localStorage.removeItem("isAuthenticated")
        dispatch({ type: "SET_USER", payload: null })
        window.location.reload() // Force re-authentication
      }
    },
    [retryCount, dispatch],
  )

  const validateAuth = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const result = await validateTelegramAuth()

    console.log("Validation result:", result)

    if (result.success && result.data?.user) {
      dispatch({ type: "SET_USER", payload: result.data.user })
      localStorage.setItem("isAuthenticated", "true")
      localStorage.setItem("lastValidation", Date.now().toString())
      setRetryCount(0) // Reset retry count on successful validation
    } else {
      handleValidationError(result.error || "Validation failed")
    }

    setIsLoading(false)
  }, [dispatch, handleValidationError])

  // Initial WebApp ready check
  useEffect(() => {
    const checkWebAppReady = () => {
      if (WebApp.initData) {
        setIsWebAppReady(true)
      } else {
        setTimeout(checkWebAppReady, 100)
      }
    }
    checkWebAppReady()
  }, [])

  // Setup periodic validation
  useEffect(() => {
    if (isWebAppReady) {
      // Validate on mount
      validateAuth()

      // Setup interval for periodic validation
      validationIntervalRef.current = setInterval(validateAuth, VALIDATION_INTERVAL)

      return () => {
        if (validationIntervalRef.current) {
          clearInterval(validationIntervalRef.current)
        }
      }
    }
  }, [isWebAppReady, validateAuth])

  // Check last validation time on focus
  useEffect(() => {
    const handleFocus = () => {
      const lastValidation = localStorage.getItem("lastValidation")
      if (lastValidation) {
        const timeSinceLastValidation = Date.now() - Number.parseInt(lastValidation)
        if (timeSinceLastValidation > VALIDATION_INTERVAL) {
          validateAuth()
        }
      }
    }

    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [validateAuth])

  const handleTelegramAuth = async () => {
    setIsLoading(true)
    setError(null)

    const result = await validateTelegramAuth()

    console.log("Telegram auth result:", result)

    if (result.success && result.data?.user) {
      onAuthenticate(result.data.user)
    } else {
      setError(result.error || "Authentication failed")
    }

    setIsLoading(false)
  }

  return (
    <div>
      <motion.button
        onClick={handleTelegramAuth}
        disabled={!isWebAppReady || isLoading}
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

