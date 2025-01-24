import type React from "react"
import { GAME_CONSTANTS } from "../../../../types/fusion-game"

interface GameWallsProps {
  scaleFactor: number
}

const GameWalls: React.FC<GameWallsProps> = ({ scaleFactor }) => {
  return (
    <>
      {/* Left Wall */}
      <div
        className="absolute left-0 top-0 h-full z-10 pointer-events-none"
        style={{
          backgroundImage:
            "url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Left%20Wall-xQQu8Lo6ZZOGThWBIUXSF81gzBvfx9.webp')",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          width: `${GAME_CONSTANTS.WALL_WIDTH * scaleFactor}px`,
          left: 0,
        }}
      />

      {/* Right Wall */}
      <div
        className="absolute right-0 top-0 h-full z-10 pointer-events-none"
        style={{
          backgroundImage:
            "url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Right%20Wall-RApvf9XyobJ5u7wl6tQWfXriqU8FtV.webp')",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          width: `${GAME_CONSTANTS.WALL_WIDTH * scaleFactor}px`,
          right: 0,
        }}
      />
    </>
  )
}

export default GameWalls

