/**
 * Утилита для кеширования аутентификации Telegram
 * Предотвращает циклические вызовы аутентификации
 */

// Флаг, указывающий, что аутентификация уже была выполнена
let isAuthenticated = false;

// Хранит ID последнего аутентифицированного пользователя
let lastAuthenticatedUserId: number | null = null;

/**
 * Проверяет, был ли пользователь уже аутентифицирован
 */
export const isUserAuthenticated = (): boolean => {
  return isAuthenticated;
};

/**
 * Помечает пользователя как аутентифицированного
 */
export const markUserAuthenticated = (telegramId: number): void => {
  isAuthenticated = true;
  lastAuthenticatedUserId = telegramId;
};

/**
 * Проверяет, соответствует ли ID текущего пользователя последнему аутентифицированному
 */
export const isSameAuthenticatedUser = (telegramId: number): boolean => {
  return telegramId === lastAuthenticatedUserId;
};

/**
 * Сбрасывает состояние аутентификации
 */
export const resetAuthentication = (): void => {
  isAuthenticated = false;
  lastAuthenticatedUserId = null;
}; 