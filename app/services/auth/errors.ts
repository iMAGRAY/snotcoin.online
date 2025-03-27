import { AuthStep } from '@/app/utils/auth-logger';

/**
 * Класс для ошибок авторизации
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public step: AuthStep,
    public data?: unknown
  ) {
    super(message);
    this.name = 'AuthError';
  }
} 