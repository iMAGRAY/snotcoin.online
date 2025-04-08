/**
 * Сервис для аутентификации пользователей
 */

import { api, LoginResponse } from '../../lib/api';
import { FarcasterUser } from '../../types/farcaster';

// Ключи для хранения токена и информации пользователя
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_info';

interface User {
  id: string;
  fid?: number | null | undefined;
  username?: string | null | undefined;
  displayName?: string | null | undefined;
  pfp?: string | null | undefined;
  verified?: boolean | null | undefined;
}

/**
 * Сервис аутентификации
 */
class AuthService {
  /**
   * Войти с использованием Farcaster
   * @param user Данные пользователя Farcaster
   * @param message Сообщение для подписи (опционально)
   * @param signature Подпись сообщения (опционально)
   */
  async loginWithFarcaster(
    user: FarcasterUser,
    message?: string,
    signature?: string
  ): Promise<boolean> {
    try {
      const loginParams = {
        fid: user.fid,
        username: user.username,
        displayName: user.displayName,
        pfp: user.pfpUrl,
        message,
        signature
      };

      const response = await api.loginWithFarcaster(loginParams);

      if (response.success && response.token && response.user) {
        this.setToken(response.token);
        this.setUser(response.user);
        return true;
      }

      console.error('[AuthService] Ошибка при входе через Farcaster:', response.error || 'Неизвестная ошибка');
      return false;
    } catch (error) {
      console.error('[AuthService] Ошибка при входе:', error);
      return false;
    }
  }

  /**
   * Выход из аккаунта
   */
  async logout(): Promise<void> {
    try {
      // Вызываем API для выхода
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('[AuthService] Ошибка при выходе:', error);
    } finally {
      // Удаляем локальные данные в любом случае
      this.clearAuth();
    }
  }

  /**
   * Получение текущего токена
   */
  getToken(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Установка токена
   */
  setToken(token: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(TOKEN_KEY, token);
  }

  /**
   * Получение информации о пользователе
   */
  getUser(): User | null {
    if (typeof localStorage === 'undefined') {
        return null;
      }
      
    const userJson = localStorage.getItem(USER_KEY);
    if (!userJson) {
        return null;
      }
      
    try {
      return JSON.parse(userJson);
    } catch (error) {
      console.error('[AuthService] Ошибка при получении пользователя:', error);
      return null;
    }
  }
  
  /**
   * Установка информации о пользователе
   */
  setUser(user: User): void {
    if (typeof localStorage === 'undefined') {
        return;
    }
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  /**
   * Очистка данных аутентификации
   */
  clearAuth(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  /**
   * Проверка авторизован ли пользователь
   */
  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getUser();
  }

  /**
   * Получение текущего ID пользователя
   */
  getCurrentUserId(): string | null {
    const user = this.getUser();
    return user ? user.id : null;
  }

  /**
   * Получение текущего FID пользователя (для Farcaster)
   */
  getCurrentFid(): number | null {
    const user = this.getUser();
    return user?.fid ?? null;
  }
}

// Экспортируем синглтон для использования во всем приложении
export const authService = new AuthService(); 