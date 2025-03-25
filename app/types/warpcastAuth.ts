import { AuthStep } from '../utils/auth-logger';

/**
 * Тип пользователя Warpcast
 */
export interface WarpcastUser {
  fid: number;
  username: string;
  displayName: string | null;
  pfp: string | null;
  address: string | null;
}

/**
 * Состояние авторизации
 */
export interface AuthState {
  status: AuthStatus;
  user: WarpcastUser | null;
  error: string | null;
  errorDetails?: string;
  debugInfo?: any;
}

/**
 * Статусы авторизации
 */
export enum AuthStatus {
  INIT = 'INIT',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

/**
 * Шаги авторизации
 */
export enum WarpcastAuthStep {
  WARPCAST_INIT = 'WARPCAST_INIT',
  WARPCAST_VERIFY = 'WARPCAST_VERIFY',
  WARPCAST_SUCCESS = 'WARPCAST_SUCCESS',
  WARPCAST_ERROR = 'WARPCAST_ERROR'
}

// Реэкспорт из auth-logger для обратной совместимости
export { AuthStep };

// Определение типов для Farcaster SDK
declare global {
  interface Window {
    farcaster?: {
      getContext: () => Promise<{
        fid: number;
        url: string;
        domain: string;
        verified: boolean;
        custody: {
          address: string;
          type: string;
        };
        username: string;
        displayName: string;
        pfp: {
          url: string;
          verified: boolean;
        };
      }>;
      fetchUserByFid?: (fid: number) => Promise<any>;
      publishCast?: (text: string) => Promise<any>;
    };
  }
} 