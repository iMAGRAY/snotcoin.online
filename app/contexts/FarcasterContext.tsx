'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FarcasterContext as FarcasterUserContext, FarcasterSDK } from '@/app/types/farcaster';
import { SafeUser } from '@/app/types/utils';
import { useAuth } from '@/app/hooks/useAuth';
import { logAuth, AuthStep, AuthLogType } from '@/app/utils/auth-logger';

interface FarcasterContextType {
  user: SafeUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<boolean>;
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
  const [user, setUser] = useState<SafeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  
  // Используем наш новый хук авторизации
  const { 
    user: authUser, 
    isLoading: authLoading, 
    isAuthenticated, 
    refreshAuthState, 
    logout: authLogout 
  } = useAuth();

  // Обновление данных пользователя
  const refreshUserData = async () => {
    try {
      setIsLoading(true);
      
      // Используем функцию из AuthProvider
      const success = await refreshAuthState();
      
      if (success && authUser) {
        setUser(authUser as SafeUser);
        return true;
      } else {
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('[FarcasterContext] Error fetching user data:', error);
      
      logAuth(
        AuthStep.AUTH_ERROR,
        AuthLogType.ERROR,
        'Ошибка при обновлении данных пользователя',
        {},
        error
      );
      
      setUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Получение данных пользователя по FID
  const fetchUserByFid = async (fid: string | number): Promise<FarcasterUserContext | null> => {
    try {
      if (typeof window !== 'undefined' && window.farcaster) {
        const farcaster = window.farcaster as FarcasterSDK;
        if (farcaster.fetchUserByFid) {
          return await farcaster.fetchUserByFid(Number(fid));
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching user by FID:', error);
      return null;
    }
  };

  // Синхронизируем состояние с AuthProvider
  useEffect(() => {
    if (authUser && !authLoading) {
      setUser(authUser as SafeUser);
      setIsLoading(false);
    } else if (!authLoading) {
      setUser(null);
      setIsLoading(false);
    }
  }, [authUser, authLoading]);

  // Функция для входа в систему
  const login = async () => {
    try {
      // Перенаправляем на страницу авторизации
      router.push('/auth');
    } catch (error) {
      console.error('[FarcasterContext] Login error:', error);
      
      logAuth(
        AuthStep.AUTH_ERROR,
        AuthLogType.ERROR,
        'Ошибка при попытке входа',
        {},
        error
      );
    }
  };

  // Функция для выхода из системы
  const logout = async () => {
    try {
      // Используем функцию из AuthProvider
      await authLogout();
      setUser(null);
      
      // Обновляем страницу или делаем что-то еще после выхода
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (error) {
      console.error('[FarcasterContext] Logout error:', error);
      
      logAuth(
        AuthStep.LOGOUT_ERROR,
        AuthLogType.ERROR,
        'Ошибка при выходе из системы',
        {},
        error
      );
    }
  };

  const value: FarcasterContextType = {
    user,
    isLoading: isLoading || authLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUserData,
    getUserByFid: fetchUserByFid,
  };

  return (
    <FarcasterContext.Provider value={value}>
      {children}
    </FarcasterContext.Provider>
  );
}; 