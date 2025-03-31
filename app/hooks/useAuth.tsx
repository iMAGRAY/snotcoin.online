'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { UserData } from '@/app/types/auth';
import { FarcasterContext } from '@/app/types/farcaster';
import { logAuth, AuthStep, AuthLogType } from '@/app/utils/auth-logger';
import { ExtendedGameState } from '../types/gameTypes';

// Интерфейс контекста авторизации
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserData | null;
  gameState: {
    exists: boolean;
    lastSaved: string | null;
    version: number;
  } | null;
  login: (userData: FarcasterContext) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuthState: () => Promise<boolean>;
  getToken: () => string | null;
}

// Создаем контекст с начальными значениями
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  gameState: null,
  login: async () => false,
  logout: async () => {},
  refreshAuthState: async () => false,
  getToken: () => null
});

// Ключ для хранения токена в localStorage
const TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'auth_user';

// Провайдер контекста авторизации
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [gameState, setGameState] = useState<AuthContextType['gameState']>(null);

  // Получение токена из localStorage
  const getToken = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        console.warn('[useAuth] Токен авторизации не найден в localStorage');
        return null;
      }
      
      // Проверяем валидность токена
      if (token.trim() === '' || token === 'undefined' || token === 'null') {
        console.error('[useAuth] Найден невалидный токен:', token);
        localStorage.removeItem(TOKEN_KEY); // Удаляем невалидный токен
        return null;
      }
      
      return token;
    } catch (error) {
      console.error('[useAuth] Ошибка при получении токена:', error);
      return null;
    }
  }, []);

  // Сохранение токена в localStorage
  const saveToken = useCallback((token: string): void => {
    try {
      if (!token || token.trim() === '') {
        console.error('[useAuth] Попытка сохранить пустой токен');
        return;
      }
      
      localStorage.setItem(TOKEN_KEY, token);
      console.log('[useAuth] Токен успешно сохранен');
    } catch (error) {
      console.error('[useAuth] Ошибка при сохранении токена:', error);
    }
  }, []);

  // Сохранение данных пользователя в localStorage
  const saveUserData = useCallback((userData: UserData): void => {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
  }, []);

  // Получение данных пользователя из localStorage
  const getUserData = useCallback((): UserData | null => {
    const data = localStorage.getItem(USER_DATA_KEY);
    if (!data) return null;

    try {
      return JSON.parse(data) as UserData;
    } catch (error) {
      console.error('Ошибка при чтении данных пользователя:', error);
      return null;
    }
  }, []);

  // Очистка данных авторизации
  const clearAuthData = useCallback((): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_DATA_KEY);
  }, []);

  // Проверка статуса авторизации
  const refreshAuthState = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);

    try {
      const token = getToken();
      
      if (!token) {
        console.warn('[useAuth] refreshAuthState: Токен отсутствует');
        setIsAuthenticated(false);
        setUser(null);
        setIsLoading(false);
        return false;
      }
      
      // Проверяем, не является ли токен локальным
      const tokenType = localStorage.getItem('auth_token_type');
      if (tokenType === 'local' || token.startsWith('local_')) {
        console.log('[useAuth] refreshAuthState: Используется локальный токен, пропускаем запрос на сервер');
        // Для локальных токенов не проверяем авторизацию на сервере
        setIsAuthenticated(true);
        
        // Пытаемся получить локальные данные пользователя
        const localUser = getUserData();
        setUser(localUser);
        
        setIsLoading(false);
        return true;
      }

      console.log('[useAuth] refreshAuthState: Проверка статуса авторизации на сервере');
      
      // Проверяем статус авторизации на сервере
      const response = await fetch('/api/auth/warpcast', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error(`[useAuth] refreshAuthState: Ошибка HTTP ${response.status}`);
        // В случае ошибки, очищаем данные авторизации
        clearAuthData();
        setIsAuthenticated(false);
        setUser(null);
        setIsLoading(false);
        return false;
      }

      const data = await response.json();

      if (data.authenticated) {
        console.log('[useAuth] refreshAuthState: Авторизация подтверждена');
        setIsAuthenticated(true);
        setUser(data.user);
        
        // Если есть данные о прогрессе игры, сохраняем их
        if (data.gameState) {
          setGameState(data.gameState);
        }
        
        setIsLoading(false);
        return true;
      } else {
        console.warn('[useAuth] refreshAuthState: Авторизация не подтверждена', data);
        // Если токен недействительный, очищаем данные
        if (data.expired) {
          console.warn('[useAuth] refreshAuthState: Токен истек, очистка данных');
          clearAuthData();
        }
        
        setIsAuthenticated(false);
        setUser(null);
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      console.error('[useAuth] Ошибка при проверке авторизации:', error);
      
      logAuth(
        AuthStep.AUTH_ERROR,
        AuthLogType.ERROR,
        'Ошибка при проверке авторизации',
        {},
        error
      );
      
      // В случае ошибки, очищаем данные авторизации
      clearAuthData();
      setIsAuthenticated(false);
      setUser(null);
      setIsLoading(false);
      return false;
    }
  }, [getToken, clearAuthData]);

  // Авторизация пользователя
  const login = useCallback(async (userData: FarcasterContext): Promise<boolean> => {
    setIsLoading(true);
    console.log('[useAuth] Начало процесса авторизации', { 
      fid: userData.user?.fid, 
      username: userData.user?.username 
    });

    try {
      // Отправляем данные на сервер для валидации через Neynar
      const response = await fetch('/api/auth/warpcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      console.log(`[useAuth] Получен ответ от сервера: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Ошибка HTTP: ${response.status}` }));
        console.error('[useAuth] Ошибка авторизации от API:', errorData);
        throw new Error(errorData.message || 'Ошибка авторизации');
      }

      const authResult = await response.json();
      console.log('[useAuth] Получен результат авторизации', { success: authResult.success });

      if (!authResult.success) {
        console.error('[useAuth] Неуспешный результат авторизации:', authResult);
        throw new Error(authResult.message || 'Ошибка авторизации');
      }
      
      // Проверяем наличие токена
      if (!authResult.token) {
        console.error('[useAuth] В ответе отсутствует токен авторизации');
        throw new Error('Токен авторизации отсутствует в ответе сервера');
      }

      // Сохраняем токен и данные пользователя
      saveToken(authResult.token);
      saveUserData(authResult.user);

      // Обновляем состояние
      setIsAuthenticated(true);
      setUser(authResult.user);
      
      // Если есть данные о прогрессе игры, сохраняем их
      if (authResult.gameState) {
        setGameState(authResult.gameState);
      }
      
      logAuth(
        AuthStep.AUTH_COMPLETE,
        AuthLogType.INFO,
        'Авторизация успешно завершена',
        { userId: authResult.user.id }
      );

      console.log('[useAuth] Авторизация успешно завершена', { userId: authResult.user.id });
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('[useAuth] Ошибка при авторизации:', error);
      
      logAuth(
        AuthStep.AUTH_ERROR,
        AuthLogType.ERROR,
        'Ошибка при авторизации',
        {},
        error
      );
      
      setIsAuthenticated(false);
      setUser(null);
      setIsLoading(false);
      return false;
    }
  }, [saveToken, saveUserData]);

  // Выход из системы
  const logout = useCallback(async (): Promise<void> => {
    try {
      // Отправляем запрос на сервер для удаления сессии
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`
        }
      });
    } catch (error) {
      console.error('Ошибка при выходе из системы:', error);
    } finally {
      // Очищаем локальные данные даже при ошибке на сервере
      clearAuthData();
      setIsAuthenticated(false);
      setUser(null);
      setGameState(null);
      
      logAuth(
        AuthStep.LOGOUT_COMPLETE,
        AuthLogType.INFO,
        'Выход из системы выполнен успешно'
      );
    }
  }, [getToken, clearAuthData]);

  // Проверяем авторизацию при загрузке
  useEffect(() => {
    // Восстанавливаем данные из localStorage при инициализации
    const storedUser = getUserData();
    if (storedUser) {
      setUser(storedUser);
    }
    
    // Проверяем статус авторизации на сервере
    refreshAuthState().then((isAuth) => {
      if (isAuth) {
        logAuth(
          AuthStep.INIT,
          AuthLogType.INFO,
          'Пользователь автоматически авторизован',
          { userId: storedUser?.id }
        );
      }
    });
  }, [getUserData, refreshAuthState]);

  // Предоставляем контекст авторизации
  const contextValue: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    gameState,
    login,
    logout,
    refreshAuthState,
    getToken
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Хук для использования контекста авторизации
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }

  return context;
}

export default useAuth; 