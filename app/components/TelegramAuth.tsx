import type React from "react"
import { useEffect, useState, useCallback } from "react"
import { useGameDispatch } from "../contexts/GameContext"
import { createNewUser, getUserByTelegramId } from "../utils/db"
import { parseInitDataUnsafe } from "../utils/telegramUtils"
import Image from "next/image"

const TelegramAuth: React.FC = () => {
  const [user, setUser] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const dispatch = useGameDispatch()

  const updateUserData = useCallback(
    async (telegramUser: any) => {
      try {
        let dbUser = await getUserByTelegramId(telegramUser.id)
        if (!dbUser) {
          dbUser = await createNewUser(telegramUser)
        } else {
          // compareAndUpdateUserData is removed here.  Logic needs to be handled differently if needed.
          dbUser = dbUser // Placeholder -  Consider alternative update logic if compareAndUpdateUserData was crucial.
        }
        dispatch({ type: "SET_USER", payload: dbUser })
        dispatch({
          type: "LOAD_GAME_STATE",
          payload: {
            inventory: dbUser.inventories,
            ...dbUser.game_progress,
            wallet: dbUser.wallets[0],
          },
        })
        localStorage.setItem("telegramUser", JSON.stringify(telegramUser))
      } catch (error) {
        console.error("Error updating user data:", error)
      }
    },
    [dispatch],
  )

  useEffect(() => {
    const initAuth = async () => {
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        try {
          const initDataUnsafe = window.Telegram.WebApp.initDataUnsafe
          console.log("InitData:", initDataUnsafe)
          const telegramUser = parseInitDataUnsafe(initDataUnsafe)

          setUser(telegramUser)
          await updateUserData(telegramUser)
        } catch (err) {
          setError("An error occurred during authentication")
          console.error(err)
        } finally {
          setIsLoading(false)
        }
      } else {
        setError("Telegram WebApp is not available")
        setIsLoading(false)
      }
    }

    initAuth()
  }, [updateUserData])

  if (isLoading) {
    return <div className="p-4 bg-gray-500/10 border border-gray-500/20 rounded-lg text-gray-400">Loading...</div>
  }

  if (error) {
    return <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">Error: {error}</div>
  }

  if (!user || !user.id) {
    return (
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-600">
        No valid user data available. Please open this app from Telegram.
      </div>
    )
  }

  return (
    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
      <h1 className="text-xl font-bold text-green-400 mb-2">Welcome, {user.first_name}!</h1>
      <p className="text-green-300">Your Telegram ID: {user.id}</p>
      {user.username && <p className="text-green-300">Username: @{user.username}</p>}
      {user.photo_url && (
        <Image
          src={user.photo_url || "/placeholder.svg"}
          alt="Profile"
          width={64}
          height={64}
          className="rounded-full mt-2"
        />
      )}
    </div>
  )
}

export default TelegramAuth

