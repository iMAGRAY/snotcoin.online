import type React from "react"

interface GameBackgroundProps {
  imageUrl: string
}

const GameBackground: React.FC<GameBackgroundProps> = ({ imageUrl }) => {
  return (
    <div
      className="absolute inset-0 z-0"
      style={{
        backgroundImage: `url('${imageUrl}')`,
        backgroundPosition: "center",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
      }}
    />
  )
}

export default GameBackground

