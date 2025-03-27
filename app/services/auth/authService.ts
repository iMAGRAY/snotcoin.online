import { jwtDecode } from 'jwt-decode';

// Константы для работы с токенами
const JWT_TOKEN_KEY = 'auth_token';
const USER_ID_KEY = 'user_id';

// Типы для токенов и данных пользователя
export interface AuthUser {
  id: string;
  fid: number;
  username: string;
  displayName?: string;
  pfp?: string;
  auth_provider?: string;
  created_at?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/**
 * Единый сервис авторизации для управления токенами и состоянием аутентификации
 */
class AuthService {
  // Предотвращение рекурсии в методах
  private preventRecursion = false;
  // Состояние процесса обновления токена
  private refreshInProgress = false;
  private refreshPromise: Promise<boolean> | null = null;
  
  /**
   * Получает JWT токен из localStorage
   * @returns Токен JWT или null
   */
  getToken(): string | null {
    try {
      // Предотвращение рекурсии
      if (this.preventRecursion) {
        return null;
      }
      
      this.preventRecursion = true;
      
      try {
        // Проверяем localStorage
        if (typeof window !== 'undefined') {
          const token = window.localStorage.getItem(JWT_TOKEN_KEY);
          if (token) {
            const isValid = this.validateTokenExpiration(token);
            return isValid ? token : null;
          }
        }
        
        return null;
      } finally {
        this.preventRecursion = false;
      }
    } catch (error) {
      this.preventRecursion = false;
      console.error('[AuthService] Ошибка при получении токена', error);
      return null;
    }
  }

  /**
   * Проверяет срок действия токена и пытается обновить его, если истек
   * @param token JWT токен
   * @returns true если токен действителен, иначе false
   */
  validateTokenExpiration(token: string): boolean {
    try {
      // Декодируем токен
      const payload = this.decodeToken(token);
      if (!payload) return false;
      
      // Проверяем срок действия
      if (payload.exp) {
        const currentTime = Math.floor(Date.now() / 1000);
        // Добавляем 5-секундный буфер для предотвращения граничных случаев
        if (payload.exp < currentTime + 5) {
          console.warn('[AuthService] Токен истек или истекает в ближайшие 5 секунд, требуется обновление');
          
          // Асинхронно запускаем обновление токена без ожидания результата
          setTimeout(() => {
            this.refreshToken().catch(e => 
              console.error('[AuthService] Ошибка при автоматическом обновлении токена', e)
            );
          }, 0);
          
          // Возвращаем false, чтобы указать на недействительность текущего токена
          return false;
        }
      }
      
      // Токен действителен
      return true;
    } catch (error) {
      console.error('[AuthService] Ошибка при проверке срока действия токена', error);
      return false;
    }
  }

  /**
   * Декодирует JWT токен
   * @param token JWT токен
   * @returns Декодированные данные из токена или null
   */
  decodeToken(token: string): any {
    try {
      return jwtDecode(token);
    } catch (error) {
      console.error('[AuthService] Ошибка при декодировании токена:', error);
      return null;
    }
  }

  /**
   * Сохраняет JWT токен в localStorage
   * @param token Токен JWT
   */
  saveToken(token: string): void {
    try {
      if (typeof window !== 'undefined') {
        // Предотвращаем сохранение невалидных токенов
        if (!token) {
          console.warn('[AuthService] Попытка сохранить пустой токен');
          return;
        }
        
        // Сохраняем в localStorage
        window.localStorage.setItem(JWT_TOKEN_KEY, token);
        console.log('[AuthService] Токен сохранен в localStorage');
      }
    } catch (error) {
      console.error('[AuthService] Ошибка при сохранении токена', error);
    }
  }

  /**
   * Обновляет JWT токен
   * @returns Promise<boolean> Успех обновления
   */
  async refreshToken(): Promise<boolean> {
    try {
      // Проверяем, не выполняется ли уже обновление
      if (this.refreshInProgress) {
        console.log('[AuthService] Пропуск запроса - обновление токена уже выполняется');
        return this.refreshPromise ? await this.refreshPromise : false;
      }
      
      console.log('[AuthService] Запрос на обновление токена');
      
      // Устанавливаем флаг выполнения обновления
      this.refreshInProgress = true;
      
      // Создаем новый промис для отслеживания результата
      this.refreshPromise = new Promise<boolean>(async (resolve, reject) => {
        try {
          // Запрос к API для обновления токена
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include', // Включаем отправку cookies для refresh_token
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          // Если запрос успешен
          if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.token) {
              // Сохраняем новый токен
              this.saveToken(data.token);
              
              // Если получены данные пользователя, сохраняем их
              if (data.user && data.user.id) {
                this.saveUserId(data.user.id);
              }
              
              console.log('[AuthService] Токен успешно обновлен');
              resolve(true);
              return;
            }
          }
          
          console.warn('[AuthService] Не удалось обновить токен:', response.status);
          resolve(false);
        } catch (error) {
          console.error('[AuthService] Ошибка при обновлении токена', error);
          resolve(false);
        } finally {
          // Сбрасываем флаг и промис
          this.refreshInProgress = false;
          this.refreshPromise = null;
        }
      });
      
