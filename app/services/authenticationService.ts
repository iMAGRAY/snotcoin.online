/**
 * Сервис для работы с аутентификацией через Telegram
 */

import { TelegramWebAppUser, TelegramUser, ForceLoginData } from '../types/telegramAuth';

// Интерфейс результата аутентификации
interface AuthResult {
  success: boolean;
  user?: TelegramUser;
  token?: string;
  error?: string;
  errorDetails?: string;
}

/**
 * Устанавливает токен Supabase в localStorage
 */
export const setSupabaseToken = async (token: string): Promise<void> => {
  localStorage.setItem('supabase_token', token);
  return Promise.resolve();
};

/**
 * Аутентификация через Telegram
 */
export const authenticateWithTelegram = async (
  initData: string,
  telegramId?: number,
  authDate?: number
): Promise<AuthResult> => {
  try {
    // Проверяем доступность fetch API
    if (!fetch) {
      throw new Error("Fetch API не поддерживается браузером");
    }

    // Отправляем запрос на аутентификацию
    const response = await fetch("/api/auth/telegram", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Telegram-Auth": "true"
      },
      body: JSON.stringify({ 
        initData,
        telegramId,
        auth_date: authDate || Math.floor(Date.now() / 1000),
        dev_mode: process.env.NODE_ENV === 'development'
      })
    });
    
    // Получаем данные ответа
    const data = await response.json();
    
    // Если был получен ошибочный ответ
    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Ошибка сервера: ${response.status}`,
        errorDetails: data.details || JSON.stringify(data)
      };
    }
    
    // Если был получен токен - сохраняем его
    if (data.token) {
      await setSupabaseToken(data.token);
    }
    
    // Создаем объект пользователя
    const user: TelegramUser = {
      id: String(data.user.id),
      telegram_id: Number(data.user.telegram_id),
      username: data.user.username,
      first_name: data.user.first_name,
      last_name: data.user.last_name,
      photo_url: data.user.photo_url
    };
    
    return {
      success: true,
      user,
      token: data.token
    };
  } catch (error) {
    return {
      success: false,
      error: `Ошибка аутентификации: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Аутентификация с форсированным входом (для тестирования)
 */
export const authenticateWithForceLogin = async (userData: ForceLoginData): Promise<AuthResult> => {
  try {
    // Создаем initData для форсированного входа
    const testUserData: TelegramWebAppUser = {
      id: userData.telegramId,
      first_name: userData.first_name,
      last_name: userData.last_name,
      username: userData.username,
      language_code: "ru"
    };
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Формируем initData как параметры URL
    const params = new URLSearchParams();
    params.append('user', JSON.stringify(testUserData));
    params.append('auth_date', timestamp.toString());
    params.append('hash', btoa(`${userData.session_id}:${timestamp}:${userData.telegramId}`));
    const forcedInitData = params.toString();
    
    // Отправляем запрос на авторизацию
    const response = await fetch("/api/auth/telegram", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Telegram-Auth": "true",
        "X-Force-Login": "true",
        "X-Dev-Mode": "true"
      },
      body: JSON.stringify({
        initData: forcedInitData,
        telegramId: userData.telegramId,
        username: userData.username,
        first_name: userData.first_name,
        last_name: userData.last_name,
        auth_date: timestamp,
        force_login: true,
        session_id: userData.session_id,
        userAgent: userData.userAgent || navigator.userAgent,
        dev_mode: true
      })
    });
    
    // Получаем данные ответа
    const data = await response.json();
    
    // Если был получен ошибочный ответ
    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Ошибка сервера: ${response.status}`,
        errorDetails: data.details || JSON.stringify(data)
      };
    }
    
    // Если был получен токен - сохраняем его
    if (data.token) {
      await setSupabaseToken(data.token);
    }
    
    // Создаем объект пользователя
    const user: TelegramUser = {
      id: String(data.user.id),
      telegram_id: Number(data.user.telegram_id),
      username: data.user.username,
      first_name: data.user.first_name,
      last_name: data.user.last_name,
      photo_url: data.user.photo_url || ""
    };
    
    return {
      success: true,
      user,
      token: data.token
    };
  } catch (error) {
    return {
      success: false,
      error: `Ошибка при форсированном входе: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}; 