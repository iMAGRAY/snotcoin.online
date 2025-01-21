import type React from "react"
import { useState } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "../../../../contexts/TranslationContext"
import { useGameState, useGameDispatch } from "../../../../contexts/GameContext"
import { formatSnotValue } from "../../../../utils/gameUtils"
import { Wallet, AlertCircle } from "lucide-react"

type WithdrawModalProps = {}

const WithdrawModal: React.FC<WithdrawModalProps> = () => {
  const { t } = useTranslation()
  const gameState = useGameState()
  const [selectedCurrency, setSelectedCurrency] = useState<"ETH" | "SnotCoin">("ETH")
  const [amount, setAmount] = useState<string>("")
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const { wallet, generateWallet, getEthBalance } = {
    wallet: null,
    generateWallet: async () => {},
    getEthBalance: async () => {},
  }

  const handleCurrencyChange = (currency: "ETH" | "SnotCoin") => {
    setSelectedCurrency(currency)
    setAmount("")
    setError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!amount || isNaN(Number.parseFloat(amount))) {
      setError(t("invalidAmount"))
      return
    }
    if (!walletAddress) {
      setError(t("invalidWalletAddress"))
      return
    }
    // Here you would typically handle the withdrawal process
    console.log(`Withdrawing ${amount} ${selectedCurrency} to ${walletAddress}`)
  }

  return (
    <motion.div
      className="bg-gradient-to-br from-[#3a5c82]/80 to-[#4a7a9e]/80 rounded-xl p-4 shadow-lg border border-[#5889ae]/50 backdrop-blur-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex space-x-2">
          {["ETH", "SnotCoin"].map((currency) => (
            <motion.button
              key={currency}
              type="button"
              className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm shadow-lg ${
                selectedCurrency === currency
                  ? "bg-gradient-to-r from-blue-500 to-emerald-500 text-white"
                  : "bg-[#2a3b4d] text-gray-300 hover:bg-[#3a5c82] transition-colors"
              }`}
              onClick={() => handleCurrencyChange(currency as "ETH" | "SnotCoin")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {currency}
            </motion.button>
          ))}
        </div>

        <div className="space-y-1">
          <label htmlFor="amount" className="block text-xs font-medium text-gray-300">
            {t("amount")}
          </label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-[#2a3b4d] rounded-lg py-2 px-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition duration-200 text-sm"
            placeholder={`Enter ${selectedCurrency} amount`}
            required
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="walletAddress" className="block text-xs font-medium text-gray-300">
            {t("walletAddress")}
          </label>
          <input
            type="text"
            id="walletAddress"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            className="w-full bg-[#2a3b4d] rounded-lg py-2 px-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition duration-200 text-sm"
            placeholder="Enter wallet address"
            required
          />
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-500 text-xs mt-2 flex items-center"
          >
            <AlertCircle className="w-3 h-3 mr-1" />
            {error}
          </motion.p>
        )}

        <motion.button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg flex items-center justify-center space-x-2 text-sm hover:from-blue-600 hover:to-emerald-600 transition-colors"
          whileHover={{ scale: 1.02, boxShadow: "0 0 15px rgba(255,255,255,0.3)" }}
          whileTap={{ scale: 0.98 }}
        >
          <Wallet className="w-4 h-4" />
          <span>{t("Withdraw")}</span>
        </motion.button>
      </form>

      <div className="text-center text-xs text-gray-400">
        <p>{t("availableBalance")}:</p>
        <p className="font-bold text-[#bbeb25]">
          {selectedCurrency === "ETH"
            ? `${gameState.ethBalance} ETH`
            : `${formatSnotValue(gameState.inventory.snotCoins)} SnotCoins`}
        </p>
      </div>
    </motion.div>
  )
}

WithdrawModal.displayName = "WithdrawModal"

export default WithdrawModal

