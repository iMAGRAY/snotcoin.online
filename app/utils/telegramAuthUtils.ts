/**
 * Утилиты для работы с аутентификацией через Telegram
 */
import { TelegramWebAppUser, TelegramUser, InitUrlData, ForceLoginData } from '../types/telegramAuth';

/**
 * Парсинг данных из URL или строки initData
 */
export const parseInitData = (urlOrData: string): InitUrlData | null => {
  try {
    // Проверяем есть ли в строке параметры запроса
    let params: URLSearchParams;
    if (urlOrData.includes('?')) {
      // Если это полный URL, извлекаем строку запроса
      const url = new URL(urlOrData);
      const tgWebAppData = url.searchParams.get('tgWebAppData') || 
                          url.searchParams.get('initData') || 
                          url.searchParams.get('web_app_data');
      
      if (tgWebAppData) {
        params = new URLSearchParams(tgWebAppData);
      } else {
        // Используем все параметры URL
        params = url.searchParams;
      }
    } else {
      // Если это уже строка запроса, создаем объект URLSearchParams
      params = new URLSearchParams(urlOrData);
    }

    // Извлекаем все необходимые поля
    const result: InitUrlData = {};

    // Обрабатываем поле user, если оно существует
    const userStr = params.get('user');
    if (userStr) {
      try {
        // Один раз декодируем и парсим объект пользователя
        result.user = JSON.parse(decodeURIComponent(userStr));
      } catch (e) {
        // В случае ошибки парсинга, пробуем без декодирования
        try {
          result.user = JSON.parse(userStr);
        } catch {
          throw new Error('Не удалось распарсить данные пользователя');
        }
      }
    }
    
    // Извлекаем auth_date, hash и signature
    const authDateStr = params.get('auth_date');
    result.auth_date = authDateStr ? parseInt(authDateStr, 10) : undefined;
    
    result.hash = params.get('hash') || undefined;
    result.signature = params.get('signature') || undefined;
    
    // Если у нас есть хотя бы ID пользователя или хеш, возвращаем результат
    if (result.user?.id || result.hash || result.signature) {
      return result;
    }
    
    return null;
  } catch (error) {
    throw new Error(`Ошибка при парсинге initData: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Преобразование TelegramWebAppUser в объект пользователя системы
 */
export const convertToSystemUser = (webAppUser: TelegramWebAppUser): TelegramUser => {
  return {
    id: String(webAppUser.id),
    telegram_id: webAppUser.id,
    username: webAppUser.username,
    first_name: webAppUser.first_name,
    last_name: webAppUser.last_name,
    photo_url: webAppUser.photo_url
  };
};

/**
 * Создание тестовых данных для форсированного входа
 */
export const createForceLoginData = (): ForceLoginData => {
  // Создаем уникальный идентификатор сессии для большей безопасности
  const sessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);
  
  // Создаем тестовые данные пользователя с более уникальным ID
  const testUserId = Math.floor(1000000 + Math.random() * 9000000);
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Данные тестового пользователя
  const testUserData: TelegramWebAppUser = {
    id: testUserId,
    first_name: "Telegram",
    last_name: "User",
    username: `user_${testUserId.toString(36)}`,
    language_code: "ru",
    photo_url: ""
  };
  
  // Создаем подпись для форсированного входа, используя timestamp и sessionId
  const forceLoginHash = btoa(`${sessionId}:${timestamp}:${testUserId}`);
  
  // Создаем initData для форсированного входа
  const params = new URLSearchParams();
  params.append('user', JSON.stringify(testUserData));
  params.append('auth_date', timestamp.toString());
  params.append('hash', forceLoginHash);
  const forcedInitData = params.toString();

  // Возвращаем данные в формате ForceLoginData
  return {
    telegramId: testUserId,
    username: testUserData.username || '',
    first_name: testUserData.first_name,
    last_name: testUserData.last_name || '',
    force_login: true,
    session_id: sessionId,
    userAgent: navigator.userAgent
  };
};

/**
 * Создание строки initData из данных пользователя
 */
export const createInitDataString = (
  user: TelegramWebAppUser,
  authDate?: number,
  hash?: string
): string => {
  const params = new URLSearchParams();
  
  // Добавляем user как JSON
  params.append('user', JSON.stringify(user));
  
  // Добавляем auth_date, используя переданное или текущее время
  params.append('auth_date', String(authDate || Math.floor(Date.now() / 1000)));
  
  // Добавляем hash, если он передан
  if (hash) {
    params.append('hash', hash);
  }
  
  return params.toString();
}; 