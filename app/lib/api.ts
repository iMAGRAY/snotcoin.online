/**
 * API клиент для взаимодействия с серверными эндпоинтами
 */

import { GameState } from '../types/gameTypes';

// Определение типа User внутри файла
interface User {
  id: string;
  username: string | null;
  displayName: string | null;
  fid?: number | null;
  provider?: string;
  profileImage?: string | null;
  verified?: boolean | null;
  metadata?: Record<string, any>;
}

// Типы ответов
export interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  processingTime?: number;
}

// Опции API запросов
interface RequestOptions {
  headers?: Record<string, string>;
  body?: any;
  method?: string;
  timeout?: number;
}

export interface LoginResponse extends ApiResponse {
  token?: string;
  refreshToken?: string;
  user?: User;
}

export interface ProfileResponse extends ApiResponse {
  user?: User;
}

// Интерфейс для параметров входа через Farcaster
export interface FarcasterLoginParams {
  fid: number;
  username?: string | undefined;
  displayName?: string | undefined;
  pfp?: string | undefined;
  message?: string | undefined;
  signature?: string | undefined;
}

// Класс для работы с API
class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number;
  
  constructor(baseUrl = '', defaultTimeout = 10000) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = defaultTimeout;
  }
  
  /**
   * Выполняет API запрос с таймаутом и обработкой ошибок
   */
  private async request<T>(
    endpoint: string, 
    options: RequestOptions = {}
  ): Promise<T> {
    const { 
      headers = {}, 
      body, 
      method = 'GET',
      timeout = this.defaultTimeout
    } = options;
    
    // URL для запроса
    const url = `${this.baseUrl}${endpoint}`;
    
    // Настройки запроса
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    // Добавляем тело запроса, если оно есть
    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }
    
    // Создаем контроллер для отмены запроса по таймауту
    const controller = new AbortController();
    fetchOptions.signal = controller.signal;
    
    // Устанавливаем таймаут
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, fetchOptions);
      
      // Очищаем таймаут
      clearTimeout(timeoutId);
      
      // Если запрос не успешен, выбрасываем ошибку
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP error ${response.status}: ${response.statusText}`
        }));
        
        throw new Error(
          errorData.error || 
          errorData.message || 
          `HTTP error ${response.status}: ${response.statusText}`
        );
      }
      
      // Парсим JSON ответ
      const data = await response.json();
      return data as T;
    } catch (error: any) {
      // Очищаем таймаут
      clearTimeout(timeoutId);
      
      // Обрабатываем таймаут
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      // Пробрасываем ошибку дальше
      throw error;
    }
  }
  
  /**
   * Добавляет токен авторизации к заголовкам
   */
  private withAuthToken(token: string, headers: Record<string, string> = {}): Record<string, string> {
    return {
      ...headers,
      'Authorization': `Bearer ${token}`
    };
  }
  
  /**
   * Авторизация пользователя через провайдер
   */
  async login(provider: string, credentials?: any): Promise<LoginResponse> {
    try {
      return await this.request<LoginResponse>(`/api/auth/${provider}`, {
        method: 'POST',
        body: credentials
      });
    } catch (error) {
      console.error(`API error (login/${provider}):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Авторизация пользователя через Farcaster с поддержкой проверки подписи
   */
  async loginWithFarcaster(params: FarcasterLoginParams): Promise<LoginResponse> {
    try {
      // Проверяем обязательные поля
      if (!params.fid) {
        throw new Error('FID обязателен для входа через Farcaster');
      }
      
      console.log('Попытка входа через Farcaster с параметрами:', {
        fid: params.fid,
        username: params.username,
        hasSignature: !!params.signature
      });
      
      return await this.request<LoginResponse>('/api/auth/providers/farcaster', {
        method: 'POST',
        body: params
      });
    } catch (error) {
      console.error('API error (loginWithFarcaster):', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Обновляет токен доступа
   */
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    try {
      return await this.request<LoginResponse>('/api/auth/refresh', {
        method: 'POST',
        body: { refreshToken }
      });
    } catch (error) {
      console.error('API error (refreshToken):', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Получает профиль пользователя
   */
  async getUserProfile(token: string): Promise<ProfileResponse> {
    try {
      return await this.request<ProfileResponse>('/api/users/profile', {
        headers: this.withAuthToken(token)
      });
    } catch (error) {
      console.error('API error (getUserProfile):', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Экспортируем экземпляр API клиента
export const api = new ApiClient(); 