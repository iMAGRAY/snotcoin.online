"use client"

import React, { useCallback, useEffect } from "react"
import Image from "next/image"
import { useTranslation } from "../../i18n"
import { useGameDispatch } from "../../contexts/game/hooks"
import { MotionDiv } from "../motion/MotionWrapper"
import { ICONS } from "../../constants/uiConstants"
import { AuthLogType, AuthStep, logAuth, logAuthInfo, setUserId } from "../../utils/auth-logger"
import { useFarcaster } from "../../contexts/FarcasterContext"
import { authService } from "../../services/auth/authService"
import WarpcastAuth from "./WarpcastAuth"

interface AuthenticationWindowProps {
  onAuthenticate: (userData: any) => void
}

const AuthenticationWindow: React.FC<AuthenticationWindowProps> = ({ onAuthenticate }) => {
  const { t } = useTranslation()
  const gameDispatch = useGameDispatch()
  const { isAuthenticated } = useFarcaster()

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
          AuthStep.AUTH_COMPLETE,
          AuthLogType.ERROR,
          'Авторизация не удалась: получены пустые данные пользователя'
        );
        return;
      }
      
      logAuth(
        AuthStep.AUTH_COMPLETE, 
        AuthLogType.INFO, 
        'Авторизация успешна, обновление состояния игры', 
        { userId: userData?.user?.id, farcasterId: userData?.user?.fid }
      );
      
      // Проверяем, не был ли пользователь уже аутентифицирован
      if (authService.isAuthenticated()) {
        logAuth(
          AuthStep.AUTH_COMPLETE, 
          AuthLogType.WARNING, 
          'Повторная попытка аутентификации игнорирована, пользователь уже аутентифицирован'
        );
        return;
      }
      
      // Сохраняем идентификатор пользователя в системе логирования
      if (userData?.user?.id) {
        setUserId(userData.user.id);
      }
      
      // Update game state
      gameDispatch({ type: "SET_USER", payload: userData })
      
      // Явно устанавливаем laboratory как активную вкладку перед вызовом onAuthenticate
      // для гарантии правильного начального состояния
      gameDispatch({ type: "SET_ACTIVE_TAB", payload: "laboratory" })
      
      if (onAuthenticate) {
        try {
          onAuthenticate(userData)
        } catch (error) {
          console.error('[AuthenticationWindow] Ошибка в обработчике onAuthenticate:', error);
          logAuth(
            AuthStep.AUTH_COMPLETE,
            AuthLogType.ERROR,
            'Ошибка при вызове обработчика onAuthenticate',
            { error: error instanceof Error ? error.message : String(error) }
          );
        }
      }
    },
    [gameDispatch, onAuthenticate]
  )

  const handleAuthError = (error: string) => {
    logAuth(
      AuthStep.AUTH_ERROR,
      AuthLogType.ERROR,
      'Ошибка авторизации через Farcaster',
      { error }
    );
  }

  // Предотвращаем монтирование компонента авторизации, если пользователь уже аутентифицирован
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0">
        <Image
          src={ICONS.AUTH.BACKGROUND}
          alt="Authentication Background"
          fill
          style={{ objectFit: "cover" }}
          quality={100}
          priority
          className="opacity-75"
        />
      </div>
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

