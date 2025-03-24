"use client"

import type React from "react"
import { useCallback, useEffect } from "react"
import Image from "next/image"
import { useTranslation } from "../../contexts/TranslationContext"
import TelegramAuth from "./telegram/TelegramAuth"
import { MotionDiv } from "../motion/MotionWrapper"
import { useGameDispatch } from "../../contexts/GameContext"
import { ICONS } from "../../constants/uiConstants"
import { AuthLogType, AuthStep, logAuth, logAuthInfo, setUserId } from "../../utils/auth-logger"

interface AuthenticationWindowProps {
  onAuthenticate: (userData: any) => void
}

// Хранилище для хранения данных аутентификации через localStorage
export const authStore = {
  // Методы для работы с данными аутентификации
  setAuthData(token: any, isAuth: boolean) {
    if (typeof window === 'undefined') return;
    
    // Сохраняем в localStorage
    localStorage.setItem('authToken', typeof token === 'string' ? token : JSON.stringify(token));
    localStorage.setItem('isAuthenticated', isAuth ? 'true' : 'false');
    
    // Логирование сохранения токена
    logAuth(
      AuthStep.TOKEN_RECEIVED, 
      AuthLogType.INFO, 
      'Данные авторизации сохранены в хранилище', 
      { isAuthenticated: isAuth, hasToken: !!token, userId: token?.user?.telegram_id }
    );
    
    // Сохраняем идентификатор пользователя в системе логирования
    if (token?.user?.telegram_id) {
      setUserId(token.user.telegram_id);
    }
  },
  
  clearAuthData() {
    if (typeof window === 'undefined') return;
    
    logAuthInfo(AuthStep.USER_INTERACTION, 'Очистка данных авторизации в хранилище');
    localStorage.removeItem('authToken');
    localStorage.removeItem('isAuthenticated');
  },
  
  getAuthToken() {
    if (typeof window === 'undefined') return null;
    
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    
    try {
      // Пытаемся распарсить JSON, если это возможно
      if (token.startsWith('{') || token.startsWith('[')) {
        return JSON.parse(token);
      }
      return token;
    } catch (e) {
      console.error('Ошибка при парсинге токена:', e);
      return token;
    }
  },
  
  getIsAuthenticated() {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('isAuthenticated') === 'true';
  }
};

const AuthenticationWindow: React.FC<AuthenticationWindowProps> = ({ onAuthenticate }) => {
  const { t } = useTranslation()
  const gameDispatch = useGameDispatch()

  // Логируем монтирование компонента
  useEffect(() => {
    logAuthInfo(AuthStep.INIT, 'Окно аутентификации инициализировано');
    
    return () => {
      logAuthInfo(AuthStep.USER_INTERACTION, 'Окно аутентификации размонтировано');
    };
  }, []);

  const handleAuthentication = useCallback(
    (userData: any) => {
      if (!userData) {
        logAuth(
          AuthStep.AUTH_ERROR, 
          AuthLogType.ERROR, 
          'Попытка авторизации с пустыми данными пользователя'
        );
        return;
      }
      
      logAuth(
        AuthStep.AUTH_COMPLETE, 
        AuthLogType.INFO, 
        'Авторизация успешна, обновление состояния игры', 
        { userId: userData?.user?.id, telegramId: userData?.user?.telegram_id }
      );
      
      // Save user data to localStorage
      authStore.setAuthData(userData, true);

      // Update game state
      gameDispatch({ type: "SET_USER", payload: userData });
      gameDispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" });

      // Notify parent component
      onAuthenticate(userData);
      
      logAuth(AuthStep.AUTH_COMPLETE, AuthLogType.INFO, 'Авторизация завершена успешно');
    },
    [gameDispatch, onAuthenticate],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <Image
        src={ICONS.AUTH.BACKGROUND}
        alt="Authentication Background"
        layout="fill"
        objectFit="cover"
        quality={100}
        priority
        className="opacity-75"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/50 backdrop-blur-sm" />

      <MotionDiv
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 300, damping: 30 }}
        className="z-10 bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-lg rounded-2xl p-8 w-[90%] max-w-md shadow-2xl border border-white/10"
      >
        <MotionDiv
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            {t("welcomeToSnotCoin")}
          </h2>
          <p className="text-gray-400 mt-2 text-sm">{t("authentication")}</p>
        </MotionDiv>

        <div className="space-y-6">
          <MotionDiv initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <TelegramAuth onAuthenticate={handleAuthentication} />
          </MotionDiv>
        </div>

        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-gray-500 text-xs mt-6"
        >
          {t("gameDescription")}
        </MotionDiv>
      </MotionDiv>
    </div>
  )
}

export default AuthenticationWindow

