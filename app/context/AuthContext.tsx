import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../lib/api';

// Тип данных пользователя
export interface User {
  id: string;
  provider: string;
  username?: string;
  displayName?: string;
  fid?: number;
  profileImage?: string;
  verified?: boolean;
  metadata?: Record<string, any>;
}

// Тип контекста аутентификации
interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (provider: string, credentials?: any) => Promise<boolean>;
  logout: () => void;
  refreshAuth: () => Promise<boolean>;
}

// Создаем контекст
const AuthContext = createContext<AuthContextType | null>(null);

// Хук для использования контекста аутентификации
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
};

// Пропсы для провайдера
interface AuthProviderProps {
  children: ReactNode;
}

// Провайдер контекста аутентификации
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Функция для входа в систему
  const login = async (provider: string, credentials?: any): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      // Вызываем API для авторизации
      const response = await api.login(provider, credentials);
      
      if (response.success && response.token) {
        setToken(response.token);
        setRefreshToken(response.refreshToken || null);
        setUser(response.user || null);
        
        // Сохраняем токены в localStorage
        localStorage.setItem('auth_token', response.token);
        if (response.refreshToken) {
          localStorage.setItem('refresh_token', response.refreshToken);
        }
        
        return true;
      } else {
        throw new Error(response.error || 'Ошибка аутентификации');
      }
    } catch (error) {
      console.error('Ошибка входа:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Функция для выхода из системы
  const logout = () => {
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    
    // Удаляем токены из localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
  };
  
  // Функция для обновления токена
  const refreshAuth = async (): Promise<boolean> => {
    // Если нет токена обновления, выходим
    if (!refreshToken) {
      return false;
    }
    
    try {
      setIsLoading(true);
      
      // Вызываем API для обновления токена
      const response = await api.refreshToken(refreshToken);
      
      if (response.success && response.token) {
        setToken(response.token);
        
        // Обновляем refresh token, если он предоставлен
        if (response.refreshToken) {
          setRefreshToken(response.refreshToken);
          localStorage.setItem('refresh_token', response.refreshToken);
        }
        
        // Обновляем данные пользователя, если они предоставлены
        if (response.user) {
          setUser(response.user);
        }
        
        // Сохраняем новый токен в localStorage
        localStorage.setItem('auth_token', response.token);
        
        return true;
      } else {
        // Если обновление не удалось, выходим
        logout();
        return false;
      }
    } catch (error) {
      console.error('Ошибка обновления токена:', error);
      logout();
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Проверяем наличие токена при инициализации
  useEffect(() => {
    const initAuth = async () => {
      try {
        setIsLoading(true);
        
        // Получаем токены из localStorage
        const storedToken = localStorage.getItem('auth_token');
        const storedRefreshToken = localStorage.getItem('refresh_token');
        
        if (storedToken) {
          setToken(storedToken);
          
          if (storedRefreshToken) {
            setRefreshToken(storedRefreshToken);
          }
          
          // Пытаемся получить данные пользователя
          try {
            const userResponse = await api.getUserProfile(storedToken);
            
            if (userResponse.success && userResponse.user) {
              setUser(userResponse.user);
            } else {
              // Если не удалось получить данные, пытаемся обновить токен
              if (storedRefreshToken) {
                await refreshAuth();
              } else {
                // Если нет refresh токена, выходим
                logout();
              }
            }
          } catch (profileError) {
            console.error('Ошибка получения профиля:', profileError);
            
            // Если произошла ошибка, пытаемся обновить токен
            if (storedRefreshToken) {
              await refreshAuth();
            } else {
              logout();
            }
          }
        } else {
          // Если нет сохраненного токена, выходим
          logout();
        }
      } catch (error) {
        console.error('Ошибка инициализации аутентификации:', error);
        logout();
      } finally {
        setIsLoading(false);
      }
    };
    
    initAuth();
  }, []);
  
  // Проверяем, аутентифицирован ли пользователь
  const isAuthenticated = !!user && !!token;
  
  return (
    <AuthContext.Provider value={{
      user,
      token,
      refreshToken,
      isAuthenticated,
      isLoading,
      login,
      logout,
      refreshAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider; 