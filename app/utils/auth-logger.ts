/**
 * Утилита для расширенного логирования процесса авторизации
 * Обеспечивает единый подход к логированию на клиенте и сервере
 */

import { v4 as uuidv4 } from 'uuid';

// Типы логов авторизации
export enum AuthLogType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

// Типы шагов авторизации
export enum AuthStep {
  INIT = 'INIT',
  LOGIN_INIT = 'LOGIN_INIT',
  LOGOUT = 'LOGOUT',
  WARPCAST_INIT = 'WARPCAST_INIT',
  WARPCAST_VERIFY = 'WARPCAST_VERIFY',
  WARPCAST_SUCCESS = 'WARPCAST_SUCCESS',
  WARPCAST_ERROR = 'WARPCAST_ERROR',
  USER_INTERACTION = 'USER_INTERACTION',
  AUTH_COMPLETE = 'AUTH_COMPLETE',
  AUTH_ERROR = 'AUTH_ERROR',
  TOKEN_RECEIVED = 'TOKEN_RECEIVED',
  // Telegram specific steps
  TELEGRAM_INIT = 'TELEGRAM_INIT',
  TELEGRAM_VERIFY = 'TELEGRAM_VERIFY',
  TELEGRAM_SUCCESS = 'TELEGRAM_SUCCESS',
  TELEGRAM_ERROR = 'TELEGRAM_ERROR',
  TELEGRAM_WEB_APP_DATA = 'TELEGRAM_WEB_APP_DATA',
  TELEGRAM_VERIFY_DATA = 'TELEGRAM_VERIFY_DATA',
  // Server steps
  SERVER_REQUEST = 'SERVER_REQUEST',
  SERVER_RESPONSE = 'SERVER_RESPONSE',
  SERVER_ERROR = 'SERVER_ERROR',
  // Database steps
  DATABASE_QUERY = 'DATABASE_QUERY',
  // User steps
  USER_CREATED = 'USER_CREATED',
  // Token steps
  TOKEN_GENERATED = 'TOKEN_GENERATED',
  // Validation steps
  VALIDATE_TELEGRAM = 'VALIDATE_TELEGRAM',
  // Auth retry
  AUTH_RETRY = 'AUTH_RETRY'
}

// Интерфейс записи лога
export interface AuthLogEntry {
  timestamp: string;
  sessionId: string;
  userId?: number | string;
  step: AuthStep;
  type: AuthLogType;
  message: string;
  data?: any;
  error?: any;
  clientInfo?: {
    userAgent?: string;
    platform?: string;
    screenSize?: string;
    language?: string;
    referrer?: string;
  };
  serverInfo?: {
    endpoint?: string;
    method?: string;
    statusCode?: number;
    responseTime?: number;
    serverName?: string;
  };
}

// Хранилище для сессионных ID
let currentSessionId: string | null = null;
let currentUserId: string | null = null;

/**
 * Создает или возвращает существующий ID сессии
 */
export function getSessionId(): string {
  if (!currentSessionId) {
    try {
      // Пытаемся восстановить sessionId из localStorage на клиенте
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedSessionId = localStorage.getItem('auth_session_id');
        if (storedSessionId) {
          currentSessionId = storedSessionId;
        } else {
          currentSessionId = `session_${uuidv4()}`;
          localStorage.setItem('auth_session_id', currentSessionId);
        }
      } else {
        // На сервере или если localStorage недоступен
        currentSessionId = `session_${uuidv4()}`;
      }
    } catch (e) {
      // Если произошла ошибка, создаем новый ID
      currentSessionId = `session_${uuidv4()}`;
    }
  }
  
  return currentSessionId;
}

/**
 * Устанавливает ID пользователя для логов
 */
export const setUserId = (userId: string) => {
  currentUserId = userId;
};

/**
 * Получает сохраненный ID пользователя
 */
export function getUserId(): string | null {
  return currentUserId;
}

/**
 * Сбрасывает текущую сессию
 */
export function resetSession(): void {
  currentSessionId = null;
  currentUserId = null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('auth_session_id');
    }
  } catch (e) {
    // Игнорируем ошибки localStorage
  }
}

/**
 * Собирает информацию о клиенте
 */
function getClientInfo(): AuthLogEntry['clientInfo'] | undefined {
  if (typeof window === 'undefined') return undefined;
  
  try {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language,
      referrer: document.referrer
    };
  } catch (e) {
    return undefined;
  }
}

/**
 * Обрабатывает объект ошибки для логирования
 */
