import type React from "react"
import Image from "next/image"
import { useGameState } from "../contexts/GameContext"

const UserProfile: React.FC = () => {
  const { user, theme } = useGameState()

  if (!user) {
    return null
  }

  return (
    <div
      style={{ backgroundColor: theme.backgroundColor, color: theme.textColor }}
      className="p-4 rounded-lg shadow-md"
    >
      <h2 className="text-2xl font-bold mb-4">User Profile</h2>
      {user.photo_url && (
        <div className="mb-4">
          <Image
            src={user.photo_url || "/placeholder.svg"}
            alt={`${user.first_name}'s profile`}
            width={100}
            height={100}
            className="rounded-full"
          />
        </div>
      )}
      <p className="mb-2">
        <strong>Name:</strong> {user.first_name} {user.last_name}
      </p>
      <p className="mb-2">
        <strong>Username:</strong> {user.username || "N/A"}
      </p>
      <p className="mb-2">
        <strong>Language:</strong> {user.language_code || "N/A"}
      </p>
      <p className="mb-2">
        <strong>Telegram ID:</strong> {user.telegram_id}
      </p>
    </div>
  )
}

export default UserProfile

