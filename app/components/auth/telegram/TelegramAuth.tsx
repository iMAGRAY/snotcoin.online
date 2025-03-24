"use client"

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { TelegramAuthProps } from '../../../types/telegramAuth';
import { useTelegramAuth } from '../../../hooks/useTelegramAuth';

/**
 * Упрощенный компонент для аутентификации через Telegram
 */
const TelegramAuth: React.FC<TelegramAuthProps> = ({ onAuthenticate }) => {
  const [loading, setLoading] = useState(false);
  
  // Используем хук аутентификации
  const { handleAuth } = useTelegramAuth(onAuthenticate);
  
  // Автоматически аутентифицируем пользователя при монтировании
  useEffect(() => {
    const authenticate = async () => {
      setLoading(true);
      try {
        await handleAuth();
      } finally {
        setLoading(false);
      }
    };
    
    authenticate();
  }, [handleAuth]);
  
  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      await handleAuth();
    } finally {
      setLoading(false);
    }
  }, [handleAuth]);
  
  return (
    <motion.button
      onClick={handleClick}
      disabled={loading}
      className="w-full bg-gradient-to-r from-blue-500 to-blue-700 text-white py-3 px-4 rounded-xl hover:from-blue-600 hover:to-blue-800 transition-all duration-300 flex items-center justify-center space-x-3 group relative overflow-hidden shadow-lg border border-blue-500/20"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <Image
        src="https://telegram.org/img/t_logo.png"
        alt="Telegram"
        width={24}
        height={24}
        className="rounded"
      />
      <span className="font-semibold">
        {loading ? "Авторизация..." : "Войти через Telegram"}
      </span>
    </motion.button>
  );
};

export default TelegramAuth;