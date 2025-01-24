import React, { useCallback, useMemo } from "react"
import { GAME_CONSTANTS } from "../../../../types/fusion-game"

interface FooterProps {
  scaleFactor: number
  currentSnot: number
}

const Footer: React.FC<FooterProps> = React.memo(({ scaleFactor }) => {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2"
      style={{
        backgroundImage:
          "url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Footer-7cjNK4wNIL9Na401dRrAD83I6g8Aer.webp')",
        backgroundSize: "auto 100%",
        backgroundPosition: "center",
        backgroundRepeat: "repeat-x",
        height: `${GAME_CONSTANTS.FOOTER_HEIGHT * scaleFactor}px`,
      }}
    >
      {/* Footer content can be added here if needed */}
    </div>
  )
})

Footer.displayName = "Footer"

export default Footer