      return await this.refreshPromise;
    } catch (error) {
      console.error('[AuthService] Критическая ошибка при обновлении токена', error);
      this.refreshInProgress = false;
      this.refreshPromise = null;
      return false;
    }
  }

  /**
   * Удаляет JWT токен из localStorage
   */
  removeToken(): void {
    try {
      if (typeof window !== 'undefined') {
        // Удаляем из localStorage
        window.localStorage.removeItem(JWT_TOKEN_KEY);
        console.log('[AuthService] Токен удален из localStorage');
      }
    } catch (error) {
      console.error('[AuthService] Ошибка при удалении токена из localStorage', error);
    }
  }

  /**
   * Сохраняет ID пользователя в localStorage
   * @param userId ID пользователя
   */
  saveUserId(userId: string): void {
    try {
      if (!userId) {
        console.warn('[AuthService] Попытка сохранить пустой ID пользователя');
        return;
      }
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(USER_ID_KEY, userId);
        console.log('[AuthService] ID пользователя сохранен в localStorage');
      }
    } catch (error) {
      console.error('[AuthService] Ошибка при сохранении ID пользователя в localStorage', error);
    }
  }

  /**
   * Получает ID пользователя из localStorage
   * @returns ID пользователя или null
   */
  getUserId(): string | null {
    try {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(USER_ID_KEY);
      }
      return null;
    } catch (error) {
      console.error('[AuthService] Ошибка при получении ID пользователя из localStorage', error);
      return null;
    }
  }

  /**
   * Получает данные пользователя из JWT токена
   * @returns Данные пользователя или null
   */
  getUserFromToken(): AuthUser | null {
    const token = this.getToken();
    if (!token) return null;
    
    const decoded = this.decodeToken(token);
    if (!decoded) return null;
    
    // Формируем объект пользователя из данных токена
    return {
      id: decoded.userId || decoded.id,
      fid: typeof decoded.fid === 'string' ? parseInt(decoded.fid, 10) : decoded.fid,
      username: decoded.username,
      displayName: decoded.displayName,
      pfp: decoded.pfp
    };
  }

  /**
   * Проверяет, аутентифицирован ли пользователь
   * @returns true если пользователь аутентифицирован, иначе false
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Выполняет выход пользователя
   * @returns Promise<boolean> Успех выхода
   */
  async logout(): Promise<boolean> {
    try {
      // Запрос к API для выхода
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      // Удаляем токены из localStorage независимо от результата запроса
      this.removeToken();
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(USER_ID_KEY);
      }
      
      return response.ok;
    } catch (error) {
      console.error('[AuthService] Ошибка при выходе:', error);
      
      // Удаляем токены в случае ошибки
      this.removeToken();
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(USER_ID_KEY);
      }
      
      return false;
    }
  }

  /**
   * Авторизует пользователя через Farcaster API
   * @param userData Данные пользователя от Farcaster
   * @returns Promise<{success: boolean, data?: any, error?: string}>
   */
  async loginWithFarcaster(userData: any): Promise<{success: boolean, data?: any, error?: string}> {
    try {
      if (!userData || !userData.fid) {
        return { 
          success: false, 
          error: 'Отсутствуют необходимые данные пользователя (fid)' 
        };
      }
      
      // Запрос к API для авторизации
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${baseUrl}/api/farcaster/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fid: userData.fid,
          username: userData.username,
          displayName: userData.displayName,
          pfp: userData.pfp?.url
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return { 
          success: false, 
          error: errorData.message || `Ошибка HTTP: ${response.status}` 
        };
      }
      
      const data = await response.json();
      
      if (!data.success) {
        return { 
          success: false, 
          error: data.message || 'Ошибка при авторизации' 
        };
      }
      
      // Сохраняем токен
      if (data.token) {
        this.saveToken(data.token);
      }
      
      // Сохраняем ID пользователя
      if (data.user && data.user.id) {
        this.saveUserId(data.user.id);
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('[AuthService] Ошибка при авторизации через Farcaster:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Неизвестная ошибка при авторизации' 
      };
    }
  }

  /**
   * Сохраняет данные пользователя
   * @param userData Данные пользователя
   */
  saveUserData(userData: AuthUser): void {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('farcaster_user', JSON.stringify(userData));
        this.saveUserId(userData.id);
        this.setAuthenticated(true);
      }
    } catch (error) {
      console.error('[AuthService] Ошибка при сохранении данных пользователя', error);
    }
  }

  /**
   * Получает данные пользователя
   * @returns Данные пользователя или null
   */
  getUserData(): AuthUser | null {
    try {
      if (typeof window !== 'undefined') {
        const userData = window.localStorage.getItem('farcaster_user');
        return userData ? JSON.parse(userData) : null;
      }
      return null;
    } catch (error) {
      console.error('[AuthService] Ошибка при получении данных пользователя', error);
      return null;
    }
  }

  /**
   * Устанавливает статус аутентификации
   * @param status Статус аутентификации
   */
  setAuthenticated(status: boolean): void {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('isAuthenticated', status.toString());
      }
    } catch (error) {
      console.error('[AuthService] Ошибка при установке статуса аутентификации', error);
    }
  }
}

// Экспортируем экземпляр сервиса
export const authService = new AuthService(); 