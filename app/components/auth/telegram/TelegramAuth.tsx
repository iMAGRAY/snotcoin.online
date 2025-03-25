"use client"

import React, { useEffect, useState } from 'react';
import { TelegramAuthProps, AuthStatus } from '../../../types/telegramAuth';
import { useTelegramAuth } from '../../../hooks/useTelegramAuth';
import TelegramAuthLoader from './TelegramAuthLoader';
import TelegramAuthError from './TelegramAuthError';
import { AuthLogType, AuthStep, logAuth, logAuthError, logAuthInfo } from '../../../utils/auth-logger';

/**
 * Компонент для аутентификации через Telegram
 */
const TelegramAuth: React.FC<TelegramAuthProps> = ({ onAuthenticate }) => {
  // Используем хук для логики аутентификации
  const {
    user,
    status,
    isLoading,
    handleAuth,
    handleRetry,
    closeWebApp,
    openInTelegram,
    errorMessage
  } = useTelegramAuth(onAuthenticate);
  
  // Состояние для отслеживания попыток аутентификации
  const [authAttempts, setAuthAttempts] = useState<number>(0);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  
  // Выполняем аутентификацию при монтировании компонента
  useEffect(() => {
    logAuthInfo(AuthStep.INIT, 'Инициализация компонента TelegramAuth');
    
    const authenticate = async () => {
      logAuthInfo(AuthStep.TELEGRAM_INIT, 'Запуск процесса Telegram авторизации');
      
      try {
        setIsRetrying(true);
        
        // Пытаемся авторизовать пользователя через Telegram
        const result = await handleAuth();
        
        if (result) {
          logAuthInfo(AuthStep.AUTH_COMPLETE, 'Процесс авторизации завершен успешно');
        } else {
          logAuthError(
            AuthStep.AUTH_ERROR, 
            'Процесс авторизации завершен с ошибкой', 
            new Error(errorMessage || 'Неизвестная ошибка'),
            { status }
          );
          
          // Если авторизация не удалась, увеличиваем счетчик попыток
          setAuthAttempts(prev => prev + 1);
        }
      } catch (error) {
        logAuthError(
          AuthStep.AUTH_ERROR, 
          'Ошибка при авторизации через Telegram', 
          error,
          { status }
        );
        setAuthAttempts(prev => prev + 1);
      } finally {
        setIsRetrying(false);
      }
    };
    
    // Запускаем процесс авторизации
    authenticate();
    
    // Отписываемся при размонтировании
    return () => {
      logAuthInfo(AuthStep.USER_INTERACTION, 'Компонент TelegramAuth размонтирован');
    };
  }, [handleAuth, status, errorMessage]);
  
  // Обработчик повторной попытки авторизации
  const handleAuthRetry = async () => {
    logAuth(
      AuthStep.AUTH_RETRY, 
      AuthLogType.INFO, 
      'Попытка повторной авторизации', 
      { previousError: errorMessage, attempt: authAttempts + 1 }
    );
    
    setIsRetrying(true);
    setAuthAttempts(prev => prev + 1);
    
    try {
      const result = await handleAuth();
      if (result) {
        logAuthInfo(AuthStep.AUTH_COMPLETE, 'Повторная авторизация успешна');
      } else {
        logAuthError(
          AuthStep.AUTH_RETRY, 
          'Повторная авторизация завершилась с ошибкой', 
          new Error(errorMessage || 'Неизвестная ошибка')
        );
      }
    } catch (error) {
      logAuthError(
        AuthStep.AUTH_RETRY, 
        'Ошибка при повторной авторизации', 
        error
      );
    } finally {
      setIsRetrying(false);
    }
  };
  
  // Обработчик закрытия Telegram WebApp
  const handleCloseWebApp = () => {
    logAuth(
      AuthStep.USER_INTERACTION, 
      AuthLogType.INFO, 
      'Пользователь закрыл WebApp', 
      { status }
    );
    closeWebApp();
  };
  
  // Обработчик открытия в Telegram
  const handleOpenInTelegram = () => {
    logAuth(
      AuthStep.USER_INTERACTION, 
      AuthLogType.INFO, 
      'Пользователь выбрал открытие в Telegram', 
      { status }
    );
    openInTelegram();
  };
  
  // Отображаем загрузчик при загрузке
  if (isLoading || status === AuthStatus.LOADING || isRetrying) {
    logAuthInfo(AuthStep.USER_INTERACTION, 'Отображение загрузчика авторизации', { isRetrying, authAttempts });
    return <TelegramAuthLoader />;
  }
  
  // Отображаем компонент ошибки при ошибке
  if (status === AuthStatus.ERROR) {
    logAuthError(
      AuthStep.USER_INTERACTION, 
      'Отображение компонента ошибки авторизации', 
      errorMessage ? new Error(errorMessage) : undefined,
      { authAttempts }
    );
    
    return (
      <TelegramAuthError 
        errorMessage={errorMessage || undefined}
        onRetry={handleAuthRetry}
        onClose={handleCloseWebApp}
        onOpenInTelegram={handleOpenInTelegram}
        attemptCount={authAttempts}
      />
    );
  }
  
  // В случае успешной авторизации, возвращаем null (дочерние компоненты будут отрисованы родителем)
  logAuthInfo(AuthStep.AUTH_COMPLETE, 'Авторизация успешна, возвращаем null для продолжения');
  return null;
};

export default TelegramAuth;