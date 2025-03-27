import { AuthState, AuthResult, UserData, AuthOptions } from '@/app/types/auth';
import { FarcasterContext } from '@/app/types/farcaster';
import { logAuth, AuthStep, AuthLogType } from '@/app/utils/auth-logger';
import { StorageManager } from './storage';
import { 
  AUTH_STORAGE_KEYS, 
  FARCASTER_CONSTANTS, 
  SafeUser, 
  isErrorWithCode, 
  isSafeUser,
  ApiResponse 
} from '@/app/types/utils';

/**
 * Класс для работы с авторизацией
 */
class AuthService {
  private currentState: AuthState = AuthState.IDLE;
  private controller: AbortController | null = null;
  private storage: StorageManager;

  constructor() {
    this.storage = new StorageManager();
  }

  /**
   * Получить текущее состояние авторизации
   */
  public getState(): AuthState {
    return this.currentState;
  }

  /**
   * Создать контроллер для отмены операций
   */
  private createController(timeout?: number): AbortController {
    const controller = new AbortController();
    if (timeout) {
      setTimeout(() => controller.abort(), timeout);
    }
    return controller;
  }

  /**
   * Авторизация через Farcaster
   */
  public async loginWithFarcaster(
    userData: FarcasterContext,
    options: AuthOptions = {}
  ): Promise<AuthResult<{ user: SafeUser }>> {
    try {
      this.currentState = AuthState.AUTHENTICATING;
      
      // Создаем контроллер для отмены операции
      this.controller = this.createController(
        options.timeout || FARCASTER_CONSTANTS.TIMEOUTS.AUTH
      );
      
      logAuth(
        AuthStep.AUTH_START,
        AuthLogType.INFO,
        'Начало авторизации через Farcaster',
        { fid: userData.fid }
      );

      // Проверяем отмену операции
      if (this.controller.signal.aborted) {
        throw new Error('AUTH_CANCELLED');
      }

      // Валидация данных пользователя
      if (!userData.fid || !userData.username) {
        throw new Error('INVALID_USER_DATA');
      }

      // Преобразуем данные в формат UserData
      const user: UserData = {
        id: userData.fid.toString(),
        username: userData.username,
        fid: userData.fid,
        displayName: userData.displayName,
        avatar: userData.pfp?.url,
        verified: userData.verified,
        metadata: {
          custody: userData.custody,
          verifications: userData.verifications
        }
      };

      // Проверяем, что у нас есть все необходимые данные
      if (!isSafeUser(user)) {
        throw new Error('INVALID_USER_DATA');
      }

      // Сохраняем данные
      this.storage.set(AUTH_STORAGE_KEYS.TOKEN, `farcaster_${userData.fid}`);
      this.storage.set(AUTH_STORAGE_KEYS.USER, user);

      this.currentState = AuthState.SUCCESS;
      
      logAuth(
        AuthStep.AUTH_COMPLETE,
        AuthLogType.INFO,
        'Авторизация успешно завершена',
        { userId: user.id }
      );

      return {
        success: true,
        data: { user }
      };
    } catch (error) {
      this.currentState = AuthState.ERROR;
      
      const errorData = isErrorWithCode(error) 
        ? error 
        : { 
            code: 'UNKNOWN_ERROR',
            message: error instanceof Error ? error.message : 'Неизвестная ошибка'
          };
      
      logAuth(
        AuthStep.AUTH_ERROR,
        AuthLogType.ERROR,
        'Ошибка при авторизации',
        { errorCode: errorData.code },
        error
      );

      return {
        success: false,
        error: errorData.message,
        errorCode: errorData.code
      };
    } finally {
      // Очищаем контроллер
      this.controller = null;
    }
  }

