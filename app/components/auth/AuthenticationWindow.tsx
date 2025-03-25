"use client"

import React, { useCallback, useEffect } from "react"
import Image from "next/image"
import { useTranslation } from "../../contexts/TranslationContext"
import { MotionDiv } from "../motion/MotionWrapper"
import { useGameDispatch } from "../../contexts/GameContext"
import { ICONS } from "../../constants/uiConstants"
import { AuthLogType, AuthStep, logAuth, logAuthInfo, setUserId } from "../../utils/auth-logger"
import WarpcastAuth from "./WarpcastAuth"
import NeynarAuth from "./NeynarAuth"

interface AuthenticationWindowProps {
  onAuthenticate: (userData: any) => void
}

// Хранилище для хранения данных аутентификации в памяти
export const authStore = {
  authToken: null as any,
  isAuthenticated: false,
  
  // Методы для работы с данными аутентификации
  setAuthData(token: any, isAuth: boolean) {
    this.authToken = token;
    this.isAuthenticated = isAuth;
    
    // Логирование сохранения токена
    logAuth(
      AuthStep.TOKEN_RECEIVED, 
      AuthLogType.INFO, 
      'Данные авторизации сохранены в хранилище', 
      { isAuthenticated: isAuth, hasToken: !!token, userId: token?.user?.id }
    );
    
    // Сохраняем идентификатор пользователя в системе логирования
    if (token?.user?.id) {
      setUserId(token.user.id);
    }
  },
  
  clearAuthData() {
    logAuthInfo(AuthStep.USER_INTERACTION, 'Очистка данных авторизации в хранилище');
    this.authToken = null;
    this.isAuthenticated = false;
  },
  
  getAuthToken() {
    return this.authToken;
  },
  
  getIsAuthenticated() {
    return this.isAuthenticated;
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
      if (userData) {
        logAuth(
          AuthStep.AUTH_COMPLETE, 
          AuthLogType.INFO, 
          'Авторизация успешна, обновление состояния игры', 
          { userId: userData?.user?.id, farcasterId: userData?.user?.fid }
        );
        
        // Проверяем, не был ли пользователь уже аутентифицирован
        if (authStore.getIsAuthenticated()) {
          logAuth(
            AuthStep.AUTH_COMPLETE, 
            AuthLogType.WARNING, 
            'Повторная попытка аутентификации игнорирована, пользователь уже аутентифицирован'
          );
          return;
        }
        
        // Save user data
        authStore.setAuthData(userData, true)

        // Update game state
        gameDispatch({ type: "SET_USER", payload: userData })
        
        // Явно устанавливаем laboratory как активную вкладку перед вызовом onAuthenticate
        // для гарантии правильного начального состояния
        gameDispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" })

        // Логируем обновление игрового состояния
        logAuth(
          AuthStep.AUTH_COMPLETE, 
          AuthLogType.INFO, 
          'Игровое состояние обновлено, вызов колбэка завершения авторизации'
        );
        
        // Call the onAuthenticate callback после короткой задержки, чтобы убедиться,
        // что gameState успел обновиться
        setTimeout(() => {
          onAuthenticate(userData);
          logAuth(AuthStep.AUTH_COMPLETE, AuthLogType.INFO, 'Колбэк авторизации успешно выполнен');
        }, 10);
      } else {
        logAuth(
          AuthStep.AUTH_ERROR, 
          AuthLogType.ERROR, 
          'Попытка авторизации с пустыми данными пользователя'
        );
      }
    },
    [gameDispatch, onAuthenticate],
  )

  const handleAuthError = (error: string) => {
    logAuth(
      AuthStep.AUTH_ERROR,
      AuthLogType.ERROR,
      'Ошибка авторизации через Farcaster',
      { error }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <Image
        src={ICONS.AUTH.BACKGROUND}
        alt="Authentication Background"
        fill
        style={{ objectFit: "cover" }}
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
            <WarpcastAuth onSuccess={handleAuthentication} onError={handleAuthError} />
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

