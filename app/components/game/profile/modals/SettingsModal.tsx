"use client"

import React from "react"
import { motion } from "framer-motion"
import { useTranslation } from "../../../../contexts/TranslationContext"
import { X, LogOut } from "lucide-react"

interface SettingsModalProps {
  onClose: () => void;
  onLogout: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onLogout }) => {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gradient-to-br from-gray-800/95 to-gray-900/95 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto relative border border-yellow-500/20 shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.button
          className="absolute top-4 right-4 text-gray-400 hover:text-yellow-400 p-2 rounded-full bg-gray-700/50 hover:bg-gray-600/50 transition-colors border border-gray-600/50"
          onClick={onClose}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <X size={24} />
        </motion.button>

        <div className="pt-6 text-white space-y-6">
          <motion.h3 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold text-center text-white mb-6"
          >
            {t("settings")}
          </motion.h3>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h4 className="font-bold text-xl mb-3 text-[#6899be]">{t("account")}</h4>
            <ul className="space-y-2">
              {[
                { label: t("changePassword"), action: t("edit") },
                { label: t("linkSocialAccounts"), action: t("manage") },
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

          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.4 }}
            className="pt-4"
          >
            <motion.button
              onClick={onLogout}
              className="w-full bg-red-600/80 hover:bg-red-700 text-white py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center mt-6"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <LogOut className="w-5 h-5 mr-2" />
              <span>{t("logout")}</span>
            </motion.button>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default SettingsModal

