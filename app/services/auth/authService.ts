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
      this.storage.set(AUTH_STORAGE_KEYS.TOKEN, userData.fid.toString());
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
   * Получает текущий JWT-токен
   * @returns {string|null} Токен или null, если токен не найден
   */
  public getToken(): string | null {
    try {
      if (typeof window === 'undefined') {
        return null;
      }
      
      // Сначала пробуем получить через StorageManager
      let token: string | null = null;
      
      // Получаем токен из StorageManager и приводим к строке
      const storageToken = this.storage.get(AUTH_STORAGE_KEYS.TOKEN);
      if (storageToken && typeof storageToken === 'string') {
        token = storageToken;
      }
      
      // Если не получилось, пробуем напрямую из localStorage
      if (!token) {
        token = localStorage.getItem('auth_token');
        
        // Если нашли в localStorage, но не нашли через StorageManager,
        // синхронизируем с StorageManager
        if (token) {
          console.log('[authService] Токен найден в localStorage, но не в StorageManager, синхронизируем');
          this.storage.set(AUTH_STORAGE_KEYS.TOKEN, token);
        } else {
          console.log('[authService] Токен авторизации не найден в localStorage');
          
          // Создаем временный анонимный токен, если не найден обычный токен
          if (typeof localStorage !== 'undefined') {
            // Проверяем, есть ли user_id или game_id в localStorage
            const userId = localStorage.getItem('user_id') || localStorage.getItem('game_id');
            
            if (userId) {
              // Создаем временный токен на основе userId
              const tempToken = `temp_${userId}_${Date.now()}`;
              console.log('[authService] Создан временный токен на основе userId:', userId);
              
              // Убеждаемся, что оба ID синхронизированы
              this.syncUserAndGameIds(userId);
              
              // Сохраняем временный токен
              localStorage.setItem('auth_token', tempToken);
              this.storage.set(AUTH_STORAGE_KEYS.TOKEN, tempToken);
              
              return tempToken;
            }
          }
          
          return null;
        }
      }
      
      // Проверяем валидность токена
      if (token.trim() === '' || token === 'undefined' || token === 'null') {
        console.error('[authService] Найден невалидный токен', token);
        localStorage.removeItem('auth_token'); // Удаляем невалидный токен
        this.storage.remove(AUTH_STORAGE_KEYS.TOKEN);
        return null;
      }
      
      return token;
    } catch (error) {
      console.error('[authService] Ошибка при получении токена:', error);
      return null;
    }
  }
  
  /**
   * Сохраняет JWT-токен
   * @param {string} token JWT-токен для сохранения
   */
  public saveToken(token: string): void {
    try {
      if (!token || token.trim() === '') {
        console.error('[authService] Попытка сохранить пустой токен');
        return;
      }
      
      // Сохраняем через StorageManager
      this.storage.set(AUTH_STORAGE_KEYS.TOKEN, token);
      
      // Дополнительно сохраняем напрямую в localStorage для гарантии
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('auth_token', token);
        console.log('[authService] Токен успешно сохранен в localStorage и StorageManager');
      }
    } catch (error) {
      // В случае ошибки с StorageManager, пробуем сохранить напрямую
      console.error('[authService] Ошибка при сохранении токена через StorageManager:', error);
      
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('auth_token', token);
          console.log('[authService] Токен сохранен напрямую в localStorage после ошибки');
        }
      } catch (directError) {
        console.error('[authService] Критическая ошибка при сохранении токена:', directError);
        throw new Error('Не удалось сохранить токен авторизации');
      }
    }
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

      // Создаем JWT токен локально
      const payload = {
        userId: user.id,
        fid: user.fid,
        username: user.username,
        displayName: user.displayName
      };

      // Генерируем JWT токен с помощью функции sign из jsonwebtoken
      // В реальном приложении это должен делать сервер, но для локального использования
      // создаем временный токен
      const token = this.generateLocalToken(payload);
      this.storage.set(AUTH_STORAGE_KEYS.TOKEN, token);
      
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
   * Генерирует локальный JWT токен (для offline использования)
   */
  private generateLocalToken(payload: any): string {
    // Временный локальный секрет (в реальном приложении токены должны генерироваться сервером)
    const tempSecret = 'local_jwt_secret_' + new Date().toISOString().split('T')[0];
    
    // Добавляем срок действия токена (24 часа)
    const expiresIn = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
    
    // Создаем структуру JWT вручную
    const header = this.safeBase64Encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const data = this.safeBase64Encode(JSON.stringify({ ...payload, exp: expiresIn }));
    
    // Создаем подпись (в настоящем JWT это должно быть криптографически безопасно)
    // Здесь просто для имитации структуры JWT
    const signature = this.safeBase64Encode(tempSecret + '_' + header + '_' + data);
    
    return `${header}.${data}.${signature}`;
  }

  /**
   * Безопасный метод для кодирования строки в Base64
   */
  private safeBase64Encode(str: string): string {
    // Проверяем, что мы в браузере (где доступен btoa)
    if (typeof btoa === 'function') {
      return btoa(str);
    }
    
    // Для Node.js или других сред, где btoa недоступна
    // Используем Buffer
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str).toString('base64');
    }
    
    // Если ни один метод не доступен, возвращаем исходную строку
    console.warn('Не удалось закодировать строку в Base64');
    return str;
  }

  /**
   * Безопасный метод для декодирования Base64 в строку
   */
  private safeBase64Decode(str: string): string {
    // Проверяем, что мы в браузере (где доступен atob)
    if (typeof atob === 'function') {
      return atob(str);
    }
    
    // Для Node.js или других сред, где atob недоступна
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'base64').toString();
    }
    
    // Если ни один метод не доступен, возвращаем исходную строку
    console.warn('Не удалось декодировать строку из Base64');
    return str;
  }

  /**
   * Проверка срока действия токена
   */
  public validateTokenExpiration(token: string): boolean {
    if (!token) return false;
    
    // Проверяем старый формат токена
    if (token.startsWith('farcaster_')) {
      const parts = token.split('_');
      if (parts.length !== 3) return true; // Старый формат токена считаем валидным
      
      const timestamp = parts[2] ? parseInt(parts[2]) : 0;
      if (isNaN(timestamp)) return false;
      
      // Токен валиден 24 часа
      return Date.now() - timestamp < 24 * 60 * 60 * 1000;
    }
    
    // Проверяем JWT формат
    try {
      // Если токен в формате JWT (header.payload.signature)
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      
      // Декодируем payload (проверяем, что parts[1] существует)
      const payloadPart = parts[1] || '';
      const payload = JSON.parse(this.safeBase64Decode(payloadPart));
      
      // Проверяем срок действия
      if (payload.exp) {
        return payload.exp * 1000 > Date.now();
      }
      
      return true;
    } catch (e) {
      console.error('Ошибка при проверке срока действия токена:', e);
      return false;
    }
  }

  /**
   * Декодирование токена
   */
  public decodeToken(token: string): UserData | null {
    if (!token) return null;
    
    // Для старого формата токена
    if (token.startsWith('farcaster_')) {
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
    
    // Для JWT формата
    try {
      // Если токен в формате JWT
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      // Декодируем payload (проверяем, что parts[1] существует)
      const payloadPart = parts[1] || '';
      const payload = JSON.parse(this.safeBase64Decode(payloadPart));
      
      // Проверяем наличие необходимых полей
      if (!payload.userId) {
        return null;
      }
      
      // Используем данные из payload или из localStorage
      const user = this.getCurrentUser();
      
      return {
        id: payload.userId,
        username: payload.username || (user?.username || ''),
        fid: payload.fid || (user?.fid || 0),
        displayName: payload.displayName || (user?.displayName || ''),
        avatar: user?.avatar || '',
        verified: user?.verified || false,
        metadata: user?.metadata || {}
      };
    } catch (e) {
      console.error('Ошибка при декодировании токена:', e);
      return null;
    }
  }

  /**
   * Сохраняет данные пользователя в локальное хранилище
   */
  public saveUserData(userData: any): void {
    try {
      if (!userData) {
        console.error('[authService] Попытка сохранить пустые данные пользователя');
        return;
      }
      
      // Сохраняем данные в localStorage
      localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(userData));
      
      // Если есть id пользователя, сохраняем его как user_id
      if (userData.id) {
        // Формируем user_id из auth_provider и id
        const authProvider = userData.auth_provider || 'farcaster';
        const userId = `${authProvider}_${userData.id}`;
        
        // Проверяем, есть ли уже game_id в localStorage
        const existingGameId = localStorage.getItem('game_id');
        
        // Сохраняем как user_id
        localStorage.setItem('user_id', userId);
        console.log(`[authService] Обновлен user_id: ${userId}`);
        
        // Если game_id отличается от user_id или отсутствует, также обновляем его
        if (!existingGameId || existingGameId !== userId) {
          localStorage.setItem('game_id', userId);
          console.log(`[authService] Обновлен game_id для согласованности: ${userId}`);
        }
      }
      
      console.log('[authService] Данные пользователя успешно сохранены');
    } catch (error) {
      console.error('[authService] Ошибка при сохранении данных пользователя:', error);
    }
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

  /**
   * Синхронизирует идентификаторы пользователя и игры
   * @param {string} userId Идентификатор пользователя
   */
  public syncUserAndGameIds(userId: string): void {
    if (!userId) {
      console.error('[authService] Попытка синхронизировать пустой userId');
      return;
    }
    
    try {
      if (typeof localStorage !== 'undefined') {
        // Получаем текущие значения
        const currentUserId = localStorage.getItem('user_id');
        const currentGameId = localStorage.getItem('game_id');
        
        // Принимаем решение, что игровой ID имеет приоритет при отсутствии явного user_id
        const priorityId = currentUserId || currentGameId || userId;
        
        // Синхронизируем оба ID
        localStorage.setItem('user_id', priorityId);
        localStorage.setItem('game_id', priorityId);
        
        console.log(`[authService] Синхронизированы ID: user_id=${priorityId}, game_id=${priorityId}`);
        
        // Если токен отсутствует, но есть ID, создаем временный токен
        // Вместо простой строки, которая не пройдет валидацию на сервере, создаем
        // специальный локальный токен, который будет использоваться только для
        // анонимных пользователей и не будет отправляться на сервер
        if (!localStorage.getItem('auth_token')) {
          const localToken = `local_${priorityId}_${Date.now()}`;
          localStorage.setItem('auth_token', localToken);
          this.storage.set(AUTH_STORAGE_KEYS.TOKEN, localToken);
          console.log(`[authService] Создан локальный токен авторизации: ${localToken}`);
          
          // Устанавливаем флаг, что это локальный токен
          localStorage.setItem('auth_token_type', 'local');
        }
      }
    } catch (error) {
      console.error('[authService] Ошибка при синхронизации идентификаторов:', error);
    }
  }
}

export const authService = new AuthService(); 