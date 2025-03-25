import { AuthStep } from '../utils/auth-logger';

export interface WarpcastUser {
  fid: number;
  username: string;
  displayName: string | null;
  pfp: string | null;
  address: string | null;
}

export interface AuthState {
  status: AuthStatus;
  user: WarpcastUser | null;
  error: string | null;
  errorDetails?: string;
  debugInfo?: string;
}

export enum AuthStatus {
  INIT = 'INIT',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

// Расширяем Window для поддержки Farcaster Frame SDK
declare global {
  interface Window {
    farcaster?: {
      context: Promise<{
        fid: number;
        username?: string;
        displayName?: string;
        pfp?: string;
        address?: string;
      }>;
    };
  }
}

export { AuthStep }; 