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
  DEBUG = 'DEBUG',
  SECURITY = 'SECURITY',
  TELEMETRY = 'TELEMETRY'
}

/**
 * Шаги процесса авторизации
 */
export enum AuthStep {
  /** Инициализация */
  INIT = 'INIT',
  /** Начало авторизации */
  AUTH_START = 'AUTH_START',
  /** Инициализация Farcaster */
  FARCASTER_INIT = 'FARCASTER_INIT',
  /** Запрос к Farcaster */
  FARCASTER_REQUEST = 'FARCASTER_REQUEST',
  /** Взаимодействие с пользователем */
  USER_INTERACTION = 'USER_INTERACTION',
  /** Валидация данных */
  VALIDATE_DATA = 'VALIDATE_DATA',
  /** Ошибка валидации */
  VALIDATE_ERROR = 'VALIDATE_ERROR',
  /** Успех валидации */
  VALIDATE_SUCCESS = 'VALIDATE_SUCCESS',
  /** Сохранение пользователя */
  USER_SAVE = 'USER_SAVE',
  /** Авторизация завершена */
  AUTH_COMPLETE = 'AUTH_COMPLETE',
  /** Ошибка авторизации */
  AUTH_ERROR = 'AUTH_ERROR',
  /** Отмена авторизации */
  AUTH_CANCEL = 'AUTH_CANCEL',
  /** Начало выхода */
  LOGOUT_START = 'LOGOUT_START',
  /** Выход завершен */
  LOGOUT_COMPLETE = 'LOGOUT_COMPLETE',
  /** Ошибка при выходе */
  LOGOUT_ERROR = 'LOGOUT_ERROR',
  /** Запись в хранилище */
  STORAGE_WRITE = 'STORAGE_WRITE',
  /** Чтение из хранилища */
  STORAGE_READ = 'STORAGE_READ',
  /** Ошибка хранилища */
  STORAGE_ERROR = 'STORAGE_ERROR',
  /** Ошибка обновления токена */
  TOKEN_REFRESH_ERROR = 'TOKEN_REFRESH_ERROR'
}

// Интерфейс записи лога
export interface AuthLogEntry {
  timestamp: string;
  sessionId: string;
  userId: string | number | null;
  step: AuthStep;
  type: AuthLogType;
  message: string;
  data: any;
  error: any;
  clientInfo: {
    userAgent: string;
    platform: string;
    language: string;
  };
  serverInfo: {
    version: string;
    environment: string;
  };
}

// Хранилище для сессионных ID
let currentSessionId: string | null = null;
let currentUserId: number | string | null = null;

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
export function setUserId(userId: number | string): void {
  currentUserId = userId;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('auth_user_id', String(userId));
    }
  } catch (e) {
    // Игнорируем ошибки localStorage
  }
}

/**
 * Получает сохраненный ID пользователя
 */
export function getUserId(): number | string | null {
  if (!currentUserId && typeof window !== 'undefined' && window.localStorage) {
    try {
      const storedUserId = localStorage.getItem('auth_user_id');
      if (storedUserId) {
        if (!isNaN(Number(storedUserId))) {
          currentUserId = Number(storedUserId);
        } else {
          currentUserId = storedUserId;
        }
      }
    } catch (e) {
      // Игнорируем ошибки localStorage
    }
  }
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
      localStorage.removeItem('auth_user_id');
    }
  } catch (e) {
    // Игнорируем ошибки localStorage
  }
}

/**
 * Собирает информацию о клиенте
 */
function getClientInfo() {
  // Проверяем, доступен ли объект navigator (на сервере его нет)
  if (typeof navigator === 'undefined') {
    return {
      userAgent: 'Server',
      platform: 'Server',
      language: 'Server'
    };
  }

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language
  };
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

/**
 * Основная функция логирования
 */