function processError(error: any): any {
  if (!error) return undefined;
  
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error as any).code && { code: (error as any).code },
      ...(error as any).status && { status: (error as any).status }
    };
  }
  
  if (typeof error === 'object') {
    try {
      // Удаляем циклические ссылки для безопасной сериализации
      return JSON.parse(JSON.stringify(error));
    } catch (e) {
      return { message: String(error) };
    }
  }
  
  return { message: String(error) };
}

const getLogPrefix = (step: AuthStep, type: AuthLogType) => {
  const timestamp = new Date().toISOString();
  const userId = currentUserId ? `[User: ${currentUserId}]` : '';
  return `[${timestamp}] [${step}] [${type}] ${userId}`;
};

/**
 * Основная функция логирования
 */
export const logAuth = (step: AuthStep, type: AuthLogType, message: string, data?: any) => {
  const prefix = getLogPrefix(step, type);
  const logMessage = `${prefix} ${message}`;
  
  switch (type) {
    case AuthLogType.ERROR:
      console.error(logMessage, data || '');
      break;
    case AuthLogType.WARNING:
      console.warn(logMessage, data || '');
      break;
    case AuthLogType.DEBUG:
      console.debug(logMessage, data || '');
      break;
    default:
      console.log(logMessage, data || '');
  }
};

/**
 * Вспомогательные функции для разных типов логов
 */
export const logAuthInfo = (step: AuthStep, message: string, data?: any) => {
  logAuth(step, AuthLogType.INFO, message, data);
};

export const logAuthWarning = (step: AuthStep, message: string, data?: any) => {
  logAuth(step, AuthLogType.WARNING, message, data);
};

export const logAuthError = (step: AuthStep, message: string, error: Error) => {
  logAuth(step, AuthLogType.ERROR, message, {
    error: error.message,
    stack: error.stack
  });
};

export const logAuthDebug = (step: AuthStep, message: string, data?: any) => {
  logAuth(step, AuthLogType.DEBUG, message, data);
};

/**
 * Получает все сохраненные логи для отладки
 */
export function getAuthLogs(): AuthLogEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  
  try {
    return JSON.parse(localStorage.getItem('auth_debug_logs') || '[]');
  } catch (e) {
    return [];
  }
}

/**
 * Очищает сохраненные логи
 */
export function clearAuthLogs(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  
  try {
    localStorage.removeItem('auth_debug_logs');
  } catch (e) {
    // Игнорируем ошибки localStorage
  }
}

/**
 * Экспортирует логи в JSON формате
 */
export function exportAuthLogs(): string {
  const logs = getAuthLogs();
  return JSON.stringify(logs, null, 2);
}

/**
 * Предоставляет строковое представление процесса авторизации для отладки
 */
export function getAuthFlowSummary(): string {
  const logs = getAuthLogs();
  let summary = `=== Сводка процесса авторизации ===\n`;
  summary += `Сессия: ${getSessionId()}\n`;
  summary += `Пользователь: ${getUserId() || 'Неизвестен'}\n`;
  summary += `Всего записей: ${logs.length}\n\n`;
  
  if (logs.length === 0) {
    summary += 'Логи авторизации отсутствуют.\n';
    return summary;
  }
  
  const firstLog = logs[0];
  const lastLog = logs[logs.length - 1];
  
  summary += `Начало: ${new Date(firstLog.timestamp).toLocaleString()} (${firstLog.step})\n`;
  summary += `Конец: ${new Date(lastLog.timestamp).toLocaleString()} (${lastLog.step})\n`;
  
  // Подсчет шагов по типам
  const stepCounts: Record<string, number> = {};
  logs.forEach(log => {
    stepCounts[log.step] = (stepCounts[log.step] || 0) + 1;
  });
  
  summary += `\nШаги процесса:\n`;
  Object.entries(stepCounts).forEach(([step, count]) => {
    summary += `- ${step}: ${count} раз\n`;
  });
  
  // Нахождение ошибок
  const errors = logs.filter(log => log.type === AuthLogType.ERROR);
  if (errors.length > 0) {
    summary += `\nОшибки (${errors.length}):\n`;
    errors.forEach((error, index) => {
      summary += `${index + 1}. [${error.step}] ${error.message}\n`;
    });
  } else {
    summary += `\nОшибки отсутствуют.\n`;
  }
  
  // Общая продолжительность
  const duration = new Date(lastLog.timestamp).getTime() - new Date(firstLog.timestamp).getTime();
  summary += `\nПродолжительность: ${duration / 1000} секунд\n`;
  
  return summary;
} 