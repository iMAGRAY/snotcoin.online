/**
 * API клиент для взаимодействия с серверными эндпоинтами
 */

import { GameState } from '../context/GameContext';
import { User } from '../context/AuthContext';

// Типы ответов
export interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  processingTime?: number;
}

export interface SaveGameResponse extends ApiResponse {
  metrics?: Record<string, any>;
  isBatched?: boolean;
  batchId?: string;
  totalRequests?: number;
}

export interface LoadGameResponse extends ApiResponse {
  data?: {
    gameState: GameState;
    metadata?: Record<string, any>;
  };
}

export interface LoginResponse extends ApiResponse {
  token?: string;
  refreshToken?: string;
  user?: User;
}

export interface ProfileResponse extends ApiResponse {
  user?: User;
}

// Опции API запросов
interface RequestOptions {
  headers?: Record<string, string>;
  body?: any;
  method?: string;
  timeout?: number;
}

interface SaveGameOptions {
  isCritical?: boolean;
  reason?: string;
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
   * Сохраняет прогресс игры
   */
  async saveGameProgress(
    gameState: GameState, 
    fid: string | number,
    options: SaveGameOptions = {}
  ): Promise<SaveGameResponse> {
    try {
      if (!fid) {
        throw new Error('TOKEN_MISSING');
      }
      
      return await this.request<SaveGameResponse>('/api/game/save-progress', {
        method: 'POST',
        headers: {
          'X-Farcaster-User': String(fid)  // Добавляем FID в заголовки
        },
        body: {
          gameState,
          fid: String(fid),
          isCritical: options.isCritical || false,
          reason: options.reason || 'manual'
        }
      });
    } catch (error) {
      console.error('API error (saveGameProgress):', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Загружает прогресс игры
   */
  async loadGameProgress(fid: string | number): Promise<LoadGameResponse> {
    try {
      if (!fid) {
        throw new Error('Требуется авторизация');
      }
      
      return await this.request<LoadGameResponse>(`/api/game/load-progress?fid=${String(fid)}`, {
        headers: {}
      });
    } catch (error) {
      console.error('API error (loadGameProgress):', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Выполняет вход в систему
   */
  async login(provider: string, credentials?: any): Promise<LoginResponse> {
    try {
      return await this.request<LoginResponse>(`/api/auth/${provider}`, {
        method: 'POST',
        body: credentials
      });
    } catch (error) {
      console.error('API error (login):', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Обновляет токен авторизации
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
      return await this.request<ProfileResponse>('/api/user/profile', {
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