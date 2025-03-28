"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { useTranslation } from "../../../../i18n"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog"

const SettingsModal: React.FC = () => {
  const { t } = useTranslation()

  return (
    <Dialog defaultOpen>
      <DialogContent className="bg-gray-800 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-[#6899be] text-xl font-bold">
            {t("settingsTitle") || "Account Settings"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {t("settingsDescription") || "Manage your account settings and preferences"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
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
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SettingsModal