  /**
   * Выход из системы
   */
  public async logout(): Promise<AuthResult<void>> {
    try {
      logAuth(AuthStep.LOGOUT_START, AuthLogType.INFO, 'Начало выхода из системы');

      // Очищаем данные авторизации
      this.storage.clear();
      this.currentState = AuthState.IDLE;
      
      logAuth(AuthStep.LOGOUT_COMPLETE, AuthLogType.INFO, 'Выход успешно завершен');

      return { success: true };
    } catch (error) {
      const errorData = isErrorWithCode(error)
        ? error
        : {
            code: 'LOGOUT_ERROR',
            message: error instanceof Error ? error.message : 'Ошибка при выходе из системы'
          };
      
      logAuth(
        AuthStep.LOGOUT_ERROR,
        AuthLogType.ERROR,
        'Ошибка при выходе из системы',
        { errorCode: errorData.code },
        error
      );

      return {
        success: false,
        error: errorData.message,
        errorCode: errorData.code
      };
    }
  }

  /**
   * Проверка авторизации
   */
  public isAuthenticated(): boolean {
    return this.storage.get(AUTH_STORAGE_KEYS.TOKEN) !== null;
  }

  /**
   * Получение данных текущего пользователя
   */
  public getCurrentUser(): SafeUser | null {
    const userData = this.storage.get<UserData>(AUTH_STORAGE_KEYS.USER);
    return userData && isSafeUser(userData) ? userData : null;
  }

  /**
   * Отмена текущей операции авторизации
   */
  public cancelAuth(): void {
    if (this.controller) {
      this.controller.abort();
      this.currentState = AuthState.ERROR;
      logAuth(AuthStep.AUTH_CANCEL, AuthLogType.INFO, 'Операция авторизации отменена');
    }
  }

  /**
   * Получение токена авторизации
   */
  public getToken(): string | null {
    return this.storage.get(AUTH_STORAGE_KEYS.TOKEN);
  }

  /**
   * Получение ID пользователя
   */
  public getUserId(): string | null {
    const user = this.getCurrentUser();
    return user?.id || null;
  }

  /**
   * Получение пользователя из токена
   */
  public getUserFromToken(): SafeUser | null {
    const token = this.getToken();
    if (!token) return null;
    
    const userData = this.decodeToken(token);
    return userData && isSafeUser(userData) ? userData : null;
  }

  /**
   * Обновление токена
   */
  public async refreshToken(): Promise<boolean> {
    try {
      const user = this.getCurrentUser();
      if (!user) return false;

      // В данной реализации мы просто обновляем timestamp токена
      const newToken = `farcaster_${user.fid}_${Date.now()}`;
      this.storage.set(AUTH_STORAGE_KEYS.TOKEN, newToken);
      
      return true;
    } catch (error) {
      logAuth(
        AuthStep.TOKEN_REFRESH_ERROR,
        AuthLogType.ERROR,
        'Ошибка при обновлении токена',
        {},
        error
      );
      return false;
    }
  }

  /**
   * Проверка срока действия токена
   */
  public validateTokenExpiration(token: string): boolean {
    if (!token.startsWith('farcaster_')) return false;
    
    const parts = token.split('_');
    if (parts.length !== 3) return true; // Старый формат токена считаем валидным
    
    const timestamp = parts[2] ? parseInt(parts[2]) : 0;
    if (isNaN(timestamp)) return false;
    
    // Токен валиден 24 часа
    return Date.now() - timestamp < 24 * 60 * 60 * 1000;
  }

  /**
   * Декодирование токена
   */
  public decodeToken(token: string): UserData | null {
    if (!token.startsWith('farcaster_')) return null;
    
    const user = this.getCurrentUser();
    if (!user) return null;
    
    return {
      id: user.id,
      username: user.username,
      fid: user.fid,
      displayName: user.displayName,
      avatar: user.avatar,
      verified: user.verified,
      metadata: user.metadata
    };
  }

  /**
   * Сохранение данных пользователя
   */
  public saveUserData(userData: SafeUser): void {
    this.storage.set(AUTH_STORAGE_KEYS.USER, userData);
  }

  /**
   * Установка состояния аутентификации
   */
  public setAuthenticated(value: boolean): void {
    if (!value) {
      this.storage.clear();
      this.currentState = AuthState.IDLE;
    } else {
      this.currentState = AuthState.SUCCESS;
    }
  }
}

export const authService = new AuthService(); 