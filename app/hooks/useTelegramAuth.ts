"use client";

/**
 * Хук для работы с аутентификацией через Telegram
 */

import { useState, useCallback, useEffect } from 'react';
import { useTelegramWebApp } from './useTelegramWebApp';
import { useGameDispatch } from '../contexts/GameContext';
import { TelegramAuthProps, TelegramUser, AuthState, AuthStatus } from '../types/telegramAuth';
import { authenticateWithTelegram, authenticateWithForceLogin } from '../services/authenticationService';
import { AuthLogType, AuthStep, logAuth, logAuthDebug, logAuthError, logAuthInfo, setUserId } from '../utils/auth-logger';
import { authStore } from '../components/auth/AuthenticationWindow';
import { useTelegramWebAppContext } from '../contexts/TelegramWebAppContext';

/**
 * Результат работы хука аутентификации
 */
interface TelegramAuthHookResult {
  user: TelegramUser | null;
  status: AuthStatus;
  isLoading: boolean;
  handleAuth: () => Promise<boolean>;
  handleRetry: () => void;
  closeWebApp: () => void;
  openInTelegram: () => void;
  isAuthenticated: boolean;
  authToken: string | null;
  errorMessage: string | null;
  login: () => void;
  logout: () => void;
}

/**
 * Хук для работы с аутентификацией через Telegram с подробным логированием
 */
