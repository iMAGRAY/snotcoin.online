import type React from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import { RefreshCw, Zap, ArrowDownCircle } from "lucide-react"
import { useTranslation } from "../../../contexts/TranslationContext"
import { useGameState, useGameDispatch } from "../../../contexts/GameContext"
import { formatSnotValue } from "../../../utils/gameUtils"

interface WalletBarProps {
  setActiveSection: (section: string | null) => void
}

const WalletBar: React.FC<WalletBarProps> = ({ setActiveSection }) => {
  const { t } = useTranslation()
  const gameState = useGameState()
  const gameDispatch = useGameDispatch()
  const ethBalance = 0 // Added to handle the removal of useWallet

  return (
    <motion.div
      className="mt-4 bg-gradient-to-br from-[#3a5c82]/90 to-[#4a7a9e]/90 rounded-xl p-5 shadow-lg border border-[#5889ae]/50 backdrop-blur-sm relative overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[#1a2b3d]/30 pointer-events-none" />
      <h3 className="text-lg font-bold text-white mb-2 relative z-10 inline-block">Wallet</h3>
      <motion.button
        onClick={() => {
          //getEthBalance is removed because useWallet is removed.  This section needs to be updated based on how you want to handle ETH balance updates without useWallet.
        }}
        className="absolute top-3 right-3 bg-gradient-to-r from-[#4a7a9e] to-[#5889ae] text-white p-2 rounded-full transition-colors shadow-md hover:from-[#5889ae] hover:to-[#6899be]"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <RefreshCw size={18} />
      </motion.button>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-[#2a3b4d]/70 rounded-lg p-3 flex justify-between items-center shadow-inner">
          <div className="flex items-center">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Ethereum-QViFDhOKalXUOAnEWs5bdKcdknmDIP.webp"
              alt="ETH"
              width={24}
              height={24}
            />
          </div>
          <p className="text-[#6899be] text-sm font-bold">{ethBalance} ETH</p>
        </div>
        <div className="bg-[#2a3b4d]/70 rounded-lg p-3 flex justify-between items-center shadow-inner">
          <div className="flex items-center">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Coin-a2GBTJ75mu1bwG6EaCihxvYEXwcpvy.webp"
              alt="SnotCoin"
              width={24}
              height={24}
            />
          </div>
          <p className="text-[#bbeb25] text-sm font-bold">{formatSnotValue(gameState.inventory?.snotCoins || 0)} SC</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          onClick={() => setActiveSection("deposit")}
          className="bg-gradient-to-r from-[#4a7a9e] to-[#5889ae] text-white font-bold py-2 px-3 rounded-lg shadow-md hover:from-[#5889ae] hover:to-[#6899be] transition-all duration-300 flex items-center justify-center text-sm"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Zap size={16} className="mr-1" />
          {t("Deposit")}
        </motion.button>
        <motion.button
          onClick={() => setActiveSection("withdraw")}
          className="bg-gradient-to-r from-[#4a7a9e] to-[#5889ae] text-white font-bold py-2 px-3 rounded-lg shadow-md hover:from-[#5889ae] hover:to-[#6899be] transition-all duration-300 flex items-center justify-center text-sm"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <ArrowDownCircle size={16} className="mr-1" />
          {t("Withdraw")}
        </motion.button>
      </div>
    </motion.div>
  )
}

WalletBar.displayName = "WalletBar"

export default WalletBar

