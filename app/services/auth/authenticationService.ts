/**
 * Получает JWT токен из localStorage или глобального хранилища
 * @returns Токен JWT или null
 */
export function getToken(): string | null {
  try {
    // Предотвращение рекурсии
    if (preventRecursion) {
      return null;
    }
    
    preventRecursion = true;
    
    try {
      // Сначала проверяем наличие глобального хранилища
      if (typeof window !== 'undefined' && window.authStore) {
        // Используем напрямую localStorage в этой функции вместо вызова authStore.getAuthToken
        const token = window.localStorage.getItem('auth_token');
        if (token) {
          const isValid = validateTokenExpiration(token);
          return isValid ? token : null;
        }
      }
      
      // Затем проверяем localStorage
      if (typeof window !== 'undefined') {
        const token = window.localStorage.getItem('auth_token');
        if (token) {
          const isValid = validateTokenExpiration(token);
          return isValid ? token : null;
        }
      }
      
      return null;
    } finally {
      preventRecursion = false;
    }
  } catch (error) {
    preventRecursion = false;
    console.error('[AuthService] Ошибка при получении токена', error);
    return null;
  }
}

// Флаг для предотвращения рекурсии
let preventRecursion = false;

/**
 * Проверяет срок действия токена и пытается обновить его, если истек
 * @param token JWT токен
 * @returns true если токен действителен, иначе false
 */
function validateTokenExpiration(token: string): boolean {
  try {
    // Декодируем токен
    const base64Url = token.split('.')[1];
    if (!base64Url) return false;
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const payload = JSON.parse(jsonPayload);
    
    // Проверяем срок действия
    if (payload.exp) {
      const currentTime = Math.floor(Date.now() / 1000);
      // Добавляем 5-секундный буфер для предотвращения граничных случаев
      if (payload.exp < currentTime + 5) {
        console.warn('[AuthService] Токен истек или истекает в ближайшие 5 секунд, требуется обновление');
        
        // Асинхронно запускаем обновление токена без ожидания результата
        setTimeout(() => {
          refreshToken().catch(e => 
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
 * Сохраняет JWT токен в localStorage и глобальном хранилище
 * @param token Токен JWT
 */
export function saveToken(token: string): void {
  try {
    if (typeof window !== 'undefined') {
      // Предотвращаем сохранение невалидных токенов
      if (!token) {
        console.warn('[AuthService] Попытка сохранить пустой токен');
        return;
      }
      
      // Сохраняем в глобальном хранилище, если доступно
      if (window.authStore) {
        window.authStore.setAuthToken(token);
        console.log('[AuthService] Токен сохранен в глобальном хранилище');
      }
      
      // Сохраняем в localStorage
      window.localStorage.setItem('auth_token', token);
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
export async function refreshToken(): Promise<boolean> {
  try {
    // Проверяем, не выполняется ли уже обновление
    if (refreshInProgress) {
      console.log('[AuthService] Пропуск запроса - обновление токена уже выполняется');
      return refreshPromise || false;
    }
    
    console.log('[AuthService] Запрос на обновление токена');
    
    // Устанавливаем флаг выполнения обновления
    refreshInProgress = true;
    
    // Создаем новый промис для отслеживания результата
    refreshPromise = new Promise<boolean>(async (resolve, reject) => {
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
            saveToken(data.token);
            
            // Если получены данные пользователя, сохраняем их
            if (data.user && data.user.id) {
              saveUserId(data.user.id);
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
        refreshInProgress = false;
        refreshPromise = false;
      }
    });
    
    return refreshPromise;
  } catch (error) {
    console.error('[AuthService] Критическая ошибка при обновлении токена', error);
    refreshInProgress = false;
    refreshPromise = false;
    return false;
  }
}

// Состояние процесса обновления токена
let refreshInProgress = false;
let refreshPromise: Promise<boolean> | boolean = false;

/**
 * Удаляет JWT токен из localStorage и глобального хранилища
 */
export function removeToken(): void {
  try {
    if (typeof window !== 'undefined') {
      // Удаляем из глобального хранилища, если доступно
      if (window.authStore) {
        window.authStore.clearAuthData();
        console.log('[AuthService] Токен удален из глобального хранилища');
      }
      
      // Удаляем из localStorage
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
    if (!userId) {
      console.warn('[AuthService] Попытка сохранить пустой ID пользователя');
      return;
    }
    
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
  // Проверяем наличие и валидность токена
  const token = getToken();
  // Проверяем наличие ID пользователя
  const userId = getUserId();
  
  return token !== null && userId !== null;
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
      
      // Дополнительно сделаем запрос на сервер для инвалидации refresh токена
      fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      }).catch(e => console.error('[AuthService] Ошибка при запросе логаута на сервер', e));
    }
  } catch (error) {
    console.error('[AuthService] Ошибка при выходе пользователя', error);
  }
} 