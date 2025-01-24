import type React from "react"
import { motion } from "framer-motion"
import { RefreshCw, Home } from "lucide-react"
import { useTranslation } from "../../../../contexts/TranslationContext"

interface GameOverMenuProps {
  finalScore: number
  earnedSnot: number
  handleRestart: () => void
  handleHome: () => void
  gamesAvailable: number
}

const GameOverMenu: React.FC<GameOverMenuProps> = ({
  finalScore,
  earnedSnot,
  handleRestart,
  handleHome,
  gamesAvailable,
}) => {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 flex flex-col items-center space-y-6 w-4/5 max-w-md shadow-lg border-4 border-yellow-500/30"
      >
        <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
          {t("gameOver")}
        </h2>
        <div className="text-center space-y-2">
          <p className="text-white text-2xl">
            {t("score")}: {finalScore}
          </p>
          <p className="text-white text-2xl">
            {t("snotEarned")}: {earnedSnot}
          </p>
          <p className="text-white text-xl">
            {t("gamesAvailable")}: {gamesAvailable}
          </p>
        </div>
        {[
          { text: t("restart"), icon: RefreshCw, onClick: handleRestart, color: "from-blue-500 to-blue-600" },
          { text: t("home"), icon: Home, onClick: handleHome, color: "from-red-500 to-red-600" },
        ].map((button, index) => (
          <motion.button
            key={index}
            onClick={button.onClick}
            className={`w-full flex items-center justify-center space-x-3 bg-gradient-to-r ${button.color} text-white text-xl font-bold py-4 px-6 rounded-full transition duration-200 hover:opacity-90 active:scale-95 shadow-md border-2 border-white/20`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <button.icon size={24} />
            <span>{button.text}</span>
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  )
}

export default GameOverMenu