export const useTelegramAuth = (
  onAuthenticate: TelegramAuthProps['onAuthenticate']
): TelegramAuthHookResult => {
  const [state, setState] = useState<AuthState>({
    status: AuthStatus.LOADING,
    user: null,
    error: null
  });
  
  // Используем новый контекст вместо отдельного хука
  const webAppContext = useTelegramWebAppContext();
  const webApp = useTelegramWebApp();
  
  const dispatch = useGameDispatch();
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authAttempts, setAuthAttempts] = useState<number>(0);
  
  /**
   * Добавление отладочной информации
   */
  const addDebugInfo = (info: string) => {
    setState(prev => ({
      ...prev,
      debugInfo: prev.debugInfo ? `${prev.debugInfo}\n${info}` : info
    }));
  };
  
  /**
   * Обработка успешной аутентификации
   */
  const handleAuthSuccess = useCallback((user: TelegramUser) => {
    dispatch({ type: "SET_USER", payload: user });
    dispatch({ type: "SET_GAME_STARTED", payload: true });
    
    setState({
      status: AuthStatus.SUCCESS,
      user,
      error: null
    });
    
    onAuthenticate(user);
    
    return true;
  }, [dispatch, onAuthenticate]);
  
  /**
   * Обработка ошибки аутентификации
   */
  const handleAuthError = useCallback((error: string, details?: string) => {
    setState(prev => ({
      ...prev,
      status: AuthStatus.ERROR,
      error,
      errorDetails: details
    }));
    
    return false;
  }, []);
  
  /**
   * Аутентификация через URL-параметры
   */
  const tryWithUrlData = useCallback(async (): Promise<boolean> => {
    try {
      addDebugInfo("Попытка аутентификации через URL-параметры");
      
      const url = window.location.href;
      const searchParams = new URL(url).searchParams;
      
      let initData = searchParams.get('initData') || 
                    searchParams.get('tgWebAppData') ||
                    searchParams.get('web_app_data');
      
      if (!initData) {
        // Проверяем хеш и другие параметры
        const hash = searchParams.get('hash') || searchParams.get('tgWebAppHash');
        const userId = searchParams.get('id') || searchParams.get('user_id') || searchParams.get('tgWebAppUserId');
        const authDate = searchParams.get('auth_date') || searchParams.get('tgWebAppAuthDate');
        const firstName = searchParams.get('first_name') || searchParams.get('tgWebAppFirstName');
        
        if (hash && userId && authDate && firstName) {
          // Формируем вручную данные для аутентификации
          const manualData = {
            id: userId,
            first_name: firstName,
            last_name: searchParams.get('last_name') || searchParams.get('tgWebAppLastName') || '',
            username: searchParams.get('username') || searchParams.get('tgWebAppUsername') || '',
            auth_date: parseInt(authDate),
            hash: hash
          };
          
          // Форматируем в строку, имитирующую initData
          initData = Object.entries(manualData)
            .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
            .join('&');
          
          addDebugInfo("Сформированы данные из URL-параметров");
        } else {
          addDebugInfo("Параметры аутентификации не найдены в URL");
          return false;
        }
      }
      
      const result = await authenticateWithTelegram(initData);
      
      if (result.success && result.user) {
        addDebugInfo("Аутентификация через URL успешна");
        return handleAuthSuccess(result.user);
      } else {
        return handleAuthError(
          result.error || "Неизвестная ошибка при аутентификации через URL",
          result.errorDetails
        );
      }
    } catch (error) {
      return handleAuthError(
        `Ошибка при аутентификации через URL: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }, [handleAuthSuccess, handleAuthError]);
  
  /**
   * Форсированный вход (для тестирования)
   */
  const tryForceLogin = useCallback(async (): Promise<boolean> => {
    try {
      addDebugInfo("Попытка форсированного входа");
      
      const sessionId = crypto.randomUUID 
        ? crypto.randomUUID() 
        : Date.now().toString(36) + Math.random().toString(36).substring(2);
      
      const testUserId = Math.floor(1000000 + Math.random() * 9000000);
      
      const result = await authenticateWithForceLogin({
        telegramId: testUserId,
        username: `user_${testUserId.toString(36)}`,
        first_name: "Тестовый",
        last_name: "Пользователь",
        force_login: true,
        session_id: sessionId,
        userAgent: navigator.userAgent
      });
      
      if (result.success && result.user) {
        addDebugInfo("Форсированный вход успешен");
        return handleAuthSuccess(result.user);
      } else {
        return handleAuthError(
          result.error || "Неизвестная ошибка при форсированном входе",
          result.errorDetails
        );
      }
    } catch (error) {
      return handleAuthError(
        `Ошибка при форсированном входе: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }, [handleAuthSuccess, handleAuthError]);
  
  /**
   * Аутентификация через Telegram WebApp
   */
  const tryAuthenticate = useCallback(async (): Promise<boolean> => {
    try {
      logAuthInfo(AuthStep.TELEGRAM_INIT, 'Начало процесса аутентификации');
      
      // Проверяем состояние WebApp через контекст
      if (!webAppContext.isReady) {
        logAuthInfo(AuthStep.TELEGRAM_WEB_APP_DATA, 'WebApp контекст не готов, ожидаем...', {
          isLoading: webAppContext.isLoading,
          isReady: webAppContext.isReady,
          error: webAppContext.error
        });
        
        // Если есть ошибка в контексте
        if (webAppContext.error) {
          logAuthError(
            AuthStep.TELEGRAM_WEB_APP_DATA, 
            'Ошибка инициализации WebApp из контекста', 
            new Error(webAppContext.error)
          );
          
          // Пробуем аутентификацию через URL-параметры
          logAuthInfo(AuthStep.TELEGRAM_WEB_APP_DATA, 'WebApp недоступен, пробуем URL-метод');
          const urlAuthResult = await tryWithUrlData();
          if (urlAuthResult) {
            return true;
          }
          
          // Если в тестовом режиме, пробуем форсированный вход
          if (process.env.NODE_ENV === 'development') {
            logAuthInfo(AuthStep.TELEGRAM_WEB_APP_DATA, 'Пробуем форсированный вход в режиме разработки');
            return await tryForceLogin();
          }
          
          logAuthError(
            AuthStep.TELEGRAM_WEB_APP_DATA, 
            'Все методы аутентификации завершились неудачно', 
            new Error('Authentication failed for all methods')
          );
          return handleAuthError('Не удалось аутентифицироваться. Убедитесь, что вы открыли ссылку через приложение Telegram.');
        }
        
        // Если контекст загружается, ждем 
        if (webAppContext.isLoading) {
          logAuthInfo(AuthStep.TELEGRAM_WEB_APP_DATA, 'WebApp контекст загружается, ждём...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Пробуем снова проверить, готов ли контекст
          if (!webAppContext.isReady) {
            logAuthError(
              AuthStep.TELEGRAM_WEB_APP_DATA, 
              'WebApp контекст не готов даже после ожидания', 
              new Error('WebApp context not ready after waiting')
            );
            
            // Пробуем другие методы
            return await tryWithUrlData() || 
                  (process.env.NODE_ENV === 'development' && await tryForceLogin()) ||
                  handleAuthError('Не удалось подключиться к Telegram. Попробуйте открыть приложение через меню бота.'); 
          }
        }
      }
      
      // WebApp готов, получаем данные из контекста
      if (webAppContext.isReady && webAppContext.initData) {
        logAuthInfo(AuthStep.TELEGRAM_VERIFY_DATA, 'Получены данные initData из WebApp контекста', {
          dataLength: webAppContext.initData.length,
          hasUserData: !!webAppContext.userData
        });
        
        // Аутентифицируем пользователя через сервис с использованием данных из контекста
        const result = await authenticateWithTelegram(webAppContext.initData);
        
        if (result.success && result.user) {
          logAuthInfo(AuthStep.TELEGRAM_SUCCESS, 'Аутентификация через WebApp успешна', result.user);
          // Сохраняем ID пользователя для логирования
          if (result.user.telegram_id) {
            setUserId(result.user.telegram_id.toString());
          }
          return handleAuthSuccess(result.user);
        } else {
          logAuthError(
            AuthStep.TELEGRAM_VERIFY_DATA, 
            'Ошибка при проверке данных с сервера', 
            new Error(result.error || 'Unknown server error')
          );
          return handleAuthError(
            result.error || "Не удалось подтвердить данные пользователя",
            result.errorDetails
          );
        }
      }
      
      // Если дошли до сюда и WebApp готов, но нет initData
      if (webAppContext.isReady && !webAppContext.initData) {
        logAuthError(
          AuthStep.TELEGRAM_WEB_APP_DATA,
          'WebApp готов, но данные initData отсутствуют',
          new Error('WebApp ready but no initData available')
        );
        
        // Пробуем другие методы аутентификации
        return await tryWithUrlData() || 
              (process.env.NODE_ENV === 'development' && await tryForceLogin()) ||
              handleAuthError('Данные авторизации отсутствуют. Попробуйте открыть через Telegram.');
      }
      
      // Если мы здесь, значит что-то пошло не так
      logAuthError(
        AuthStep.AUTH_ERROR, 
        'Неожиданное состояние в процессе аутентификации', 
        new Error('Unexpected auth flow state')
      );
      return handleAuthError('Не удалось завершить процесс авторизации. Попробуйте позже.');
      
    } catch (error) {
      logAuthError(
        AuthStep.AUTH_ERROR, 
        'Исключение при авторизации', 
        error instanceof Error ? error : new Error(String(error))
      );
      return handleAuthError(
        `Ошибка при аутентификации: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }, [webAppContext, handleAuthSuccess, handleAuthError, tryWithUrlData, tryForceLogin]);
  
  /**
   * Повторная попытка аутентификации
   */
  const handleRetry = useCallback(() => {
    setState({
      status: AuthStatus.LOADING,
      user: null,
      error: null
    });
    
    window.location.reload();
  }, []);
  
  /**
   * Открытие страницы в Telegram
   */
  const openInTelegram = useCallback(() => {
    const currentUrl = window.location.href;
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}`;
    window.open(telegramUrl, '_blank');
  }, []);
  
  const closeWebApp = webApp.closeWebApp;
  
  /**
   * Загрузка пользовательского профиля
   */
  const loadUser = useCallback(() => {
    try {
      const storedUser = localStorage.getItem('telegram_user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setState({
          status: AuthStatus.SUCCESS,
          user,
          error: null
        });
        setIsAuthenticated(true);
        dispatch({ type: "SET_USER", payload: user });
      }
    } catch (error) {
      console.error('Ошибка при загрузке пользователя из localStorage:', error);
    }
  }, [dispatch]);
  
  const login = () => {
    if (window.Telegram && window.Telegram.WebApp) {
      try {
        const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
        
        if (tgUser) {
          const userData: TelegramUser = {
            id: tgUser.id.toString(),
            telegram_id: tgUser.id,
            first_name: tgUser.first_name,
            last_name: tgUser.last_name,
            username: tgUser.username,
            photo_url: tgUser.photo_url
          };
          
          const tempToken = `tg_${userData.id}_${Date.now()}`;
          
          localStorage.setItem('telegram_user', JSON.stringify(userData));
          localStorage.setItem('telegram_token', tempToken);
          
          setState({
            status: AuthStatus.SUCCESS,
            user: userData,
            error: null
          });
          setAuthToken(tempToken);
          setIsAuthenticated(true);
          
          return;
        }
      } catch (error) {
        console.error('Ошибка при авторизации через Telegram WebApp:', error);
        setState({
          status: AuthStatus.ERROR,
          user: null,
          error: 'Ошибка при авторизации через Telegram WebApp'
        });
      }
    }
    
    setState({
      status: AuthStatus.ERROR,
      user: null,
      error: 'Telegram WebApp недоступен. Используйте приложение Telegram.'
    });
  };

  /**
   * Выход из аккаунта
   */
  const logout = useCallback(() => {
    localStorage.removeItem('telegram_user');
    localStorage.removeItem('auth_token');
    setState({
      status: AuthStatus.INIT,
      user: null,
      error: null
    });
    setAuthToken(null);
    setIsAuthenticated(false);
    
    dispatch({ type: "RESET_GAME_STATE" });
  }, [dispatch]);
  
  // Эффект для инициализации
  useEffect(() => {
    loadUser();
  }, [loadUser]);
  
  return {
    user: state.user,
    status: state.status,
    isLoading: state.status === AuthStatus.LOADING,
    handleAuth: tryAuthenticate,
    handleRetry,
    closeWebApp,
    openInTelegram,
    isAuthenticated,
    authToken,
    errorMessage: state.error,
    login,
    logout
  };
};

// Используем интерфейс Window из telegram.d.ts
// Удаляем повторное объявление
  
// Эффект для инициализации
useEffect(() => {
  // ... существующий код ...
}, []);
  
// ... existing code ... 