export function logAuth(
  step: AuthStep,
  type: AuthLogType,
  message: string,
  data: Record<string, any> = {},
  error: any = null
): AuthLogEntry {
  const logEntry: AuthLogEntry = {
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    userId: getUserId() || null,
    step,
    type,
    message,
    data,
    error,
    clientInfo: getClientInfo(),
    serverInfo: {
      version: process.env.VERSION || 'unknown',
      environment: process.env.NODE_ENV || 'development'
    }
  };
  
  // Выводим в консоль только ошибки
  if (type === AuthLogType.ERROR) {
    const consolePrefix = `[AUTH:${type}:${step}]`;
    console.error(consolePrefix, message, { ...logEntry });
    
    // Отправляем в аналитику или мониторинг ошибок
    try {
      sendErrorToMonitoring(logEntry);
    } catch (e) {
      // Игнорируем ошибки отправки
    }
  }
  
  // Сохраняем в localStorage для отладки
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const logs = JSON.parse(localStorage.getItem('auth_debug_logs') || '[]');
      logs.push(logEntry);
      
      // Ограничиваем количество логов
      if (logs.length > 100) logs.shift();
      
      localStorage.setItem('auth_debug_logs', JSON.stringify(logs));
    } catch (e) {
      // Игнорируем ошибки localStorage
    }
  }

  return logEntry;
}

/**
 * Вспомогательные функции для разных типов логов
 */
export function logAuthInfo(step: AuthStep, message: string, data?: any): AuthLogEntry {
  return logAuth(step, AuthLogType.INFO, message, data);
}

export function logAuthWarning(step: AuthStep, message: string, data?: any): AuthLogEntry {
  return logAuth(step, AuthLogType.WARNING, message, data);
}

export function logAuthError(step: AuthStep, message: string, error?: any, data?: any): AuthLogEntry {
  return logAuth(step, AuthLogType.ERROR, message, data, error);
}

export function logAuthDebug(step: AuthStep, message: string, data?: any): AuthLogEntry {
  return logAuth(step, AuthLogType.DEBUG, message, data);
}

export function logAuthSecurity(step: AuthStep, message: string, data?: any): AuthLogEntry {
  return logAuth(step, AuthLogType.SECURITY, message, data);
}

/**
 * Отправляет ошибку в систему мониторинга если она настроена
 */
function sendErrorToMonitoring(logEntry: AuthLogEntry): void {
  // Здесь можно добавить интеграцию с Sentry, LogRocket, или другими системами мониторинга
  // Например:
  // if (typeof window !== 'undefined' && (window as any).Sentry) {
  //   (window as any).Sentry.captureException(logEntry.error, {
  //     extra: {
  //       step: logEntry.step,
  //       message: logEntry.message,
  //       data: logEntry.data,
  //       userId: logEntry.userId,
  //       sessionId: logEntry.sessionId
  //     }
  //   });
  // }
}

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
  if (!logs || logs.length === 0) {
    return 'Нет доступных логов';
  }

  const firstLog = logs[0];
  const lastLog = logs[logs.length - 1];

  if (!firstLog || !lastLog) {
    return 'Некорректные логи';
  }

  let summary = 'Сводка процесса авторизации:\n\n';
  summary += `Начало: ${new Date(firstLog.timestamp).toLocaleString()} (${firstLog.step})\n`;
  summary += `Конец: ${new Date(lastLog.timestamp).toLocaleString()} (${lastLog.step})\n`;

  // Подсчет количества логов по типам
  const typeCounts = logs.reduce((acc, log) => {
    acc[log.type] = (acc[log.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  summary += '\nСтатистика по типам:\n';
  Object.entries(typeCounts).forEach(([type, count]) => {
    summary += `${type}: ${count}\n`;
  });

  // Подсчет длительности
  const duration = new Date(lastLog.timestamp).getTime() - new Date(firstLog.timestamp).getTime();
  summary += `\nОбщая длительность: ${(duration / 1000).toFixed(2)} секунд\n`;

  return summary;
}

export function getAuthSummary(logs: AuthLogEntry[]): string {
  if (logs.length === 0) {
    return 'Нет записей в логе';
  }

  const firstLog = logs[0];
  const lastLog = logs[logs.length - 1];

  if (!firstLog || !lastLog) {
    return 'Некорректные данные в логе';
  }

  let summary = 'Сводка по авторизации:\n';
  summary += `Начало: ${new Date(firstLog.timestamp).toLocaleString()} (${firstLog.step})\n`;
  summary += `Конец: ${new Date(lastLog.timestamp).toLocaleString()} (${lastLog.step})\n`;

  const duration = new Date(lastLog.timestamp).getTime() - new Date(firstLog.timestamp).getTime();
  summary += `Длительность: ${Math.round(duration / 1000)} секунд\n`;

  return summary;
} 