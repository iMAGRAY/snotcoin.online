/**
 * Получает JWT токен из localStorage
 * @returns Токен JWT или null
 */
export function getToken(): string | null {
  try {
    if (typeof window !== 'undefined') {
      const token = window.localStorage.getItem('auth_token');
      return token;
    }
    return null;
  } catch (error) {
    console.error('[AuthService] Получен токен из localStorage', error);
    return null;
  }
}

/**
 * Сохраняет JWT токен в localStorage
 * @param token Токен JWT
 */
export function saveToken(token: string): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('auth_token', token);
      console.log('[AuthService] Токен сохранен в localStorage');
    }
  } catch (error) {
    console.error('[AuthService] Ошибка при сохранении токена в localStorage', error);
  }
}

/**
 * Удаляет JWT токен из localStorage
 */
export function removeToken(): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('auth_token');
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
export function saveUserId(userId: string): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('user_id', userId);
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
export function getUserId(): string | null {
  try {
    if (typeof window !== 'undefined') {
      const userId = window.localStorage.getItem('user_id');
      return userId;
    }
    return null;
  } catch (error) {
    console.error('[AuthService] Ошибка при получении ID пользователя из localStorage', error);
    return null;
  }
}

/**
 * Проверяет, авторизован ли пользователь
 * @returns true если пользователь авторизован, иначе false
 */
export function isAuthenticated(): boolean {
  return getToken() !== null && getUserId() !== null;
}

/**
 * Выполняет выход пользователя (очистка данных авторизации)
 */
export function logout(): void {
  try {
    if (typeof window !== 'undefined') {
      removeToken();
      window.localStorage.removeItem('user_id');
      console.log('[AuthService] Пользователь вышел из системы');
    }
  } catch (error) {
    console.error('[AuthService] Ошибка при выходе пользователя', error);
  }
} 