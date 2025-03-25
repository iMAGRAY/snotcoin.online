/**
 * Сервис для работы с аутентификацией через Farcaster с использованием JWT токенов
 */

import { jwtDecode } from "jwt-decode";
import { logAuth, AuthStep, AuthLogType } from '../utils/auth-logger';

// Расширяем глобальный интерфейс Window для поддержки authStore
declare global {
  interface Window {
    authStore?: {
      getAuthToken: () => string | null;
      getIsAuthenticated: () => boolean;
      setAuthToken: (token: string) => void;
      clearAuthData: () => void;
    };
  }
}

// Интерфейс для JWT payload
interface JwtPayload {
  id: string;
  fid: number;
  exp: number;
}

// Структура пользователя
interface FarcasterUser {
  id: string;
  fid: number;
  username?: string;
  displayName?: string;
  pfp?: string;
  exp?: number;
}

// Получает токен из localStorage
export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    // Сначала проверяем localStorage
    const token = localStorage.getItem('auth_token');
    if (token) {
      console.log(`[AuthService] Получен токен из localStorage`);
      return token;
    }
    
    // Затем проверяем authStore, если он существует
    if (typeof window.authStore !== 'undefined' && window.authStore.getAuthToken) {
      const storeToken = window.authStore.getAuthToken();
      if (storeToken) {
        console.log(`[AuthService] Получен токен из authStore`);
        // Сохраняем в localStorage для синхронизации
        try {
          localStorage.setItem('auth_token', storeToken);
        } catch (storageError) {
          console.warn('[AuthService] Не удалось сохранить токен в localStorage:', storageError);
        }
        return storeToken;
      }
    }
    
    // Проверяем в sessionStorage как запасной вариант
    const sessionToken = sessionStorage.getItem('auth_token');
    if (sessionToken) {
      console.log(`[AuthService] Получен токен из sessionStorage`);
      // Сохраняем в localStorage для синхронизации
      try {
        localStorage.setItem('auth_token', sessionToken);
      } catch (storageError) {
        console.warn('[AuthService] Не удалось сохранить токен в localStorage:', storageError);
      }
      return sessionToken;
    }
    
    console.log(`[AuthService] Токен не найден ни в одном из хранилищ`);
    return null;
  } catch (error) {
    console.error('[AuthService] Ошибка получения токена из хранилищ:', error);
    logAuth(
      AuthStep.TOKEN_VALIDATION, 
      AuthLogType.ERROR, 
      'Ошибка получения токена из хранилищ',
      { error: error instanceof Error ? error.message : 'Неизвестная ошибка' }
    );
    return null;
  }
};

// Сохраняет токен в localStorage
export const setToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('auth_token', token);
    console.log('[AuthService] Токен сохранен в localStorage');
    logAuth(
      AuthStep.TOKEN_RECEIVED, 
      AuthLogType.INFO, 
      'Токен сохранен в localStorage'
    );
  } catch (error) {
    console.error('[AuthService] Ошибка сохранения токена в localStorage:', error);
    logAuth(
      AuthStep.TOKEN_RECEIVED, 
      AuthLogType.ERROR, 
      'Ошибка сохранения токена в localStorage',
      { error: error instanceof Error ? error.message : 'Неизвестная ошибка' }
    );
  }
};

// Удаляет токен из localStorage
export const removeToken = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem('auth_token');
    console.log('[AuthService] Токен удален из localStorage');
    logAuth(
      AuthStep.USER_INTERACTION, 
      AuthLogType.INFO, 
      'Токен удален из localStorage'
    );
  } catch (error) {
    console.error('[AuthService] Ошибка удаления токена из localStorage:', error);
    logAuth(
      AuthStep.USER_INTERACTION, 
      AuthLogType.ERROR, 
      'Ошибка удаления токена из localStorage',
      { error: error instanceof Error ? error.message : 'Неизвестная ошибка' }
    );
  }
};

// Получает пользователя из токена
export const getUserFromToken = (): FarcasterUser | null => {
  const token = getToken();
  if (!token) return null;
  
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    console.log(`[AuthService] Декодирован токен, ID пользователя: ${decoded.id}, FID: ${decoded.fid}`);
    
    return {
      id: decoded.id,
      fid: decoded.fid,
      exp: decoded.exp
    };
  } catch (error) {
    console.error('[AuthService] Ошибка декодирования токена:', error);
    logAuth(
      AuthStep.TOKEN_VALIDATION, 
      AuthLogType.ERROR, 
      'Ошибка декодирования токена',
      { error: error instanceof Error ? error.message : 'Неизвестная ошибка' }
    );
    return null;
  }
};

// Проверяет, действителен ли токен
export const isTokenValid = (): boolean => {
  const user = getUserFromToken();
  if (!user || !user.exp) return false;
  
  const currentTime = Math.floor(Date.now() / 1000);
  return user.exp > currentTime;
};

// Обновляет данные пользователя из Farcaster
export const refreshUserData = async (): Promise<FarcasterUser | null> => {
  try {
    const response = await fetch('/api/farcaster/auth');
    const data = await response.json();
    
    if (data.authenticated && data.user) {
      // Обновляем токен, если он был обновлен
      if (data.token) {
        setToken(data.token);
      }
      
      return data.user;
    }
    
    return null;
  } catch (error) {
    logAuth(
      AuthStep.FARCASTER_REQUEST, 
      AuthLogType.ERROR, 
      'Ошибка обновления данных пользователя',
      { error: error instanceof Error ? error.message : 'Неизвестная ошибка' }
    );
    return null;
  }
}; 