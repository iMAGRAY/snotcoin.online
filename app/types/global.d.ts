/**
 * Глобальные расширения интерфейсов для TypeScript
 */

// Расширение интерфейса Window
interface Window {
  /**
   * Глобальное хранилище аутентификации
   */
  authStore?: {
    /** Получает текущий токен аутентификации */
    getAuthToken: () => string | null;
    
    /** Проверяет, аутентифицирован ли пользователь */
    getIsAuthenticated: () => boolean;
    
    /** Устанавливает токен аутентификации */
    setAuthToken: (token: string) => void;
    
    /** Очищает данные аутентификации */
    clearAuthData: () => void;
  };
  
  /**
   * Хранилище данных Farcaster
   */
  farcaster?: {
    getContext: () => Promise<{
      fid: number;
      username: string;
      displayName?: string;
      pfp?: {
        url: string;
        verified: boolean;
      };
      verified?: boolean;
      custody?: {
        address: string;
        type: string;
      };
      verifications?: string[];
    }>;
  };
} 