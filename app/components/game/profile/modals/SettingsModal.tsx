import type React from "react"
import { useState } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "../../../../contexts/TranslationContext"
// import { useWallet } from '../../../../contexts/GameContext';
import { Eye, EyeOff } from "lucide-react"

const SettingsModal: React.FC = () => {
  const { t } = useTranslation()
  const { wallet } = { wallet: null } // Dummy wallet implementation
  const [showSeedPhrase, setShowSeedPhrase] = useState(false)

  const toggleSeedPhrase = () => {
    setShowSeedPhrase(!showSeedPhrase)
  }

  return (
    <motion.div className="text-white space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h4 className="font-bold text-xl mb-3 text-[#6899be]">Account Settings</h4>
        <ul className="space-y-2">
          {[
            { label: "Change Password", action: "Edit" },
            { label: "Link Social Accounts", action: "Manage" },
          ].map((item, index) => (
            <motion.li
              key={item.label}
              className="flex justify-between items-center bg-gray-700/50 rounded-lg p-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
            >
              <span className="text-gray-300">{item.label}</span>
              <button className="px-2 py-1 bg-[#4a7a9e] text-white text-sm rounded hover:bg-[#5889ae] transition-colors">
                {item.action}
              </button>
            </motion.li>
          ))}
        </ul>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <h4 className="font-bold text-xl mb-3 text-[#6899be]">Wallet</h4>
        <div className="bg-gray-700/50 rounded-lg p-4">
          <p className="text-gray-300 mb-2">Wallet Address:</p>
          <p className="text-yellow-400 break-all">{wallet?.address || "No wallet generated"}</p>
          <div className="mt-4">
            <button
              onClick={toggleSeedPhrase}
              className="flex items-center justify-center w-full px-4 py-2 bg-yellow-500 text-gray-900 rounded-lg font-bold hover:bg-yellow-600 transition-colors"
            >
              {showSeedPhrase ? <EyeOff className="mr-2" /> : <Eye className="mr-2" />}
              {showSeedPhrase ? "Hide Seed Phrase" : "Show Seed Phrase"}
            </button>
          </div>
          {showSeedPhrase && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-gray-800 rounded-lg"
            >
              <p className="text-yellow-400 break-all">{wallet?.seedPhrase || "No seed phrase available"}</p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default SettingsModal

