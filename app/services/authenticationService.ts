/**
 * Сервис для работы с аутентификацией через Farcaster с использованием JWT токенов
 */

import { jwtDecode } from "jwt-decode";
import { logAuth, AuthStep, AuthLogType } from '../utils/auth-logger';

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
    const token = localStorage.getItem('authToken');
    return token;
  } catch (error) {
    logAuth(
      AuthStep.TOKEN_VALIDATION, 
      AuthLogType.ERROR, 
      'Ошибка получения токена из localStorage',
      { error: error instanceof Error ? error.message : 'Неизвестная ошибка' }
    );
    return null;
  }
};

// Сохраняет токен в localStorage
export const setToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('authToken', token);
    logAuth(
      AuthStep.TOKEN_RECEIVED, 
      AuthLogType.INFO, 
      'Токен сохранен в localStorage'
    );
  } catch (error) {
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
    localStorage.removeItem('authToken');
    logAuth(
      AuthStep.USER_INTERACTION, 
      AuthLogType.INFO, 
      'Токен удален из localStorage'
    );
  } catch (error) {
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
    
    return {
      id: decoded.id,
      fid: decoded.fid,
      exp: decoded.exp
    };
  } catch (error) {
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