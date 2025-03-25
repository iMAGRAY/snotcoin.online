'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface FarcasterUser {
  id: string;
  fid: number;
  username: string;
  displayName?: string;
  pfp?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface FarcasterContextType {
  user: FarcasterUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<boolean>;
  refreshTokens: () => Promise<boolean>;
  getUserByFid: (fid: string) => Promise<any>;
}

const FarcasterContext = createContext<FarcasterContextType | undefined>(undefined);

export const useFarcaster = () => {
  const context = useContext(FarcasterContext);
  if (context === undefined) {
    throw new Error('useFarcaster must be used within a FarcasterProvider');
  }
  return context;
};

interface FarcasterProviderProps {
  children: ReactNode;
}

export const FarcasterProvider = ({ children }: FarcasterProviderProps) => {
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const router = useRouter();

  // Обновление данных пользователя с сервера
  const refreshUserData = async () => {
    try {
      setIsLoading(true);
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${baseUrl}/api/farcaster/auth`);
      const data = await response.json();
      
      if (data.authenticated && data.user) {
        setUser(data.user);
        return true;
      } else if (data.refreshable) {
        // Если токен истек, но может быть обновлен
        const refreshSuccess = await refreshTokens();
        if (refreshSuccess) {
          return await refreshUserData();
        }
        
        setUser(null);
        return false;
      } else {
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Обновление токенов через refresh token
  const refreshTokens = async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success && data.tokens) {
        setTokens(data.tokens);
        
        // Сохраняем токен в localStorage для совместимости с dataService
        try {
          localStorage.setItem('auth_token', data.tokens.accessToken);
          console.log('[FarcasterContext] Обновленный токен сохранен в localStorage');
        } catch (storageError) {
          console.warn('[FarcasterContext] Не удалось сохранить токен в localStorage:', storageError);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      return false;
    }
  };

  // Получение данных пользователя по FID
  const getUserByFid = async (fid: string) => {
    try {
      // Если у нас есть Farcaster SDK, используем его напрямую
      if (typeof window !== 'undefined' && window.farcaster && window.farcaster.fetchUserByFid) {
        return await window.farcaster.fetchUserByFid(Number(fid));
      }
      
      // Иначе можно реализовать запрос к API Warpcast
      // Но это требует дополнительных настроек и API-ключей
      console.warn('Farcaster SDK не доступен для получения данных пользователя');
      return null;
    } catch (error) {
      console.error('Error fetching user by FID:', error);
      return null;
    }
  };

  // Проверяем наличие авторизации при инициализации
  useEffect(() => {
    refreshUserData();
  }, []);

  // Функция для входа в систему через Neynar
  const login = async () => {
    try {
      // Перенаправляем на страницу авторизации
      router.push('/auth');
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  // Функция для выхода из системы
  const logout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      
      if (response.ok) {
        setUser(null);
        setTokens(null);
        // Обновляем страницу или делаем что-то еще после выхода
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value: FarcasterContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUserData,
    refreshTokens,
    getUserByFid,
  };

  return (
    <FarcasterContext.Provider value={value}>
      {children}
    </FarcasterContext.Provider>
  );
}; 