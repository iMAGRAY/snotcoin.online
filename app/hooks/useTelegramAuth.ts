import { useState, useCallback, useEffect } from 'react';
import { TelegramWebAppUser, AuthStatus } from '../types/telegramAuth';
import { logAuthInfo, logAuthError, AuthStep } from '../utils/auth-logger';

// Интерфейс возвращаемого значения хука
interface UseTelegramAuthReturn {
  user: TelegramWebAppUser | null;
  status: AuthStatus;
  isLoading: boolean;
  errorMessage: string | null;
  handleAuth: () => Promise<boolean>;
  handleRetry: () => Promise<boolean>;
  closeWebApp: () => void;
  openInTelegram: () => void;
}

/**
 * Хук для обработки аутентификации через Telegram
 */
export function useTelegramAuth(onAuthenticate: (userData: any) => void): UseTelegramAuthReturn {
  const [user, setUser] = useState<TelegramWebAppUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(AuthStatus.LOADING);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Функция для проверки наличия Telegram WebApp
  const checkTelegramWebApp = useCallback((): boolean => {
    if (typeof window !== 'undefined') {
      // @ts-ignore - глобальный объект из Telegram
      return !!window.Telegram?.WebApp;
    }
    return false;
  }, []);

  // Функция получения пользователя из Telegram WebApp
  const getTelegramUser = useCallback((): TelegramWebAppUser | null => {
    try {
      if (checkTelegramWebApp()) {
        // @ts-ignore
        const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
        
        if (tgUser) {
          logAuthInfo(AuthStep.TELEGRAM_WEB_APP_DATA, 'Получены данные пользователя из Telegram', {
            userId: tgUser.id,
            username: tgUser.username
          });
          return tgUser as TelegramWebAppUser;
        }
      }
      
      logAuthError(
        AuthStep.TELEGRAM_WEB_APP_DATA, 
        'Не удалось получить данные пользователя из Telegram',
        new Error('User data not available')
      );
      return null;
    } catch (error) {
      logAuthError(
        AuthStep.TELEGRAM_WEB_APP_DATA, 
        'Ошибка при получении данных пользователя из Telegram',
        error
      );
      return null;
    }
  }, [checkTelegramWebApp]);

  // Функция для обработки аутентификации
  const handleAuth = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      logAuthInfo(AuthStep.TELEGRAM_INIT, 'Начало процесса авторизации через Telegram');
      
      // Проверяем доступность Telegram WebApp
      if (!checkTelegramWebApp()) {
        setStatus(AuthStatus.ERROR);
        setErrorMessage('Telegram WebApp недоступен. Убедитесь, что вы открыли приложение через Telegram.');
        logAuthError(
          AuthStep.AUTH_ERROR, 
          'Telegram WebApp недоступен',
          new Error('Telegram WebApp not available')
        );
        return false;
      }
      
      // Получаем данные пользователя
      const telegramUser = getTelegramUser();
      
      if (!telegramUser) {
        setStatus(AuthStatus.ERROR);
        setErrorMessage('Не удалось получить данные пользователя Telegram');
        return false;
      }
      
      // Устанавливаем пользователя и статус
      setUser(telegramUser);
      setStatus(AuthStatus.AUTHENTICATED);
      
      // Вызываем коллбэк авторизации
      onAuthenticate({
        id: telegramUser.id,
        username: telegramUser.username || telegramUser.first_name,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        photoUrl: telegramUser.photo_url
      });
      
      logAuthInfo(AuthStep.TELEGRAM_SUCCESS, 'Авторизация через Telegram успешна', {
        userId: telegramUser.id,
        username: telegramUser.username
      });
      
      return true;
    } catch (error) {
      setStatus(AuthStatus.ERROR);
      setErrorMessage(error instanceof Error ? error.message : 'Неизвестная ошибка');
      
      logAuthError(
        AuthStep.AUTH_ERROR, 
        'Ошибка при авторизации через Telegram',
        error
      );
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [checkTelegramWebApp, getTelegramUser, onAuthenticate]);

  // Функция для повторной попытки аутентификации
  const handleRetry = useCallback(async (): Promise<boolean> => {
    logAuthInfo(AuthStep.AUTH_RETRY, 'Повторная попытка авторизации через Telegram');
    return handleAuth();
  }, [handleAuth]);

  // Функция для закрытия WebApp
  const closeWebApp = useCallback(() => {
    try {
      if (checkTelegramWebApp()) {
        // @ts-ignore
        window.Telegram.WebApp.close();
        logAuthInfo(AuthStep.USER_INTERACTION, 'WebApp закрыт пользователем');
      }
    } catch (error) {
      logAuthError(
        AuthStep.USER_INTERACTION, 
        'Ошибка при закрытии WebApp',
        error
      );
    }
  }, [checkTelegramWebApp]);

  // Функция для открытия в Telegram
  const openInTelegram = useCallback(() => {
    try {
      // Логика для открытия в Telegram
      // Например, переход по специальной ссылке или другая логика
      logAuthInfo(AuthStep.USER_INTERACTION, 'Попытка открыть приложение в Telegram');
      
      // Здесь может быть логика для перехода в Telegram
      // window.location.href = 'https://t.me/your_bot';
    } catch (error) {
      logAuthError(
        AuthStep.USER_INTERACTION, 
        'Ошибка при открытии в Telegram',
        error
      );
    }
  }, []);

  // Инициализация при монтировании компонента
  useEffect(() => {
    // Инициализируем авторизацию при загрузке компонента
    handleAuth().finally(() => {
      setIsLoading(false);
    });
    
    // Очистка при размонтировании
    return () => {
      logAuthInfo(AuthStep.INIT, 'Очистка ресурсов хука useTelegramAuth');
    };
  }, [handleAuth]);

  return {
    user,
    status,
    isLoading,
    errorMessage,
    handleAuth,
    handleRetry,
    closeWebApp,
    openInTelegram
  };
} 